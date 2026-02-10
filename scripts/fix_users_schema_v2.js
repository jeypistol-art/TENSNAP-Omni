const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

console.log("Loading env from:", envPath);
console.log("DB URL found:", !!process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("🚀 Starting Schema Fix...");

        // 1. Add name
        try {
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;`);
            console.log("✅ Added column: name (TEXT)");
        } catch (e) {
            console.error("❌ Failed to add name:", e.message);
        }

        // 2. Add email_verified
        try {
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP;`);
            console.log("✅ Added column: email_verified (TIMESTAMP)");
        } catch (e) {
            console.error("❌ Failed to add email_verified:", e.message);
        }

        // 3. Add image
        try {
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;`);
            console.log("✅ Added column: image (TEXT)");
        } catch (e) {
            console.error("❌ Failed to add image:", e.message);
        }

        // Verify
        console.log(" Verifying columns...");
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        console.table(res.rows.map(r => ({ col: r.column_name, type: r.data_type })));

    } catch (e) {
        console.error("🔥 Fatal Script Error:", e);
    } finally {
        await pool.end();
        console.log("👋 Connection Closed");
    }
}

run();
