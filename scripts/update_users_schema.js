const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

console.log("Starting schema update...");

const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

if (!process.env.DATABASE_URL) {
    console.error("FATAL: DATABASE_URL not found in", envPath);
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000, // 5s timeout
});

async function run() {
    try {
        console.log("Connecting to DB...");

        // Use parallel promises for speed, but sequential is safer for logs
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT');
        console.log("✅ Added 'name'");

        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT');
        console.log("✅ Added 'image'");

        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP');
        console.log("✅ Added 'email_verified'");

        console.log("SUCCESS: Schema updated.");
    } catch (e) {
        console.error("ERROR during schema update:", e);
    } finally {
        console.log("Closing connection...");
        try { await pool.end(); } catch (e) { }
        console.log("Done.");
        process.exit(0);
    }
}

run();
