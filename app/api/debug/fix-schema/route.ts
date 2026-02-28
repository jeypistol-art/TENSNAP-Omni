import { NextResponse } from "next/server";
import { query } from "@/lib/db";

type ColumnRow = { column_name: string };

const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

export async function GET() {
    try {
        console.log("Starting Schema Fix via API...");

        const results = [];

        // 1. name
        try {
            await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`);
            results.push("Added name");
        } catch (e: unknown) {
            results.push(`Failed name: ${getErrorMessage(e)}`);
        }

        // 2. image
        try {
            await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT`);
            results.push("Added image");
        } catch (e: unknown) {
            results.push(`Failed image: ${getErrorMessage(e)}`);
        }

        // 3. email_verified
        try {
            await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP`);
            results.push("Added email_verified");
        } catch (e: unknown) {
            results.push(`Failed email_verified: ${getErrorMessage(e)}`);
        }

        // Verify
        const cols = await query<ColumnRow>(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        const columnNames = cols.rows.map((r) => r.column_name);

        return NextResponse.json({
            success: true,
            actions: results,
            current_columns: columnNames
        });

    } catch (error: unknown) {
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
