import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";

// GET: List all students
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const result = await query(
            "SELECT * FROM students WHERE user_id = $1 ORDER BY name ASC",
            [session.user.id]
        );
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
