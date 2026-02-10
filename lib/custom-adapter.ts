import type {
    Adapter,
    AdapterAccount,
    AdapterSession,
    AdapterUser,
    VerificationToken,
} from "next-auth/adapters";
import { query } from "@/lib/db";
import { randomUUID } from "crypto";

type UserRow = {
    id: string;
    name: string | null;
    email: string;
    email_verified: Date | null;
    image: string | null;
};

export function CustomPostgresAdapter(): Adapter {
    return {
        async createUser(user: Omit<AdapterUser, "id">) {
            // Create user
            const id = randomUUID();
            const res = await query<UserRow>(
                `INSERT INTO users (id, name, email, email_verified, image) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, name, email, email_verified, image`,
                [id, user.name || null, user.email, user.emailVerified || null, user.image || null]
            );
            const row = res.rows[0];
            return {
                id: row.id,
                name: row.name,
                email: row.email,
                emailVerified: row.email_verified,
                image: row.image
            };
        },
        async getUser(id: string) {
            const res = await query<UserRow>(`SELECT id, name, email, email_verified, image FROM users WHERE id = $1`, [id]);
            if (res.rows.length === 0) return null;
            const row = res.rows[0];
            return {
                id: row.id,
                name: row.name,
                email: row.email,
                emailVerified: row.email_verified,
                image: row.image
            };
        },
        async getUserByEmail(email: string) {
            const res = await query<UserRow>(`SELECT id, name, email, email_verified, image FROM users WHERE email = $1`, [email]);
            if (res.rows.length === 0) return null;
            const row = res.rows[0];
            return {
                id: row.id,
                name: row.name,
                email: row.email,
                emailVerified: row.email_verified,
                image: row.image
            };
        },
        async getUserByAccount({
            providerAccountId,
            provider,
        }: Pick<AdapterAccount, "provider" | "providerAccountId">) {
            const res = await query<UserRow>(
                `SELECT u.id, u.name, u.email, u.email_verified, u.image 
         FROM users u
         JOIN accounts a ON u.id = a.user_id 
         WHERE a.provider = $1 AND a.provider_account_id = $2`,
                [provider, providerAccountId]
            );
            if (res.rows.length === 0) return null;
            const row = res.rows[0];
            return {
                id: row.id,
                name: row.name,
                email: row.email,
                emailVerified: row.email_verified,
                image: row.image
            };
        },
        async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, "id">) {
            const res = await query<UserRow>(
                `UPDATE users SET name = $1, email_verified = $2, image = $3 WHERE id = $4 
         RETURNING id, name, email, email_verified, image`,
                [user.name, user.emailVerified, user.image, user.id]
            );
            const row = res.rows[0];
            return {
                id: row.id,
                name: row.name,
                email: row.email,
                emailVerified: row.email_verified,
                image: row.image
            };
        },
        async linkAccount(account: AdapterAccount) {
            await query(
                `INSERT INTO accounts (
           user_id, provider, type, provider_account_id, 
           refresh_token, access_token, expires_at, token_type, scope, id_token, session_state
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    account.userId,
                    account.provider,
                    account.type,
                    account.providerAccountId,
                    account.refresh_token,
                    account.access_token,
                    account.expires_at,
                    account.token_type,
                    account.scope,
                    account.id_token,
                    account.session_state,
                ]
            );
            return account;
        },
        async createSession(session: AdapterSession) {
            // Not used with JWT strategy usually, but required by interface
            return session;
        },
        async getSessionAndUser(sessionToken: string) {
            return null;
        },
        async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">) {
            return null;
        },
        async deleteSession(sessionToken: string) {
            return;
        },
        async createVerificationToken({ identifier, token, expires }: VerificationToken) {
            await query(
                `INSERT INTO verification_tokens (identifier, token, expires) VALUES ($1, $2, $3)`,
                [identifier, token, expires]
            );
            return { identifier, token, expires };
        },
        async useVerificationToken({
            identifier,
            token,
        }: Pick<VerificationToken, "identifier" | "token">) {
            const res = await query<VerificationToken>(
                `DELETE FROM verification_tokens WHERE identifier = $1 AND token = $2 RETURNING identifier, token, expires`,
                [identifier, token]
            );
            if (res.rows.length === 0) return null;
            const row = res.rows[0];
            return { identifier: row.identifier, token: row.token, expires: row.expires };
        },
    };
}
