const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    console.log('Starting migration...');
    const client = await pool.connect();
    try {
        console.log('Adding test_date column to analyses...');
        await client.query(`
      ALTER TABLE analyses 
      ADD COLUMN IF NOT EXISTS test_date DATE DEFAULT CURRENT_DATE;
    `);
        console.log('Success: test_date column added.');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        client.release();
        await pool.end();
        console.log('Done.');
        process.exit(0);
    }
}

migrate();
