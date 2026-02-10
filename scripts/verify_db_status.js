const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const client = new Client({
    connectionString: process.env.DATABASE_URL.split('?')[0] + '?sslmode=verify-full',
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log("Connecting...");
    try {
        await client.connect();
        console.log("Connected. Querying...");
        const res = await client.query(`
            SELECT id, name, subscription_status, stripe_customer_id, updated_at 
            FROM organizations 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.table(res.rows);
    } catch (e) {
        console.error("Query Error:", e);
    } finally {
        await client.end();
        console.log("Done.");
    }
}
main();
