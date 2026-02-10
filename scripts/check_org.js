const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { Client } = require('pg');

let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) { console.error('NO DATABASE_URL'); process.exit(1); }
if (databaseUrl.includes('?')) databaseUrl = databaseUrl.split('?')[0];

const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log("Connected to DB.");

        const res = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'organization_id';
        `);

        if (res.rows.length === 0) {
            console.log("RESULT: MISSING");
        } else {
            console.log("RESULT: EXISTS");
        }

    } catch (e) {
        console.error("ERROR:", e.message);
    } finally {
        await client.end();
    }
}

main();
