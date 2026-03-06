import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";
import { getRequestedPlanFromRequest } from "@/lib/accountPlan";
import { getTenantId } from "@/lib/tenant";

type SessionUser = {
    id: string;
    email?: string | null;
};

// GET: List all students
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const requestedPlan = getRequestedPlanFromRequest(request);
        await getTenantId((session.user as SessionUser).id, (session.user as SessionUser).email ?? null, requestedPlan);
        let result;
        if (requestedPlan === "family") {
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
        const requestedPlan = getRequestedPlanFromRequest(request);
        await getTenantId((session.user as SessionUser).id, (session.user as SessionUser).email ?? null, requestedPlan);
        if (requestedPlan === "family") {
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

// PATCH: Update a student profile
export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id, name, name_kana, grade, target_school, notes } = await request.json();
        if (!id || typeof name !== "string" || !name.trim()) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }
        const optionalTextOrNull = (value: unknown) => {
            if (typeof value !== "string") return null;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
        };

        const result = await query(
            `UPDATE students
             SET name = $1,
                 name_kana = $2,
                 grade = $3,
                 target_school = $4,
                 notes = $5
             WHERE id = $6 AND user_id = $7
             RETURNING *`,
            [
                name.trim(),
                optionalTextOrNull(name_kana),
                optionalTextOrNull(grade),
                optionalTextOrNull(target_school),
                optionalTextOrNull(notes),
                id,
                session.user.id
            ]
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
