import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { query } from "@/lib/db";

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await query(
            `UPDATE users SET current_session_id = NULL WHERE id = $1`,
            [session.user.id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Logout Cleanup Error:", error);
        return NextResponse.json({ error: "Failed to clear session" }, { status: 500 });
    }
}
