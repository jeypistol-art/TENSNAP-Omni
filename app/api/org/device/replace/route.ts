import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";
import { getTenantId } from "@/lib/tenant";

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = await request.json();
        const removeDeviceId = typeof payload.removeDeviceId === "string" ? payload.removeDeviceId : null;
        const deviceId = typeof payload.deviceId === "string" ? payload.deviceId : null;
        const deviceName = typeof payload.deviceName === "string" ? payload.deviceName : "Unknown Device";

        if (!removeDeviceId || !deviceId) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        const orgId = await getTenantId(session.user.id, session.user.email);

        const owned = await query<{ id: string }>(
            `SELECT id FROM org_devices WHERE id = $1 AND organization_id = $2`,
            [removeDeviceId, orgId]
        );
        if (owned.rows.length === 0) {
            return NextResponse.json({ error: "Device not found" }, { status: 404 });
        }

        await query(
            `DELETE FROM org_devices WHERE id = $1 AND organization_id = $2`,
            [removeDeviceId, orgId]
        );

        const existing = await query<{ id: string }>(
            `SELECT id FROM org_devices WHERE organization_id = $1 AND device_hash = $2`,
            [orgId, deviceId]
        );
        if (existing.rows.length === 0) {
            await query(
                `INSERT INTO org_devices (organization_id, device_hash, name) VALUES ($1, $2, $3)`,
                [orgId, deviceId, deviceName]
            );
        } else {
            await query(
                `UPDATE org_devices SET last_active_at = CURRENT_TIMESTAMP, name = $1 WHERE id = $2`,
                [deviceName, existing.rows[0].id]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Replace Device Error:", error);
        return NextResponse.json({ error: "Failed to replace device" }, { status: 500 });
    }
}
