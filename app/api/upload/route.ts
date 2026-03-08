import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { analyzeImage } from "@/lib/ocr_service";
import { getR2AssetsBucket, R2_ASSETS_BUCKET_NAME, uploadPreparedFilesToR2 } from "@/lib/r2_assets";
import { getRequestedPlanFromRequest } from "@/lib/accountPlan";
import { DEFAULT_SUBJECT, normalizeSubjectLabel } from "@/lib/subjects";

function normalizeTopicText(topic: unknown): string {
    if (typeof topic !== "string") return "";
    return topic.trim().replace(/\s+/g, " ");
}

function isGenericTopic(topic: string): boolean {
    if (!topic) return true;
    return /^(general|unknown|その他|不明|未分類|単元|分野)$/i.test(topic);
}

function dedupeTopics(topics: string[]): string[] {
    return Array.from(new Map(topics.map((t) => [t.toLowerCase(), t] as const)).values());
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Resolve Tenant
        const requestedPlan = getRequestedPlanFromRequest(request);
        const tenantId = await getTenantId(session.user.id, session.user.email, requestedPlan);
        const effectivePlan = requestedPlan;

        // 2. Process File & Context
        const formData = await request.formData();

        // Multi-file extraction
        const fileEntries = formData.getAll("file") as File[];
        const problemSheetEntries = formData.getAll("problemSheet") as File[];
        const formUnitName = formData.get("unitName") as string | undefined;
        const examPhaseRaw = formData.get("examPhase");
        const examPhase = examPhaseRaw === "true" || examPhaseRaw === "1";

        if (fileEntries.length === 0) {
            return NextResponse.json({ error: "No answer sheet uploaded" }, { status: 400 });
        }

        // Helper to convert File[] to { buffer, mimeType, originalName }[]
        const processFiles = async (files: File[]) => {
            return Promise.all(files.map(async (f) => ({
                buffer: Buffer.from(await f.arrayBuffer()),
                mimeType: f.type,
                originalName: f.name
            })));
        };

        const answerSheets = await processFiles(fileEntries);
        const problemSheets = await processFiles(problemSheetEntries);

        const traceId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        let storedAnswerKeys: string[] = [];
        let storedProblemKeys: string[] = [];
        let representativePath = `/uploads/${tenantId}/${fileEntries[0].name}-multi-${Date.now()}`;

        const r2Bucket = await getR2AssetsBucket();
        if (r2Bucket) {
            storedAnswerKeys = await uploadPreparedFilesToR2({
                bucket: r2Bucket,
                tenantId,
                userId: session.user.id,
                traceId,
                category: "answer",
                files: answerSheets,
            });
            storedProblemKeys = await uploadPreparedFilesToR2({
                bucket: r2Bucket,
                tenantId,
                userId: session.user.id,
                traceId,
                category: "problem",
                files: problemSheets,
            });
            if (storedAnswerKeys.length > 0) {
                representativePath = `r2://${R2_ASSETS_BUCKET_NAME}/${storedAnswerKeys[0]}`;
            }
        } else {
            console.warn("R2 bucket binding not found; falling back to non-persistent upload path.");
        }

        let studentId = formData.get("studentId") as string | null; // Optional: Linked Student ID
        if (effectivePlan === "family") {
            const primaryStudent = await query<{ id: string }>(
                `SELECT id FROM students WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
                [session.user.id]
            );
            const primaryStudentId = primaryStudent.rows[0]?.id || (
                await query<{ id: string }>(
                    `INSERT INTO students (user_id, name, name_kana, grade, target_school, notes)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id`,
                    [session.user.id, "受講者", null, null, null, null]
                )
            ).rows[0].id;

            if (studentId && studentId !== primaryStudentId) {
                return NextResponse.json(
                    { error: "Family plan allows only one student profile" },
                    { status: 403 }
                );
            }
            studentId = primaryStudentId;
        }
        let studentGrade: string | null = null;
        if (studentId) {
            const studentResult = await query<{ grade: string | null }>(
                `SELECT grade FROM students WHERE id = $1 AND user_id = $2 LIMIT 1`,
                [studentId, session.user.id]
            );
            studentGrade = studentResult.rows[0]?.grade || null;
        }

        // 3. Save Upload Record (with Student ID)
        // Insert into uploads table
        const uploadResult = await query<{ id: string }>(
            `INSERT INTO uploads (user_id, student_id, file_path, status) VALUES ($1, $2, $3, $4) RETURNING id`,
            [session.user.id, studentId || null, representativePath, 'processing']
        );
        const uploadId = uploadResult.rows[0].id;

        const subject = normalizeSubjectLabel((formData.get("subject") as string) || DEFAULT_SUBJECT);

        // 4. Perform Analysis
        const analysis = await analyzeImage(answerSheets, {
            unitName: formUnitName, // Use the unitName from the form data
            subject: subject || undefined,
            grade: studentGrade || undefined,
            problemSheets,
            examPhase,
        });

        // 5. Save Analysis
        // Mapping Semantic Analysis JSON (v4) to DB columns
        // analyses table: score, formula, range, details
        // SaaS columns: student_id, user_id, subject, unit_name, test_score, max_score, comprehension_score

        // Defensive: Parse score safely from string "75/100" or number
        let scoreInt = 0;
        let maxScoreInt = 100;

        if (typeof analysis.test_score === 'number') {
            scoreInt = analysis.test_score;
        } else if (typeof analysis.test_score === 'string') {
            const parts = analysis.test_score.split('/');
            scoreInt = parseInt(parts[0]) || 0;
            if (parts.length > 1) maxScoreInt = parseInt(parts[1]) || 100;
        }

        const weaknessAreas = Array.isArray(analysis.weakness_areas) ? analysis.weakness_areas : [];

        // Normalize covered topics and replace generic placeholders (e.g. "General").
        const cleanedCoveredTopics = dedupeTopics(
            (Array.isArray(analysis.covered_topics) ? analysis.covered_topics : [])
                .map(normalizeTopicText)
                .filter((t) => !isGenericTopic(t))
        );
        const weaknessTopicFallback = dedupeTopics(
            weaknessAreas
                .map((w) => normalizeTopicText(w?.topic))
                .filter((t) => !isGenericTopic(t))
        );
        const topics = cleanedCoveredTopics.length > 0
            ? cleanedCoveredTopics
            : weaknessTopicFallback.slice(0, 3);
        analysis.covered_topics = topics.slice(0, 5);
        analysis.weakness_areas = weaknessAreas.slice(0, 3);

        // Determine Unit Name and Subject
        // Priority: Form Input > AI Detected Topic > Fallback
        const derivedUnitName = formUnitName || (analysis.covered_topics.length > 0 ? analysis.covered_topics[0] : normalizeSubjectLabel(subject));
        const testDate = (formData.get("testDate") as string) || new Date().toISOString().split('T')[0];

        const analysisDetailsForStorage = {
            ...analysis,
            r2_assets: {
                bucket: R2_ASSETS_BUCKET_NAME,
                trace_id: traceId,
                answer_sheet_keys: storedAnswerKeys,
                problem_sheet_keys: storedProblemKeys,
            },
        };

        await query(
            `INSERT INTO analyses (
                upload_id, 
                user_id, 
                student_id, 
                score, 
                test_score, 
                max_score, 
                comprehension_score,
                subject, 
                unit_name,
                test_date,
                formula, 
                range, 
                details
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                uploadId,
                session.user.id,
                studentId || null,
                scoreInt, // Legacy 'score' column
                scoreInt, // New 'test_score' column
                maxScoreInt,
                analysis.comprehension_score || 0,
                subject,
                derivedUnitName,
                testDate,
                // Map "Covered Topics" to "Formula" column (as text, List)
                topics.join(", "),
                // Map Weakness Areas to "Range" (Visual Debugging)
                weaknessAreas.map((w) => `${w.level === 'Primary' ? '🔴' : '🟡'}${w.topic}`).join(", "),
                // Store full semantic details in JSONB (Future Proofing)
                JSON.stringify(analysisDetailsForStorage)
            ]
        );
        // Note: Raw query above presumed void if no RETURNING. 
        // Need to change query to return ID.

        const analysisIdRes = await query<{ id: string }>(
            `SELECT id FROM analyses WHERE upload_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [uploadId]
        );
        const analysisId = analysisIdRes.rows[0]?.id;
        // 6. Update Upload Status to 'completed'
        await query(
            `UPDATE uploads SET status = 'completed' WHERE id = $1`,
            [uploadId]
        );

        return NextResponse.json({
            success: true,
            analysis: {
                ...analysis,
                exam_phase: examPhase,
                test_score_raw: analysis.raw_test_score ?? analysis.test_score
            },
            uploadId,
            analysisId,
            studentId,
            assets: {
                bucket: R2_ASSETS_BUCKET_NAME,
                answerSheetCount: storedAnswerKeys.length,
                problemSheetCount: storedProblemKeys.length,
            }
        });
    } catch (error) {
        console.error("Upload/Analysis error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: String(error) },
            { status: 500 }
        );
    }
}
