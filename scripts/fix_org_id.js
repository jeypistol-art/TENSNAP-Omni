const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { Client } = require('pg');

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error('NO DATABASE_URL'); process.exit(1); }
if (databaseUrl.includes('?')) databaseUrl = databaseUrl.split('?')[0];

const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log("Connected to DB.");

        console.log("checking organizations table...");
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

        console.log("Checking users.organization_id...");
        // Check if column exists
        const res = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'organization_id';
        `);

        if (res.rows.length === 0) {
            console.log("⚠️ organization_id MISSING. Adding it now...");
            await client.query(`
                ALTER TABLE users 
                ADD COLUMN organization_id UUID REFERENCES organizations(id);
            `);
            console.log("✅ organization_id added.");
        } else {
            console.log("✅ organization_id already exists.");
        }

    } catch (e) {
        console.error("❌ ERROR:", e.message);
    } finally {
        await client.end();
    }
}

main();
