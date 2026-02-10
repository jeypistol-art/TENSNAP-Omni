const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

console.log("Connecting to:", process.env.DATABASE_URL);

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

async function main() {
    await client.connect();
    console.log("Connected.");

    try {
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT");
        console.log("Added name");

        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT");
        console.log("Added image");

        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified TIMESTAMP");
        console.log("Added email_verified");

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
        console.log("Done.");
    }
}

main();
