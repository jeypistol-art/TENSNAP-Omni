import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
    try {
        console.log("Starting Schema Fix via API...");

        const results = [];

        // 1. name
        try {
            await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`);
            results.push("Added name");
        } catch (e: any) {
            results.push(`Failed name: ${e.message}`);
        }

        // 2. image
        try {
            await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT`);
            results.push("Added image");
        } catch (e: any) {
            results.push(`Failed image: ${e.message}`);
        }

        // 3. email_verified
        try {
            await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP`);
            results.push("Added email_verified");
        } catch (e: any) {
            results.push(`Failed email_verified: ${e.message}`);
        }

        // Verify
        const cols = await query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        const columnNames = cols.rows.map((r: any) => r.column_name);

        return NextResponse.json({
            success: true,
            actions: results,
            current_columns: columnNames
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
