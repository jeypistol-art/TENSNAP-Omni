const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL.split('?')[0] + '?sslmode=verify-full', // Ensure SSL
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await client.connect();
        console.log("Connected to DB to fetch Organization ID...");

        // Get the most recently created organization
        const res = await client.query(`
            SELECT id FROM organizations ORDER BY created_at DESC LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.error("❌ No organizations found in DB.");
            process.exit(1);
        }

        const orgId = res.rows[0].id;
        console.log(`Target Organization ID: ${orgId}`);

        // Construct Fake Event
        const event = {
            type: "checkout.session.completed",
            data: {
                object: {
                    customer: "cus_test_simulated",
                    metadata: {
                        organization_id: orgId
                    }
                }
            }
        };

        const postData = JSON.stringify(event);

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/stripe/webhook',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        console.log("🚀 Sending simulated webhook event to localhost:3000...");

        const req = http.request(options, (res) => {
            console.log(`STATUS: ${res.statusCode}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                console.log(`BODY: ${chunk}`);
            });
            res.on('end', () => {
                console.log('✅ Simulation request completed.');
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Request failed: ${e.message}`);
        });

        req.write(postData);
        req.end();

    } catch (e) {
        console.error("❌ DB Error:", e.message);
    } finally {
        await client.end();
    }
}

main();
