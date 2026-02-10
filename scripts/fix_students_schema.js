const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

console.log("--- Fixing Students Schema (name_kana) ---");

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log("Connected to DB.");

        console.log("Adding 'name_kana' to 'students' table...");

        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS name_kana TEXT;`);

        console.log("✅ 'name_kana' column added successfully.");

        // Verification
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'students' AND column_name = 'name_kana';
        `);

        if (res.rows.length > 0) {
            console.log("🔍 Verified: name_kana exists (Type: " + res.rows[0].data_type + ")");
        } else {
            console.error("❌ Verification Failed: Column still missing.");
        }

    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await client.end();
        console.log("--- Done ---");
    }
}

main();
