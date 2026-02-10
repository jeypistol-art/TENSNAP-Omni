const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const connStr = process.env.DATABASE_URL.split('?')[0];
const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.table(res.rows);
    } catch (e) { console.error(e); } finally { await client.end(); }
}
main();
