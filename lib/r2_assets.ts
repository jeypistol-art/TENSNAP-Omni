import { getCloudflareContext } from "@opennextjs/cloudflare";

export const R2_ASSETS_BUCKET_NAME = "tensnap-omni-assets";
export const R2_ASSETS_BINDING = "TENSNAP_OMNI_ASSETS";

type MinimalR2Bucket = {
    put: (
        key: string,
        value: ArrayBuffer | ArrayBufferView,
        options?: {
            httpMetadata?: { contentType?: string };
            customMetadata?: Record<string, string>;
        }
    ) => Promise<unknown>;
};

type ScanCategory = "answer" | "problem" | "problem-library";

const sanitizeFileName = (name: string) => {
    const trimmed = (name || "file").trim();
    const safe = trimmed.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "_");
    return safe.length > 0 ? safe : "file";
};

export type PreparedUploadFile = {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
};

export async function getR2AssetsBucket(): Promise<MinimalR2Bucket | null> {
    try {
        const { env } = await getCloudflareContext({ async: true });
        const bucket = (env as Record<string, unknown>)[R2_ASSETS_BINDING] as MinimalR2Bucket | undefined;
        if (!bucket || typeof bucket.put !== "function") {
            return null;
        }
        return bucket;
    } catch (error) {
        console.warn("R2 context unavailable:", error);
        return null;
    }
}

export function buildScanObjectKey(args: {
    tenantId: string;
    userId: string;
    traceId: string;
    category: ScanCategory;
    index: number;
    fileName: string;
}) {
    const date = new Date().toISOString().slice(0, 10);
    const safeName = sanitizeFileName(args.fileName);
    return `scans/${args.tenantId}/${args.userId}/${date}/${args.traceId}/${args.category}/${String(args.index + 1).padStart(2, "0")}-${safeName}`;
}

export async function uploadPreparedFilesToR2(args: {
    bucket: MinimalR2Bucket;
    tenantId: string;
    userId: string;
    traceId: string;
    category: ScanCategory;
    files: PreparedUploadFile[];
}) {
    const keys: string[] = [];
    for (let i = 0; i < args.files.length; i++) {
        const file = args.files[i];
        const key = buildScanObjectKey({
            tenantId: args.tenantId,
            userId: args.userId,
            traceId: args.traceId,
            category: args.category,
            index: i,
            fileName: file.originalName,
        });

        await args.bucket.put(key, file.buffer, {
            httpMetadata: {
                contentType: file.mimeType || "application/octet-stream",
            },
            customMetadata: {
                originalName: file.originalName || "file",
                uploadedAt: new Date().toISOString(),
            },
        });
        keys.push(key);
    }
    return keys;
}
