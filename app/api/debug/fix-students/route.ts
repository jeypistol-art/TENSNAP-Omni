import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
    try {
        console.log("Starting Student Schema Fix via API...");

        // Add name_kana
        await query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS name_kana TEXT`);

        // Verify
        const res = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'students' AND column_name = 'name_kana'
        `);

        const exists = res.rows.length > 0;

        return NextResponse.json({
            success: true,
            message: "Schema update attempted",
            verification: exists ? "Column 'name_kana' exists" : "Column MISSING after update"
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
