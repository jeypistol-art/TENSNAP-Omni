const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { Client } = require('pg');

let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Error: DATABASE_URL is not defined');
    process.exit(1);
}

// Strip sslmode for this script to rely on explicit config
if (databaseUrl.includes('?')) {
    databaseUrl = databaseUrl.split('?')[0];
}

const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log("Connected to DB.");

        console.log("Executing: ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_id TEXT;");
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_id TEXT;`);

        console.log("✅ SUCCESS: Column 'current_session_id' added (or already existed).");

    } catch (e) {
        console.error("❌ ERROR:", e.message);
    } finally {
        await client.end();
    }
}

main();
