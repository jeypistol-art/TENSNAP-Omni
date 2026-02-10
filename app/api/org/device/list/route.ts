import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";
import { getTenantId } from "@/lib/tenant";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const orgId = await getTenantId(session.user.id, session.user.email);
        const res = await query(
            `SELECT id, name, device_hash, last_active_at, created_at
             FROM org_devices
             WHERE organization_id = $1
             ORDER BY created_at ASC`,
            [orgId]
        );

        return NextResponse.json({ success: true, devices: res.rows });
    } catch (error) {
        console.error("List Devices Error:", error);
        return NextResponse.json({ error: "Failed to list devices" }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get("id");
        if (!deviceId) {
            return NextResponse.json({ error: "Device ID is required" }, { status: 400 });
        }

        const orgId = await getTenantId(session.user.id, session.user.email);
        await query(
            `DELETE FROM org_devices WHERE id = $1 AND organization_id = $2`,
            [deviceId, orgId]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Delete Device Error:", error);
        return NextResponse.json({ error: "Failed to delete device" }, { status: 500 });
    }
}
