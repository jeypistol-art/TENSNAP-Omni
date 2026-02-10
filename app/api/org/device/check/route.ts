import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";
import { getTenantId } from "@/lib/tenant";
import { randomUUID } from "crypto";

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user || (session as any).error === "ForceLogout") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Parse User Agent & Device Hash from Client
        // Client sends a local-stored UUID if it has one.
        const { deviceId: clientDeviceId } = await request.json();

        // 1. Identify User's Organization
        const orgId = await getTenantId(session.user.id, session.user.email);

        // FETCH STATUS
        const orgRes = await query<{ subscription_status: string; trial_ends_at: string | null }>(
            `SELECT subscription_status, trial_ends_at FROM organizations WHERE id = $1`,
            [orgId]
        );
        const subscriptionStatus = orgRes.rows[0]?.subscription_status || 'trialing';
        const trialEndsAt = orgRes.rows[0]?.trial_ends_at || null;

        // 2. Resolve Device ID
        let currentDeviceId = clientDeviceId;
        let isNewDevice = false;

        // If client sends no ID, it's definitely a new context for the client.
        // But we need to see if we can register it.

        // 3. Check against DB
        let dbDevice = null;
        if (currentDeviceId) {
            const checkRes = await query(
                `SELECT * FROM org_devices WHERE organization_id = $1 AND device_hash = $2`,
                [orgId, currentDeviceId]
            );
            if (checkRes.rows.length > 0) {
                dbDevice = checkRes.rows[0];
                // Update Last Active
                await query(
                    `UPDATE org_devices SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [(dbDevice as any).id]
                );
            } else {
                // Client has an ID but DB doesn't know it (Maybe purged?). Treat as new.
                currentDeviceId = null;
            }
        }

        if (!dbDevice) {
            // Needs Registration
            // 3.5 Global Device Check (Prevent Trial Abuse)
            if (currentDeviceId) {
                const globalCheck = await query<{ count: string }>(
                    `SELECT COUNT(*) FROM org_devices d 
                     JOIN organizations o ON d.organization_id = o.id 
                     WHERE d.device_hash = $1 
                     AND d.organization_id != $2
                     AND o.subscription_status IN ('trialing', 'past_due', 'canceled')`,
                    [currentDeviceId, orgId]
                );
                if (parseInt(globalCheck.rows[0].count) > 0) {
                    return NextResponse.json({
                        success: false,
                        error: "TrialAbuseDetected",
                        message: "このデバイスは既に別のトライアル組織で使用されています。"
                    });
                }
            }

            // 4. Check Limits (Max 2)
            const countRes = await query<{ count: string }>(
                `SELECT COUNT(*) FROM org_devices WHERE organization_id = $1`,
                [orgId]
            );
            const currentCount = parseInt(countRes.rows[0].count);

            if (currentCount >= 2) {
                const devicesRes = await query(
                    `SELECT id, name, last_active_at, created_at FROM org_devices WHERE organization_id = $1 ORDER BY created_at ASC`,
                    [orgId]
                );
                // BLOCKED
                return NextResponse.json({
                    success: false,
                    error: "DeviceLimitExceeded",
                    registeredCount: currentCount,
                    devices: devicesRes.rows
                });
            }

            // 5. Register
            if (!currentDeviceId) currentDeviceId = randomUUID();
            const userAgent = request.headers.get("user-agent") || "Unknown Device";

            await query(
                `INSERT INTO org_devices (organization_id, device_hash, name) VALUES ($1, $2, $3)`,
                [orgId, currentDeviceId, userAgent]
            );
            isNewDevice = true;
        }

        return NextResponse.json({
            success: true,
            deviceId: currentDeviceId, // Client should store this
            isNewDevice,
            subscriptionStatus,
            trialEndsAt
        });
    } catch (error) {
        console.error("Device verification error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
