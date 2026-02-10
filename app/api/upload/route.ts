import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getTenantId } from "@/lib/tenant";
import { query } from "@/lib/db";
import { analyzeImage } from "@/lib/ocr_service";

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Resolve Tenant
        const tenantId = await getTenantId(session.user.id, session.user.email);

        // 2. Process File & Context
        const formData = await request.formData();

        // Multi-file extraction
        const fileEntries = formData.getAll("file") as File[];
        const problemSheetEntries = formData.getAll("problemSheet") as File[];
        const formUnitName = formData.get("unitName") as string | undefined;
        const examPhaseRaw = formData.get("examPhase");
        const examPhase = examPhaseRaw === "true" || examPhaseRaw === "1";

        if (fileEntries.length === 0) {
            return NextResponse.json({ error: "No answer sheet uploaded" }, { status: 400 });
        }

        // Helper to convert File[] to { buffer, mimeType }[]
        const processFiles = async (files: File[]) => {
            return Promise.all(files.map(async (f) => ({
                buffer: Buffer.from(await f.arrayBuffer()),
                mimeType: f.type
            })));
        };

        const answerSheets = await processFiles(fileEntries);
        const problemSheets = await processFiles(problemSheetEntries);

        // "Shortest Path" MVP: 
        // We still save a fake path in DB because we aren't setting up S3 yet.
        // We just use the first file's name for now as the representative record.
        const fakeFilePath = `/uploads/${tenantId}/${fileEntries[0].name}-multi-${Date.now()}`;

        const studentId = formData.get("studentId") as string | null; // Optional: Linked Student ID

        // 3. Save Upload Record (with Student ID)
        // Insert into uploads table
        const uploadResult = await query<{ id: string }>(
            `INSERT INTO uploads (user_id, student_id, file_path, status) VALUES ($1, $2, $3, $4) RETURNING id`,
            [session.user.id, studentId || null, fakeFilePath, 'processing']
        );
        const uploadId = uploadResult.rows[0].id;

        const subject = (formData.get("subject") as string) || "Math"; // Default to Math if missing

        // 4. Perform Analysis
        const analysis = await analyzeImage(answerSheets, {
            unitName: formUnitName, // Use the unitName from the form data
            subject: subject || undefined,
            problemSheets,
            examPhase,
        });

        // 5. Save Analysis
        // Mapping Semantic Analysis JSON (v4) to DB columns
        // analyses table: score, formula, range, details
        // SaaS columns: student_id, user_id, subject, unit_name, test_score, max_score, comprehension_score

        // Defensive: Parse score safely from string "75/100" or number
        let scoreInt = 0;
        let maxScoreInt = 100;

        if (typeof analysis.test_score === 'number') {
            scoreInt = analysis.test_score;
        } else if (typeof analysis.test_score === 'string') {
            const parts = analysis.test_score.split('/');
            scoreInt = parseInt(parts[0]) || 0;
            if (parts.length > 1) maxScoreInt = parseInt(parts[1]) || 100;
        }

        // Defensive: Ensure array for topics
        const topics = Array.isArray(analysis.covered_topics)
            ? analysis.covered_topics
            : [];

        // Ensure array for weakness_areas
        const weaknessAreas = Array.isArray(analysis.weakness_areas)
            ? analysis.weakness_areas
            : [];

        // Determine Unit Name and Subject
        // Priority: Form Input > AI Detected Topic > Fallback
        const derivedUnitName = formUnitName || (topics.length > 0 ? topics[0] : "General");
        const testDate = (formData.get("testDate") as string) || new Date().toISOString().split('T')[0];

        await query(
            `INSERT INTO analyses (
                upload_id, 
                user_id, 
                student_id, 
                score, 
                test_score, 
                max_score, 
                comprehension_score,
                subject, 
                unit_name,
                test_date,
                formula, 
                range, 
                details
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                uploadId,
                session.user.id,
                studentId || null,
                scoreInt, // Legacy 'score' column
                scoreInt, // New 'test_score' column
                maxScoreInt,
                analysis.comprehension_score || 0,
                subject,
                derivedUnitName,
                testDate,
                // Map "Covered Topics" to "Formula" column (as text, List)
                topics.join(", "),
                // Map Weakness Areas to "Range" (Visual Debugging)
                weaknessAreas.map((w: any) => `${w.level === 'Primary' ? '🔴' : '🟡'}${w.topic}`).join(", "),
                // Store full semantic details in JSONB (Future Proofing)
                JSON.stringify(analysis)
            ]
        );
        // Note: Raw query above presumed void if no RETURNING. 
        // Need to change query to return ID.

        const analysisIdRes = await query<{ id: string }>(
            `SELECT id FROM analyses WHERE upload_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [uploadId]
        );
        const analysisId = analysisIdRes.rows[0]?.id;
        // 6. Update Upload Status to 'completed'
        await query(
            `UPDATE uploads SET status = 'completed' WHERE id = $1`,
            [uploadId]
        );

        return NextResponse.json({
            success: true,
            analysis: {
                ...analysis,
                exam_phase: examPhase,
                test_score_raw: analysis.raw_test_score ?? analysis.test_score
            },
            uploadId,
            analysisId,
            studentId
        });
    } catch (error) {
        console.error("Upload/Analysis error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: String(error) },
            { status: 500 }
        );
    }
}
