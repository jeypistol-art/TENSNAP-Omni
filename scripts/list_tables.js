const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Proven Connection Logic
const connStr = process.env.DATABASE_URL.split('?')[0];
const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
main();
