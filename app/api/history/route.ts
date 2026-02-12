import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Weakness = { topic: string; level: string };
type ParsedDetails = { insight_conclusion?: string; weakness_areas?: Weakness[] };

function safeParseJson<T>(value: unknown, fallback: T): T {
    if (value == null) return fallback;
    if (typeof value === "string") {
        try {
            return JSON.parse(value) as T;
        } catch {
            return fallback;
        }
    }
    if (typeof value === "object") return value as T;
    return fallback;
}

export async function GET(request: Request) {
    try {
        // 1. セッションと権限の確認
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. クエリパラメータから studentId を取得
        const { searchParams } = new URL(request.url);
        const studentId = searchParams.get("studentId");

        if (!studentId) {
            return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
        }
        if (!UUID_RE.test(studentId)) {
            return NextResponse.json({ error: "Invalid student ID format" }, { status: 400 });
        }

        // 3. 履歴の取得（テナント分離を徹底）
        // 最新のものが上に来るように降順 (DESC) でソート
        const result = await query(
            `SELECT 
                id, 
                unit_name, 
                subject, 
                test_date,
                test_score, 
                max_score, 
                comprehension_score, 
                created_at,
                details->>'insight_conclusion' as insight_summary,
                details->'weakness_areas' as weaknesses,
                details
             FROM analyses 
             WHERE student_id = $1 AND user_id = $2 
             ORDER BY created_at DESC`,
            [studentId, session.user.id]
        );

        const history = result.rows.map((row) => {
            const rowObj = row as Record<string, unknown>;
            const details = safeParseJson<ParsedDetails>(rowObj.details, {});
            const weaknessesFromDetails = Array.isArray(details?.weakness_areas) ? details.weakness_areas : [];
            const weaknessesRaw = safeParseJson<unknown>(rowObj.weaknesses, weaknessesFromDetails);
            const weaknesses = Array.isArray(weaknessesRaw) ? weaknessesRaw : weaknessesFromDetails;
            return {
                ...rowObj,
                details,
                weaknesses,
                insight_summary:
                    typeof rowObj.insight_summary === "string" && rowObj.insight_summary.trim() !== ""
                        ? rowObj.insight_summary
                        : (typeof details?.insight_conclusion === "string" ? details.insight_conclusion : ""),
            };
        });

        return NextResponse.json({
            success: true,
            history
        });

    } catch (error) {
        console.error("Fetch History Error:", {
            message: error instanceof Error ? error.message : String(error),
            studentId: new URL(request.url).searchParams.get("studentId"),
        });
        return NextResponse.json(
            { error: "Failed to retrieve history" },
            { status: 500 }
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const analysisId = searchParams.get("id");

        if (!analysisId) {
            return NextResponse.json({ error: "Analysis ID is required" }, { status: 400 });
        }

        // Delete analysis record (Cascade delete should handle related uploads if configured, 
        // but for now we just delete the analysis record itself as requested)
        await query(
            `DELETE FROM analyses WHERE id = $1 AND user_id = $2`,
            [analysisId, session.user.id]
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Delete History Error:", error);
        return NextResponse.json(
            { error: "Failed to delete history" },
            { status: 500 }
        );
    }
}
