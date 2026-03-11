import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";
import { analyzeImage } from "@/lib/ocr_service";
import { getTenantId } from "@/lib/tenant";
import { getR2AssetsBucket, R2_ASSETS_BUCKET_NAME } from "@/lib/r2_assets";
import { isSubjectMatch, normalizeSubjectLabel } from "@/lib/subjects";

type ReanalyzeRequest = {
    analysisIds?: string[];
    studentId?: string;
    subject?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    commit?: boolean;
};

type AnalysisRow = {
    id: string;
    upload_id: string | null;
    user_id: string;
    student_id: string | null;
    subject: string | null;
    unit_name: string | null;
    test_date: string | null;
    score: number | null;
    test_score: number | null;
    max_score: number | null;
    details: unknown;
    grade: string | null;
};

type StoredDetails = {
    exam_phase?: boolean;
    r2_assets?: {
        bucket?: string;
        answer_sheet_keys?: string[];
        problem_sheet_keys?: string[];
    };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeParseDetails(value: unknown): StoredDetails {
    if (!value) return {};
    if (typeof value === "string") {
        try {
            return JSON.parse(value) as StoredDetails;
        } catch {
            return {};
        }
    }
    if (typeof value === "object") return value as StoredDetails;
    return {};
}

function inferMimeTypeFromKey(key: string): string {
    const lower = key.toLowerCase();
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "image/jpeg";
    if (lower.endsWith(".pdf")) return "application/pdf";
    return "image/jpeg";
}

function parseScoreParts(testScore: unknown) {
    let scoreInt = 0;
    let maxScoreInt = 100;
    if (typeof testScore === "number") {
        scoreInt = testScore;
    } else if (typeof testScore === "string") {
        const parts = testScore.split("/");
        scoreInt = parseInt(parts[0] || "0", 10) || 0;
        if (parts.length > 1) maxScoreInt = parseInt(parts[1] || "100", 10) || 100;
    }
    return { scoreInt, maxScoreInt };
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await getTenantId(session.user.id, session.user.email ?? null);

        const body = await request.json() as ReanalyzeRequest;
        const commit = body.commit === true;
        const limit = Math.min(Math.max(Number(body.limit || 10), 1), 50);

        if (Array.isArray(body.analysisIds) && body.analysisIds.some((id) => !UUID_RE.test(String(id)))) {
            return NextResponse.json({ error: "Invalid analysisIds" }, { status: 400 });
        }
        if (body.studentId && !UUID_RE.test(body.studentId)) {
            return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
        }

        const params: unknown[] = [session.user.id];
        const clauses = ["a.user_id = $1"];

        if (Array.isArray(body.analysisIds) && body.analysisIds.length > 0) {
            params.push(body.analysisIds);
            clauses.push(`a.id = ANY($${params.length}::uuid[])`);
        }
        if (body.studentId) {
            params.push(body.studentId);
            clauses.push(`a.student_id = $${params.length}`);
        }
        if (body.startDate) {
            params.push(body.startDate);
            clauses.push(`COALESCE(a.test_date, a.created_at::date) >= $${params.length}`);
        }
        if (body.endDate) {
            params.push(body.endDate);
            clauses.push(`COALESCE(a.test_date, a.created_at::date) <= $${params.length}`);
        }
        params.push(limit);

        const result = await query<AnalysisRow>(
            `SELECT
                a.id,
                a.upload_id,
                a.user_id,
                a.student_id,
                a.subject,
                a.unit_name,
                a.test_date::text,
                a.score,
                a.test_score,
                a.max_score,
                a.details,
                s.grade
             FROM analyses a
             LEFT JOIN students s ON s.id = a.student_id
             WHERE ${clauses.join(" AND ")}
             ORDER BY COALESCE(a.test_date, a.created_at::date) ASC, a.created_at ASC
             LIMIT $${params.length}`,
            params
        );

        const rows = body.subject && body.subject !== "all"
            ? result.rows.filter((row) => isSubjectMatch(row.subject ?? undefined, body.subject))
            : result.rows;

        if (rows.length === 0) {
            return NextResponse.json({ success: true, processed: 0, updated: 0, results: [] });
        }

        const bucket = await getR2AssetsBucket();
        if (!bucket?.get) {
            return NextResponse.json({ error: "R2 bucket is unavailable in this runtime" }, { status: 500 });
        }

        const outputs: Array<Record<string, unknown>> = [];
        let updated = 0;

        for (const row of rows) {
            const details = safeParseDetails(row.details);
            const answerKeys = Array.isArray(details.r2_assets?.answer_sheet_keys) ? details.r2_assets?.answer_sheet_keys : [];
            const problemKeys = Array.isArray(details.r2_assets?.problem_sheet_keys) ? details.r2_assets?.problem_sheet_keys : [];

            if (answerKeys.length === 0) {
                outputs.push({ analysisId: row.id, skipped: true, reason: "No answer_sheet_keys" });
                continue;
            }

            const answerSheets = [];
            for (const key of answerKeys) {
                const object = await bucket.get(key);
                if (!object) throw new Error(`R2 object not found: ${key}`);
                answerSheets.push({
                    buffer: Buffer.from(await object.arrayBuffer()),
                    mimeType: object.httpMetadata?.contentType || inferMimeTypeFromKey(key),
                });
            }

            const problemSheets = [];
            for (const key of problemKeys) {
                const object = await bucket.get(key);
                if (!object) continue;
                problemSheets.push({
                    buffer: Buffer.from(await object.arrayBuffer()),
                    mimeType: object.httpMetadata?.contentType || inferMimeTypeFromKey(key),
                });
            }

            const analysis = await analyzeImage(answerSheets, {
                unitName: row.unit_name || undefined,
                subject: row.subject || undefined,
                grade: row.grade || undefined,
                problemSheets,
                examPhase: !!details.exam_phase,
            });

            const { scoreInt, maxScoreInt } = parseScoreParts(analysis.test_score);
            const weaknessAreas = Array.isArray(analysis.weakness_areas) ? analysis.weakness_areas : [];
            const coveredTopics = Array.isArray(analysis.covered_topics) ? analysis.covered_topics : [];
            const derivedUnitName = row.unit_name || coveredTopics[0] || normalizeSubjectLabel(row.subject || "");
            const analysisDetailsForStorage = {
                ...analysis,
                r2_assets: {
                    bucket: details.r2_assets?.bucket || R2_ASSETS_BUCKET_NAME,
                    answer_sheet_keys: answerKeys,
                    problem_sheet_keys: problemKeys,
                },
            };

            if (commit) {
                await query(
                    `UPDATE analyses
                     SET score = $2,
                         test_score = $3,
                         max_score = $4,
                         comprehension_score = $5,
                         unit_name = $6,
                         formula = $7,
                         range = $8,
                         details = $9
                     WHERE id = $1 AND user_id = $10`,
                    [
                        row.id,
                        scoreInt,
                        scoreInt,
                        maxScoreInt,
                        analysis.comprehension_score || 0,
                        derivedUnitName,
                        coveredTopics.join(", "),
                        weaknessAreas.map((w) => `${w.level === "Primary" ? "🔴" : "🟡"}${w.topic}`).join(", "),
                        JSON.stringify(analysisDetailsForStorage),
                        session.user.id,
                    ]
                );
                updated += 1;
            }

            outputs.push({
                analysisId: row.id,
                subject: row.subject,
                testDate: row.test_date,
                unitNameBefore: row.unit_name,
                unitNameAfter: derivedUnitName,
                coveredTopics: coveredTopics.slice(0, 6),
                weaknessAreas: weaknessAreas.slice(0, 6),
                committed: commit,
            });
        }

        return NextResponse.json({
            success: true,
            processed: rows.length,
            updated,
            committed: commit,
            results: outputs,
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
