const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Proven Connection Logic
const connStr = process.env.DATABASE_URL.split('?')[0];
const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();

        console.log("Creating verification_tokens table...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS verification_tokens (
                identifier TEXT NOT NULL,
                token TEXT NOT NULL,
                expires TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (identifier, token)
            );
        `);
        console.log("✅ verification_tokens table created.");

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
