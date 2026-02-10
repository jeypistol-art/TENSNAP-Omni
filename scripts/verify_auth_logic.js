const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

console.log("--- Verifying Auth & Org Logic ---");

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

        // 1. Get most recent user
        const userRes = await client.query(`
            SELECT id, name, email, email_verified, image, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (userRes.rows.length === 0) {
            console.log("❌ No users found!");
            return;
        }

        const user = userRes.rows[0];
        console.log("\n👤 Most Recent User:");
        console.log(`- ID: ${user.id}`);
        console.log(`- Email: ${user.email}`);
        console.log(`- Name: ${user.name} (Type: ${typeof user.name})`);
        console.log(`- Created: ${user.created_at}`);

        // 2. Check Organization
        const orgRes = await client.query(`
            SELECT o.id, o.name, o.subscription_status, o.trial_ends_at, m.role
            FROM organizations o
            JOIN members m ON o.id = m.organization_id
            WHERE m.user_id = $1
        `, [user.id]);

        if (orgRes.rows.length === 0) {
            console.log("❌ No organization found for this user!");
        } else {
            const org = orgRes.rows[0];
            console.log("\n🏢 Organization Status:");
            console.log(`- Org ID: ${org.id}`);
            console.log(`- Org Name: ${org.name}`);
            console.log(`- Role: ${org.role}`);
            console.log(`- Status: ${org.subscription_status}`);
            console.log(`- Trial Ends: ${org.trial_ends_at}`);

            // Trial Validation
            const trialEnd = new Date(org.trial_ends_at);
            const now = new Date();
            const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

            console.log(`\n⏳ Trial Logic Check:`);
            if (org.subscription_status === 'trialing' && daysLeft > 13) {
                console.log(`✅ Organization created with ~14 days trial (${daysLeft} days left). Success!`);
            } else {
                console.log(`⚠️ Check Alert: Status is '${org.subscription_status}' and days left is ${daysLeft}.`);
            }
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}

main();
