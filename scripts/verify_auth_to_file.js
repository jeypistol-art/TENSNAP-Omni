const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false }
});

async function main() {
    let output = "--- VERIFICATION REPORT ---\n";
    try {
        await client.connect();

        // 1. User Check
        const userRes = await client.query(`
            SELECT id, name, email, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 1
        `);

        if (userRes.rows.length === 0) {
            output += "❌ No users found.\n";
        } else {
            const user = userRes.rows[0];
            output += `\n👤 User:\n`;
            output += `- Email: ${user.email}\n`;
            output += `- Name: ${user.name} (Type: ${typeof user.name})\n`;
            output += `- Created: ${user.created_at}\n`;

            // 2. Org Check
            const orgRes = await client.query(`
                SELECT o.name, o.subscription_status, o.trial_ends_at
                FROM organizations o
                JOIN members m ON o.id = m.organization_id
                WHERE m.user_id = $1
            `, [user.id]);

            if (orgRes.rows.length > 0) {
                const org = orgRes.rows[0];
                output += `\n🏢 Org:\n`;
                output += `- Name: ${org.name}\n`;
                output += `- Status: ${org.subscription_status}\n`;
                output += `- Trial Ends: ${org.trial_ends_at}\n`;

                const daysLeft = Math.ceil((new Date(org.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
                output += `- Days Left: ${daysLeft}\n`;
            } else {
                output += "❌ No Organization found for this user.\n";
            }
        }
    } catch (e) {
        output += `ERROR: ${e.message}\n`;
    } finally {
        await client.end();
        fs.writeFileSync(path.join(__dirname, '../verify_auth_output.txt'), output);
    }
}

main();
