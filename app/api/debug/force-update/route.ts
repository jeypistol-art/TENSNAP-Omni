import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
    try {
        // 1. Find the latest organization
        const orgRes = await query<{ id: string, name: string }>(
            `SELECT id, name FROM organizations ORDER BY created_at DESC LIMIT 1`
        );

        if (orgRes.rows.length === 0) {
            return NextResponse.json({ error: "No organizations found" });
        }

        const org = orgRes.rows[0];

        // 2. Force Update
        await query(
            `UPDATE organizations 
             SET subscription_status = 'active', 
                 stripe_customer_id = 'cus_forced_app_api',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [org.id]
        );

        return NextResponse.json({
            success: true,
            message: "Organization forcefully updated to ACTIVE",
            org: org
        });

    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
