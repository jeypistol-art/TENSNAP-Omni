import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id } = await context.params;
        const { studentId, unitName, testDate, score, subject, comprehensionScore } = await request.json();

        // Update Analysis
        await query(
            `UPDATE analyses 
             SET 
                student_id = COALESCE($1, student_id),
                unit_name = COALESCE($2, unit_name),
                test_date = COALESCE($3, test_date),
                test_score = COALESCE($4, test_score),
                score = COALESCE($5, score),
                subject = COALESCE($6, subject),
                comprehension_score = COALESCE($7, comprehension_score)
             WHERE id = $8 AND user_id = $9`,
            [
                studentId ?? null,
                unitName ?? null,
                testDate ?? null,
                score ?? null,
                score ?? null,
                subject ?? null,
                comprehensionScore ?? null,
                id,
                session.user.id
            ]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update Analysis Error:", error);
        return NextResponse.json({ error: "Failed to update analysis" }, { status: 500 });
    }
}
