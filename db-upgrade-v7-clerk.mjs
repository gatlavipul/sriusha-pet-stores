import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log("\n=======================================================");
  console.log("   SRI USHA — V7 CLERK & CLOUDFLARE MIGRATION SCHEMA");
  console.log("=======================================================\n");

  // 1. Add clerk_user_id to auth_users if not exists
  console.log("1. Adding clerk_user_id column to auth_users...");
  await sql`
    ALTER TABLE auth_users 
    ADD COLUMN IF NOT EXISTS clerk_user_id VARCHAR(255) UNIQUE
  `;
  console.log("  ✓ Column clerk_user_id ready.");

  // 2. Add performance index on clerk_user_id
  console.log("2. Creating index on clerk_user_id...");
  await sql`
    CREATE INDEX IF NOT EXISTS idx_auth_users_clerk_user_id 
    ON auth_users (clerk_user_id)
  `;
  console.log("  ✓ Index idx_auth_users_clerk_user_id ready.");

  // 3. Ensure index on email and role exist for fast lookups
  console.log("3. Creating index on auth_users (email) and (role)...");
  await sql`
    CREATE INDEX IF NOT EXISTS idx_auth_users_email 
    ON auth_users (email)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_auth_users_role 
    ON auth_users (role)
  `;
  console.log("  ✓ Indexes on email and role ready.");

  // 4. Verify existing admin, customer, and delivery partner accounts
  console.log("4. Verifying user roles count...");
  const roleCounts = await sql`
    SELECT role, COUNT(*)::int as count 
    FROM auth_users 
    GROUP BY role
  `;
  console.log("  Current role distribution:", roleCounts);

  console.log("\n✓ Migration v7 completed successfully.\n");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
