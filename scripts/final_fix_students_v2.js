const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

console.log("--- Antigravity Student Schema Fix ---");

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env.local:", result.error);
    process.exit(1);
}

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log("Connected to DB.");

        // 1. Check current columns
        console.log("Checking 'students' table...");
        const colsBefore = await getColumns(client, 'students');
        console.log("Current columns:", colsBefore.join(", "));

        if (colsBefore.includes('name_kana')) {
            console.log("ℹ️ 'name_kana' already exists.");
        } else {
            console.log("Adding 'name_kana'...");
            await client.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS name_kana TEXT DEFAULT '';");
            console.log("✅ Executed ALTER TABLE.");
        }

        // 2. Verify
        const colsAfter = await getColumns(client, 'students');
        console.log("Final columns:", colsAfter.join(", "));

        if (colsAfter.includes('name_kana')) {
            console.log("✅ SUCCESS: 'name_kana' is present.");
        } else {
            console.error("❌ FAILURE: 'name_kana' is STILL MISSING.");
            process.exit(1);
        }

    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    } finally {
        await client.end();
        console.log("--- Disconnected ---");
    }
}

async function getColumns(client, tableName) {
    const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1;
    `, [tableName]);
    return res.rows.map(r => r.column_name);
}

main();
