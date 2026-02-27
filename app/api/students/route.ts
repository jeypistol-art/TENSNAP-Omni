import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";
import { getRequestedPlanFromRequest, getOrganizationAccountPlan } from "@/lib/accountPlan";
import { getTenantId } from "@/lib/tenant";

type SessionUser = {
    id: string;
    email?: string | null;
};

async function resolveEffectivePlan(request: Request, user: SessionUser): Promise<"school" | "family"> {
    const requestedPlan = getRequestedPlanFromRequest(request);
    const orgId = await getTenantId(user.id, user.email ?? null, requestedPlan);
    const orgPlan = await getOrganizationAccountPlan(orgId);
    return requestedPlan === "family" || orgPlan === "family" ? "family" : "school";
}

// GET: List all students
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const plan = await resolveEffectivePlan(request, session.user as SessionUser);
        let result;
        if (plan === "family") {
            result = await query(
                "SELECT * FROM students WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1",
                [session.user.id]
            );
            if (result.rows.length === 0) {
                result = await query(
                    `INSERT INTO students (user_id, name, name_kana, grade, target_school, notes)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING *`,
                    [session.user.id, "受講者", null, null, null, null]
                );
            }
        } else {
            result = await query(
                "SELECT * FROM students WHERE user_id = $1 ORDER BY name ASC",
                [session.user.id]
            );
        }
        return NextResponse.json({ students: result.rows });
    } catch (error) {
        console.error("Fetch Students Error:", error);
        return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
    }
}

// POST: Create a new student
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const plan = await resolveEffectivePlan(request, session.user as SessionUser);
        if (plan === "family") {
            return NextResponse.json(
                { error: "Family plan does not support student registration" },
                { status: 403 }
            );
        }

        const { name, name_kana, grade, target_school, notes } = await request.json();
        const result = await query(
            `INSERT INTO students (user_id, name, name_kana, grade, target_school, notes) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [session.user.id, name, name_kana, grade, target_school, notes]
        );
        return NextResponse.json({ student: result.rows[0] });
    } catch (error) {
        console.error("Create Student Error:", error);
        return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
    }
}

// PATCH: Update a student name (inline edit)
export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id, name } = await request.json();
        if (!id || typeof name !== "string") {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const result = await query(
            `UPDATE students SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
            [name.trim(), id, session.user.id]
        );
        if (result.rows.length === 0) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }
        return NextResponse.json({ student: result.rows[0] });
    } catch (error) {
        console.error("Update Student Error:", error);
        return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
    }
}
