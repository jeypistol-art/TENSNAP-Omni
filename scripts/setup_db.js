const path = require('path');
// Load environment variables from .env.local before anything else
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('Error: DATABASE_URL is not defined in .env.local or environment');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  console.log('Starting DB Setup Script...');
  const client = await pool.connect();
  try {
    console.log('Connected to database. Initializing schema...');

    await client.query('BEGIN');

    // 0. Organizations Table (SaaS Tenant) - [NEW]
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT, -- User can set this later, or default to "My Organization"
        stripe_customer_id TEXT,
        subscription_status TEXT DEFAULT 'trialing', -- Default to trial
        trial_ends_at TIMESTAMP WITH TIME ZONE,
        plan_type TEXT DEFAULT 'monthly',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Verified table: organizations');

    // 0.5. Org Devices Table (Security Gatekeeper) - [NEW]
    await client.query(`
        CREATE TABLE IF NOT EXISTS org_devices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            organization_id UUID REFERENCES organizations(id),
            device_hash TEXT NOT NULL,
            name TEXT,
            last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);
    // Index for fast lookup
    await client.query(`CREATE INDEX IF NOT EXISTS idx_org_devices_lookup ON org_devices(organization_id, device_hash);`);
    console.log('Verified table: org_devices');

    // 1. Users Table (Maps Auth ID to Tenant)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        tenant_id UUID DEFAULT gen_random_uuid(),
        stripe_customer_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: Add SaaS columns to users
    await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
        ADD COLUMN IF NOT EXISTS current_session_id TEXT;
    `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
    `);

    console.log('Verified table: users');

    // 2. Students Table (NEW)
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT REFERENCES users(id),
        name TEXT NOT NULL,
        grade TEXT,
        target_school TEXT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: Add new columns if table exists
    console.log('Migrating students table...');
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS target_school TEXT;`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS notes TEXT;`);
    console.log('Verified table: students');

    // 3. Uploads Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT REFERENCES users(id),
        file_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Migration: Add student_id to uploads
    await client.query(`
      ALTER TABLE uploads 
      ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id),
      ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'answer_sheet';
    `);
    console.log('Verified table: uploads');

    // 4. Analyses Table (OCR Results)
    await client.query(`
      CREATE TABLE IF NOT EXISTS analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        upload_id UUID REFERENCES uploads(id),
        score INTEGER,
        formula TEXT,
        range TEXT,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Migration: Add new SaaS columns to analyses
    await client.query(`
      ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES students(id),
      ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT 'Math',
      ADD COLUMN IF NOT EXISTS unit_name TEXT,
      ADD COLUMN IF NOT EXISTS test_score INTEGER,
      ADD COLUMN IF NOT EXISTS max_score INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS comprehension_score INTEGER,
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS test_date DATE DEFAULT CURRENT_DATE;
    `);
    console.log('Verified table: analyses');

    // 5. Problem Sheets Table (Context)
    await client.query(`
      CREATE TABLE IF NOT EXISTS problem_sheets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT REFERENCES users(id),
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Verified table: problem_sheets');

    await client.query('COMMIT');
    console.log('Database setup completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
