const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const client = new Client({
    connectionString: process.env.DATABASE_URL.split('?')[0],
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        const res = await client.query('SELECT id, subscription_status FROM organizations ORDER BY created_at DESC LIMIT 1');
        console.log("Organization Status:", res.rows[0]);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
