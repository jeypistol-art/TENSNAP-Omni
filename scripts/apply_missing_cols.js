const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

console.log("--- Starting Schema Fix ---");

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env.local:", result.error);
    process.exit(1);
}

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is missing!");
    process.exit(1);
}

console.log("DB connection string found.");

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log("Connected to database.");

        const queries = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP;"
        ];

        for (const q of queries) {
            console.log(`Executing: ${q}`);
            await client.query(q);
        }

        console.log("✅ All columns added successfully.");

        // Verification
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        const cols = res.rows.map(r => r.column_name);
        console.log("Current columns in 'users' table:", cols.join(", "));

    } catch (e) {
        console.error("❌ Error executing migration:", e);
    } finally {
        await client.end();
        console.log("--- Done ---");
    }
}

main();
