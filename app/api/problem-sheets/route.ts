import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { buildScanObjectKey, getR2AssetsBucket, R2_ASSETS_BUCKET_NAME } from "@/lib/r2_assets";

// GET: List recent problem sheets for the user
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Limit to recent 10 for MVP (Shortest Path)
        const result = await query(
            `SELECT id, name, created_at FROM problem_sheets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
            [session.user.id]
        );

        return NextResponse.json({ sheets: result.rows });
    } catch (error) {
        console.error("Problem Sheets GET Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST: Upload a new problem sheet
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tenantId = await getTenantId(session.user.id, session.user.email);
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const name = formData.get("name") as string || "Untitled Sheet";

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const traceId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const key = buildScanObjectKey({
            tenantId,
            userId: session.user.id,
            traceId,
            category: "problem-library",
            index: 0,
            fileName: file.name,
        });

        let storedPath = `r2://${R2_ASSETS_BUCKET_NAME}/${key}`;
        const bucket = await getR2AssetsBucket();
        if (bucket) {
            await bucket.put(key, buffer, {
                httpMetadata: {
                    contentType: file.type || "application/octet-stream",
                },
                customMetadata: {
                    name,
                    originalName: file.name,
                    uploadedAt: new Date().toISOString(),
                },
            });
        } else {
            // Local fallback for non-Cloudflare runtime.
            const base64 = buffer.toString("base64");
            storedPath = `data:${file.type};base64,${base64}`;
        }

        const insertRes = await query<{ id: string }>(
            `INSERT INTO problem_sheets (user_id, name, file_path) VALUES ($1, $2, $3) RETURNING id`,
            [session.user.id, name, storedPath]
        );

        return NextResponse.json({ success: true, id: insertRes.rows[0].id });

    } catch (error) {
        console.error("Problem Sheets POST Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
