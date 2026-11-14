import sql from '../src/app/api/utils/sql.js';

async function migrate() {
  console.log('Running address & user schema migrations...');
  try {
    // 1. Add phone to auth_users if it does not exist
    await sql`
      ALTER TABLE auth_users 
      ADD COLUMN IF NOT EXISTS phone TEXT;
    `;
    console.log('✓ auth_users.phone column ensured');

    // 2. Ensure user_addresses table exists and has all required fields
    await sql`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        clerk_user_id VARCHAR(255),
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        house_no TEXT,
        street_area TEXT,
        landmark TEXT,
        city TEXT NOT NULL DEFAULT 'Hyderabad',
        state TEXT NOT NULL DEFAULT 'Telangana',
        pincode VARCHAR(20) NOT NULL,
        label VARCHAR(50) NOT NULL DEFAULT 'Home',
        address_line TEXT,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    console.log('✓ user_addresses table ensured');

    // 3. Add any missing columns to existing user_addresses table
    await sql`ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(255);`;
    await sql`ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS house_no TEXT;`;
    await sql`ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS street_area TEXT;`;
    await sql`ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS landmark TEXT;`;
    await sql`ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS label VARCHAR(50) DEFAULT 'Home';`;
    await sql`ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`;
    console.log('✓ user_addresses columns (house_no, street_area, landmark, label, updated_at, clerk_user_id) ensured');

    // 4. Create index on user_id and clerk_user_id
    await sql`CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_addresses_clerk_user_id ON user_addresses(clerk_user_id);`;
    console.log('✓ user_addresses indexes ensured');

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();

