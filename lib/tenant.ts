import { query } from "@/lib/db";

// Ensure the user exists in our DB and return their tenant_id
// Call this after validating the session in the App Router
// Ensure the user exists in our DB and return their Organization ID (Tenant ID)
// Call this after validating the session in the App Router
export async function getTenantId(userId?: string | null, email?: string | null): Promise<string> {
    let resolvedUserId = userId || null;

    // Defensive fallback: older tokens/sessions may miss `user.id`.
    if (!resolvedUserId && email) {
        const byEmail = await query<{ id: string }>(
            `SELECT id FROM users WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
            [email]
        );
        if (byEmail.rows.length > 0) {
            resolvedUserId = byEmail.rows[0].id;
        }
    }

    if (!resolvedUserId) {
        throw new Error("Session user id is missing and could not be resolved");
    }

    // 1. Try to find the user and their organization
    const result = await query<{ tenant_id: string, organization_id: string | null }>(
        `SELECT tenant_id, organization_id FROM users WHERE id = $1`,
        [resolvedUserId]
    );

    let orgId: string | null = null;

    if (result.rows.length > 0) {
        orgId = result.rows[0].organization_id;
    } else {
        // 2. If user not found, create new user
        // We use ON CONFLICT just in case of race conditions, though basic SELECT check handles most.
        await query<{ tenant_id: string }>(
            `INSERT INTO users (id, email) VALUES ($1, $2) RETURNING tenant_id`,
            [resolvedUserId, email || null]
        );
    }

    // 3. If User has no Organization, Creation One (Registration Flow)
    if (!orgId) {
        // Create Organization
        // Name defaults to "[User]'s Organization" or just "My Organization"
        const orgName = email ? `${email.split('@')[0]}'s Organization` : "New Organization";

        // Trial Logic: 14 Days from now
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);

        const orgResult = await query<{ id: string }>(
            `INSERT INTO organizations (name, subscription_status, trial_ends_at, plan_type) 
             VALUES ($1, 'trialing', $2, 'monthly') 
             RETURNING id`,
            [orgName, trialEnd]
        );
        orgId = orgResult.rows[0].id;

        // Link User to Organization
        await query(
            `UPDATE users SET organization_id = $1 WHERE id = $2`,
            [orgId, resolvedUserId]
        );
    }

    return orgId;
}
