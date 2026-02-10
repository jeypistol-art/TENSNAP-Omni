import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";

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

        // MVP: Fake Path (just like main upload)
        const fakeFilePath = `/problem-sheets/${tenantId}/${file.name}-${Date.now()}`;

        // Note: For MVP we don't save the physical file to S3 yet. 
        // In a real implementation, we would upload to blob storage here.
        // For now, we only persist the metadata so the UI can reference it.
        // WAIT! If we want to send the image to OpenAI later, we need the file content!
        // Since we don't have S3, we can't fetch it back later easily if we don't save it.
        // BUT, the Prompt says "Register Problem Sheet: ... refer to it as Master".
        // Challenge: If I don't implement S3, I can't "retrieve" the master sheet for subsequent requests.
        //
        // "Shortest Path" workaround for V2 with NO S3:
        // Option A: Store Base64 in DB (Heavy, but works for MVP).
        // Option B: Assume User re-uploads it every time? No, that defeats the purpose.
        // Option C: Use `fs` to save to local `public/uploads` (Works for local dev, fails on Vercel unless Blob).
        //
        // Decision: Store Base64 in DB (TEXT column).
        // It's dirty but guarantees functionality without external bucket config.
        // Limit: Postgres TEXT can hold ~1GB. 1 Image base64 is ~5MB. Fine for MVP.

        // We need to alter table or just use `file_path` column to store DataURI?
        // Let's modify the plan/thinking slightly: content is needed.
        // Re-checking DB schema... `file_path` is TEXT.
        // I will store the Data URI in `file_path` for this MVP.

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");
        const dataUri = `data:${file.type};base64,${base64}`;

        const insertRes = await query<{ id: string }>(
            `INSERT INTO problem_sheets (user_id, name, file_path) VALUES ($1, $2, $3) RETURNING id`,
            [session.user.id, name, dataUri]
        );

        return NextResponse.json({ success: true, id: insertRes.rows[0].id });

    } catch (error) {
        console.error("Problem Sheets POST Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
