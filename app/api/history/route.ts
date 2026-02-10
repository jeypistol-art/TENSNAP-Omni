import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";

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

        return NextResponse.json({
            success: true,
            history: result.rows
        });

    } catch (error) {
        console.error("Fetch History Error:", error);
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
