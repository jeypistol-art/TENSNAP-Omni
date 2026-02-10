const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('Error: DATABASE_URL is not defined');
    process.exit(1);
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log("Usage: node scripts/simulate_org_date.js <email> <days_ago>");
        console.log("Example: node scripts/simulate_org_date.js user@example.com 6");
        process.exit(1);
    }

    const email = args[0];
    const daysAgo = parseInt(args[1]);

    const client = await pool.connect();
    try {
        console.log(`Searching for user: ${email}...`);

        // 1. Find User & Org
        const userRes = await client.query(`SELECT organization_id FROM users WHERE email = $1`, [email]);
        if (userRes.rows.length === 0) {
            console.error("User not found.");
            process.exit(1);
        }
        const orgId = userRes.rows[0].organization_id;

        if (!orgId) {
            console.error("User has no organization.");
            process.exit(1);
        }

        // 2. Update Org Created At
        const newDate = new Date();
        newDate.setDate(newDate.getDate() - daysAgo);

        await client.query(`UPDATE organizations SET created_at = $1 WHERE id = $2`, [newDate, orgId]);

        console.log(`✅ Updated Organization (${orgId}) created_at to: ${newDate.toISOString()} (${daysAgo} days ago)`);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
