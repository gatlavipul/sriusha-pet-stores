import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Running delivery roles database migration...');

  // 1. Create delivery_staff table
  await sql`
    CREATE TABLE IF NOT EXISTS delivery_staff (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'delivery',
      status TEXT NOT NULL DEFAULT 'active',
      added_by TEXT,
      clerk_user_id TEXT,
      user_id INT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✓ Created or verified delivery_staff table');

  // 2. Create user_roles table for role tracking
  await sql`
    CREATE TABLE IF NOT EXISTS user_roles (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'delivery',
      status TEXT NOT NULL DEFAULT 'active',
      added_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('✓ Created or verified user_roles table');

  // 3. Create indexes individually
  await sql`CREATE INDEX IF NOT EXISTS idx_delivery_staff_email ON delivery_staff(LOWER(email))`;
  await sql`CREATE INDEX IF NOT EXISTS idx_delivery_staff_status ON delivery_staff(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(LOWER(email))`;
  console.log('✓ Created indexes on delivery_staff & user_roles');

  // 4. Ensure orders table has picked_up_at and delivered_at timestamp columns
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`;
  console.log('✓ Added picked_up_at and delivered_at columns to orders');

  // 5. Inspect existing delivery_staff rows
  const existingStaff = await sql`SELECT * FROM delivery_staff`;
  console.log('Current delivery_staff rows count:', existingStaff.length);

  console.log('Migration completed successfully!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
