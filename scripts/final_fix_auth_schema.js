const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

console.log("--- Antigravity Auth Schema Fix ---");

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

        // 1. Fix Users Table
        console.log("Checking 'users' table...");

        const userColsStart = await getColumns(client, 'users');
        console.log("Current columns:", userColsStart.join(", "));

        const userUpdates = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP"
        ];

        for (const sql of userUpdates) {
            console.log(`Executing: ${sql}`);
            await client.query(sql);
        }

        // 2. Check Verification Tokens (Just in case)
        console.log("Checking 'verification_tokens' table...");
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'verification_tokens'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log("Creating 'verification_tokens' table...");
            await client.query(`
                CREATE TABLE IF NOT EXISTS verification_tokens (
                    identifier TEXT NOT NULL,
                    token TEXT NOT NULL,
                    expires TIMESTAMP NOT NULL,
                    PRIMARY KEY (identifier, token)
                );
            `);
            console.log("Created 'verification_tokens'.");
        } else {
            console.log("'verification_tokens' already exists.");
        }

        // Final Verification
        const userColsEnd = await getColumns(client, 'users');
        console.log("Final 'users' columns:", userColsEnd.join(", "));

        const required = ['name', 'image', 'email_verified'];
        const missing = required.filter(c => !userColsEnd.includes(c));

        if (missing.length === 0) {
            console.log("✅ SUCCESS: All required columns exist!");
        } else {
            console.error("❌ FAILURE: Missing columns:", missing);
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
