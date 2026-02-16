import { NextResponse } from "next/server";
import { runDataRetentionCleanup } from "@/lib/dataRetention";

type CleanupRequestBody = {
    dryRun?: unknown;
    batchSize?: unknown;
    trialGraceDays?: unknown;
    canceledGraceDays?: unknown;
};

function parseOptionalPositiveInt(value: unknown) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const num = Number.parseInt(String(value), 10);
    if (!Number.isFinite(num) || num <= 0) {
        return undefined;
    }
    return num;
}

export async function POST(request: Request) {
    try {
        const expectedSecret = process.env.DATA_RETENTION_CRON_SECRET;
        if (!expectedSecret) {
            return NextResponse.json(
                { error: "DATA_RETENTION_CRON_SECRET is not configured" },
                { status: 500 }
            );
        }

        const providedSecret = request.headers.get("x-retention-secret");
        if (!providedSecret || providedSecret !== expectedSecret) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json().catch(() => ({}))) as CleanupRequestBody;
        const dryRun = body.dryRun === true || body.dryRun === "true";
        const batchSize = parseOptionalPositiveInt(body.batchSize);
        const trialGraceDays = parseOptionalPositiveInt(body.trialGraceDays);
        const canceledGraceDays = parseOptionalPositiveInt(body.canceledGraceDays);

        const summary = await runDataRetentionCleanup({
            dryRun,
            batchSize,
            trialGraceDays,
            canceledGraceDays,
        });

        const hasErrors = summary.errors.length > 0;
        return NextResponse.json(summary, { status: hasErrors ? 207 : 200 });
    } catch (error) {
        console.error("Retention cleanup failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
