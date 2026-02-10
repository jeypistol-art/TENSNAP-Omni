const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// CLEAN CONNECTION STRING
// Remove any query parameters like ?sslmode=verify-full
const connStr = process.env.DATABASE_URL.split('?')[0];

console.log("Attempting connection to:", connStr.replace(/:[^:]*@/, ':***@')); // Hide password

const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false } // Force accept self-signed/unverified certs
});

async function main() {
    console.log("Connecting...");
    try {
        await client.connect();
        console.log("Connected! Finding latest organization...");

        // 1. Find Org
        const res = await client.query(`
            SELECT id, name, subscription_status 
            FROM organizations 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.error("No organizations found!");
            return;
        }

        const org = res.rows[0];
        console.log("Found Org:", org);

        // 2. Force Update
        console.log("Updating to 'active'...");
        const updateRes = await client.query(`
            UPDATE organizations 
            SET subscription_status = 'active', 
                stripe_customer_id = 'cus_forced_manual',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [org.id]);

        console.log("✅ Update Success:", updateRes.rows[0]);

    } catch (e) {
        console.error("❌ DB Error:", e);
    } finally {
        await client.end();
        console.log("Disconnected.");
    }
}
main();
