const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

console.log("--- Configuring Auto UUID Generation ---");

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

        // 1. Ensure pgcrypto extension exists (often needed for gen_random_uuid in older PG, 
        //    though v13+ has it natively, pgcrypto is safe to include)
        try {
            await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
            console.log("✅ Extension 'pgcrypto' ensured.");
        } catch (e) {
            console.log("ℹ️ Note on pgcrypto:", e.message);
        }

        // 2. Set Default Value
        // Note: gen_random_uuid() is built-in for PG 13+. 
        // If older, pgcrypto provides gen_random_uuid().
        await client.query('ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid();');
        console.log("✅ ALTER TABLE users ALTER COLUMN id SET DEFAULT gen_random_uuid(); executed.");

        // 3. Verify
        const res = await client.query(`
            SELECT column_name, column_default
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'id';
        `);

        const col = res.rows[0];
        console.log(`\n🔍 Verification:`);
        console.log(`- Column: ${col.column_name}`);
        console.log(`- Default: ${col.column_default}`);

        if (col.column_default && col.column_default.includes('gen_random_uuid')) {
            console.log("✅ Success: ID column now auto-generates UUIDs.");
        } else {
            console.log("⚠️ Warning: Default value might not be set correctly.");
        }

    } catch (e) {
        console.error("❌ Error:", e);
    } finally {
        await client.end();
        console.log("--- Done ---");
    }
}

main();
