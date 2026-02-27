import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";
import { getTenantId } from "@/lib/tenant";

async function forceActivateForCurrentUser() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const orgId = await getTenantId(session.user.id, session.user.email ?? null);
        const orgRes = await query<{ id: string; name: string }>(
            `SELECT id, name FROM organizations WHERE id = $1 LIMIT 1`,
            [orgId]
        );

        if (orgRes.rows.length === 0) {
            return NextResponse.json({ error: "Organization not found" }, { status: 404 });
        }

        const org = orgRes.rows[0];

        // Force only this signed-in user's organization.
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
            org
        });

    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function GET() {
    return forceActivateForCurrentUser();
}

export async function POST() {
    return forceActivateForCurrentUser();
}
