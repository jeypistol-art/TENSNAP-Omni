const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const connStr = process.env.DATABASE_URL.split('?')[0];
const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();

        console.log("Starting NextAuth Schema Migration...");

        // 1. Update USERS table
        console.log("Updating users table...");
        await client.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS name TEXT,
            ADD COLUMN IF NOT EXISTS email_verified TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS image TEXT;
        `);

        // 2. Create ACCOUNTS table
        console.log("Creating accounts table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                provider TEXT NOT NULL,
                provider_account_id TEXT NOT NULL,
                refresh_token TEXT,
                access_token TEXT,
                expires_at BIGINT,
                token_type TEXT,
                scope TEXT,
                id_token TEXT,
                session_state TEXT,
                UNIQUE(provider, provider_account_id)
            );
        `);

        // 3. Create VERIFICATION_TOKENS table
        console.log("Creating verification_tokens table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS verification_tokens (
                identifier TEXT NOT NULL,
                token TEXT NOT NULL,
                expires TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (identifier, token)
            );
        `);

        console.log("✅ Migration Complete.");

    } catch (e) {
        console.error("Migration Failed:", e);
    } finally {
        await client.end();
    }
}
main();
