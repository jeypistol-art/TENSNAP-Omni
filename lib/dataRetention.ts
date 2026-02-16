import { query } from "@/lib/db";

type RetentionCandidate = {
    id: string;
    purge_reason: "trial_grace_elapsed" | "canceled_grace_elapsed";
};

type TableCountRow = {
    count: string;
};

export type RetentionCleanupOptions = {
    dryRun?: boolean;
    trialGraceDays?: number;
    canceledGraceDays?: number;
    batchSize?: number;
};

export type RetentionCleanupSummary = {
    dryRun: boolean;
    trialGraceDays: number;
    canceledGraceDays: number;
    batchSize: number;
    scannedOrganizations: number;
    processedOrganizations: number;
    purgedOrganizations: number;
    purgedUsers: number;
    deletedRows: {
        analyses: number;
        uploads: number;
        problem_sheets: number;
        students: number;
        org_devices: number;
    };
    details: Array<{
        organizationId: string;
        reason: string;
        users: number;
        estimates?: {
            analyses: number;
            uploads: number;
            problem_sheets: number;
            students: number;
            org_devices: number;
        };
    }>;
    errors: Array<{
        organizationId: string;
        error: string;
    }>;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}

async function ensureRetentionColumns() {
    await query(
        `ALTER TABLE organizations
         ADD COLUMN IF NOT EXISTS data_purged_at TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS purge_reason TEXT`
    );
}

async function getCandidates(args: {
    trialGraceDays: number;
    canceledGraceDays: number;
    batchSize: number;
}) {
    const result = await query<RetentionCandidate>(
        `SELECT id,
                CASE
                    WHEN subscription_status = 'canceled'
                         AND updated_at <= NOW() - ($1::int * INTERVAL '1 day')
                        THEN 'canceled_grace_elapsed'
                    ELSE 'trial_grace_elapsed'
                END AS purge_reason
         FROM organizations
         WHERE data_purged_at IS NULL
           AND (
                (subscription_status IN ('trialing', 'trial')
                 AND trial_ends_at IS NOT NULL
                 AND trial_ends_at <= NOW() - ($2::int * INTERVAL '1 day'))
                OR
                (subscription_status = 'canceled'
                 AND updated_at <= NOW() - ($1::int * INTERVAL '1 day'))
               )
         ORDER BY updated_at ASC
         LIMIT $3`,
        [args.canceledGraceDays, args.trialGraceDays, args.batchSize]
    );
    return result.rows;
}

async function getOrganizationUserIds(organizationId: string) {
    const users = await query<{ id: string }>(
        `SELECT id FROM users WHERE organization_id = $1`,
        [organizationId]
    );
    return users.rows.map((r) => r.id);
}

async function getCount(sqlText: string, params: unknown[]) {
    const result = await query<TableCountRow>(sqlText, params);
    return Number.parseInt(result.rows[0]?.count || "0", 10);
}

export async function runDataRetentionCleanup(
    options: RetentionCleanupOptions = {}
): Promise<RetentionCleanupSummary> {
    const dryRun = options.dryRun === true;
    const trialGraceDays =
        options.trialGraceDays ??
        parsePositiveInt(process.env.DATA_RETENTION_TRIAL_GRACE_DAYS, 14);
    const canceledGraceDays =
        options.canceledGraceDays ??
        parsePositiveInt(process.env.DATA_RETENTION_CANCELED_GRACE_DAYS, 30);
    const batchSize =
        options.batchSize ??
        parsePositiveInt(process.env.DATA_RETENTION_BATCH_SIZE, 50);

    await ensureRetentionColumns();
    const candidates = await getCandidates({
        trialGraceDays,
        canceledGraceDays,
        batchSize,
    });

    const summary: RetentionCleanupSummary = {
        dryRun,
        trialGraceDays,
        canceledGraceDays,
        batchSize,
        scannedOrganizations: candidates.length,
        processedOrganizations: 0,
        purgedOrganizations: 0,
        purgedUsers: 0,
        deletedRows: {
            analyses: 0,
            uploads: 0,
            problem_sheets: 0,
            students: 0,
            org_devices: 0,
        },
        details: [],
        errors: [],
    };

    for (const org of candidates) {
        try {
            const userIds = await getOrganizationUserIds(org.id);
            const userCount = userIds.length;
            summary.processedOrganizations += 1;
            summary.purgedUsers += userCount;

            const detail: RetentionCleanupSummary["details"][number] = {
                organizationId: org.id,
                reason: org.purge_reason,
                users: userCount,
            };

            if (dryRun) {
                const estimates = {
                    analyses: 0,
                    uploads: 0,
                    problem_sheets: 0,
                    students: 0,
                    org_devices: await getCount(
                        `SELECT COUNT(*)::text AS count FROM org_devices WHERE organization_id = $1`,
                        [org.id]
                    ),
                };

                if (userCount > 0) {
                    estimates.students = await getCount(
                        `SELECT COUNT(*)::text AS count FROM students WHERE user_id = ANY($1::text[])`,
                        [userIds]
                    );
                    estimates.uploads = await getCount(
                        `SELECT COUNT(*)::text AS count FROM uploads WHERE user_id = ANY($1::text[])`,
                        [userIds]
                    );
                    estimates.problem_sheets = await getCount(
                        `SELECT COUNT(*)::text AS count FROM problem_sheets WHERE user_id = ANY($1::text[])`,
                        [userIds]
                    );
                    estimates.analyses = await getCount(
                        `SELECT COUNT(*)::text AS count
                         FROM analyses
                         WHERE user_id = ANY($1::text[])
                            OR student_id IN (SELECT id FROM students WHERE user_id = ANY($1::text[]))
                            OR upload_id IN (SELECT id FROM uploads WHERE user_id = ANY($1::text[]))`,
                        [userIds]
                    );
                }

                detail.estimates = estimates;
                summary.details.push(detail);
                continue;
            }

            let deletedAnalyses = 0;
            let deletedUploads = 0;
            let deletedProblemSheets = 0;
            let deletedStudents = 0;
            if (userCount > 0) {
                const analysesDeleteRes = await query(
                    `DELETE FROM analyses
                     WHERE user_id = ANY($1::text[])
                        OR student_id IN (SELECT id FROM students WHERE user_id = ANY($1::text[]))
                        OR upload_id IN (SELECT id FROM uploads WHERE user_id = ANY($1::text[]))
                     RETURNING id`,
                    [userIds]
                );
                deletedAnalyses = analysesDeleteRes.rowCount;

                const uploadsDeleteRes = await query(
                    `DELETE FROM uploads
                     WHERE user_id = ANY($1::text[])
                     RETURNING id`,
                    [userIds]
                );
                deletedUploads = uploadsDeleteRes.rowCount;

                const problemSheetsDeleteRes = await query(
                    `DELETE FROM problem_sheets
                     WHERE user_id = ANY($1::text[])
                     RETURNING id`,
                    [userIds]
                );
                deletedProblemSheets = problemSheetsDeleteRes.rowCount;

                const studentsDeleteRes = await query(
                    `DELETE FROM students
                     WHERE user_id = ANY($1::text[])
                     RETURNING id`,
                    [userIds]
                );
                deletedStudents = studentsDeleteRes.rowCount;
            }

            const orgDevicesDeleteRes = await query(
                `DELETE FROM org_devices
                 WHERE organization_id = $1
                 RETURNING id`,
                [org.id]
            );

            await query(
                `UPDATE organizations
                 SET subscription_status = 'canceled',
                     trial_ends_at = NULL,
                     data_purged_at = CURRENT_TIMESTAMP,
                     purge_reason = $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [org.id, org.purge_reason]
            );

            summary.purgedOrganizations += 1;
            summary.deletedRows.analyses += deletedAnalyses;
            summary.deletedRows.uploads += deletedUploads;
            summary.deletedRows.problem_sheets += deletedProblemSheets;
            summary.deletedRows.students += deletedStudents;
            summary.deletedRows.org_devices += orgDevicesDeleteRes.rowCount;
            summary.details.push(detail);
        } catch (error) {
            summary.errors.push({
                organizationId: org.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return summary;
}
