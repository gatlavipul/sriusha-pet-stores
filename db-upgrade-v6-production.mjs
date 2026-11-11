import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log("\n=======================================================");
  console.log("   SRI USHA — V6 PRODUCTION DATABASE HARDENING");
  console.log("=======================================================\n");

  // 1. Performance Indexes for Orders
  console.log("1. Creating targeted performance indexes on orders...");
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders (payment_status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders (order_number)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_delivery_partner ON orders (assigned_delivery_partner_id)`;
  console.log("  ✓ Orders indexes created.");

  // 2. Performance Indexes for Admin Notifications
  console.log("2. Creating targeted performance indexes on admin_notifications...");
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON admin_notifications (is_read)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_notifications_created_at ON admin_notifications (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications (type)`;
  console.log("  ✓ Admin notifications indexes created.");

  // 3. Performance Indexes for Products Catalog
  console.log("3. Creating targeted performance indexes on products...");
  await sql`CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_products_stock ON products (stock_quantity)`;
  console.log("  ✓ Products indexes created.");

  // 4. Foreign Key Hardening: Protect Historical Orders from Cascade Deletion
  console.log("4. Hardening orders.user_id foreign key (ON DELETE SET NULL)...");
  try {
    // Find existing constraint name
    const existingConstraints = await sql`
      SELECT tc.constraint_name 
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'orders' AND kcu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY'
    `;

    for (const row of existingConstraints) {
      await sql(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
      console.log(`  ✓ Dropped cascade constraint "${row.constraint_name}"`);
    }

    // Re-create with ON DELETE SET NULL
    await sql`
      ALTER TABLE orders 
      ADD CONSTRAINT orders_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES auth_users(id) 
      ON DELETE SET NULL
    `;
    console.log("  ✓ Added hardened constraint orders_user_id_fkey with ON DELETE SET NULL.");
  } catch (err) {
    console.warn("  ! Note on foreign key update:", err.message);
  }

  console.log("\n=======================================================");
  console.log("   V6 PRODUCTION DATABASE HARDENING COMPLETE!");
  console.log("=======================================================\n");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

