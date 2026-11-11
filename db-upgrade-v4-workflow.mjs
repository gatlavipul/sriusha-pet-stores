import sql from "./src/app/api/utils/sql.js";

async function runMigration() {
  console.log("Starting DB upgrade v4 for Single Source of Truth Order Workflow...");

  // 1. Add delivery_failure_reason and stock_restored columns to orders
  await sql`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS delivery_failure_reason TEXT,
    ADD COLUMN IF NOT EXISTS stock_restored BOOLEAN DEFAULT FALSE
  `;
  console.log("✓ orders columns verified (delivery_failure_reason, stock_restored)");

  // 2. Create admin_notifications table for system alerts (e.g. delivery failure)
  await sql`
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log("✓ admin_notifications table verified");

  // 3. Mark existing cancelled orders as stock_restored = TRUE
  await sql`
    UPDATE orders 
    SET stock_restored = TRUE 
    WHERE status = 'cancelled' AND (stock_restored IS NULL OR stock_restored = FALSE)
  `;
  console.log("✓ Existing cancelled orders marked as stock_restored = TRUE");

  // 4. Standardize any legacy 'processing' status to 'placed'
  await sql`
    UPDATE orders
    SET status = 'placed'
    WHERE status = 'processing'
  `;
  console.log("✓ Standardized legacy 'processing' orders to 'placed'");

  console.log("Database upgrade v4 completed successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
