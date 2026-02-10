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
        console.log("Adding name_kana to students table...");
        await client.query(`
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS name_kana TEXT;
        `);
        console.log("✅ students table updated.");
    } catch (e) { console.error(e); } finally { await client.end(); }
}
main();
