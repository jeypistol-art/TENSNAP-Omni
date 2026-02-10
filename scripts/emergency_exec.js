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

        console.log("Creating org_devices table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS org_devices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                organization_id UUID NOT NULL,
                device_hash TEXT NOT NULL, 
                name TEXT,
                last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ org_devices table created successfully.");

    } catch (e) {
        console.error("❌ ERROR:", e.message);
    } finally {
        await client.end();
    }
}

main();
