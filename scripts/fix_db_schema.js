const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Error: DATABASE_URL is not defined');
    process.exit(1);
}

// Strip sslmode for this script to rely on explicit config
if (databaseUrl.includes('?')) {
    databaseUrl = databaseUrl.split('?')[0];
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false } // Force lenient SSL for migration tool
});

console.log("🚀 Migration Script Initialized.");

async function main() {
    const client = await pool.connect();
    try {
        console.log("🛠️ Starting DB Schema Fix (Aggressive)...");

        // 1. Organizations
        console.log("1. Checking 'organizations' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS organizations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT,
                stripe_customer_id TEXT,
                subscription_status TEXT DEFAULT 'trialing',
                trial_ends_at TIMESTAMP WITH TIME ZONE,
                plan_type TEXT DEFAULT 'monthly',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Org Devices
        console.log("2. Checking 'org_devices' table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS org_devices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID REFERENCES organizations(id),
                device_hash TEXT NOT NULL,
                name TEXT,
                last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Users - Add current_session_id
        console.log("3. Adding 'current_session_id' to users...");
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_id TEXT;`);
            console.log("   - current_session_id added/verified.");
        } catch (e) {
            console.error("   - Failed to add current_session_id:", e.message);
        }

        // 4. Users - Add organization_id
        console.log("4. Adding 'organization_id' to users...");
        try {
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);`);
            console.log("   - organization_id added/verified.");
        } catch (e) {
            console.error("   - Failed to add organization_id:", e.message);
        }

        // 5. Verification
        console.log("5. Verifying schema...");
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        const columns = res.rows.map(r => r.column_name);
        console.log("   - Users table columns:", columns.join(", "));

        if (columns.includes('current_session_id') && columns.includes('organization_id')) {
            console.log("✅ DB Schema Fix Verified Successfully!");
        } else {
            console.error("❌ Schema verification failed. Missing columns.");
        }

    } catch (e) {
        console.error("❌ Migration Script Error:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
