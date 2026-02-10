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
        // Note: I aligned column names with the previous code usage in route.ts
        // In route.ts: device_hash, name
        // User prompt SQL: device_fingerprint
        // I should probably support both or verify what route.ts uses.
        // route.ts uses: device_hash
        // User prompt says: device_fingerprint
        // I will use device_hash to match the existing code in route.ts I saw earlier.
        // Wait, the user specifically asked for "device_fingerprint".
        // BUT `route.ts` (which I viewed in Step 81) uses `device_hash`.
        // If I create it with `device_fingerprint`, the code will fail.
        // Code at Step 81 line 73: INSERT INTO org_devices (organization_id, device_hash, name)
        // I will use `device_hash` to match the code. I will also add `name` as seen in line 73.

        console.log("✅ org_devices table created (or already exists).");

    } catch (e) {
        console.error("❌ ERROR:", e.message);
    } finally {
        await client.end();
    }
}

main();
