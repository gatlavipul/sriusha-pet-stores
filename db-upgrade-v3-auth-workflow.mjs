import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log("Starting DB upgrade v3 for Auth & Role-based Delivery Workflow...");

  // 1. Ensure assigned_delivery_partner_id column on orders table
  await sql`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS assigned_delivery_partner_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL
  `;
  console.log("✓ orders.assigned_delivery_partner_id verified");

  // 2. Create order_status_history table
  await sql`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      changed_by_user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
      changed_by_role TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log("✓ order_status_history table verified");

  // Index on order_id for fast order timeline queries
  await sql`
    CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id)
  `;

  // 3. Create admin_audit_logs table
  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id SERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
      details JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log("✓ admin_audit_logs table verified");

  // 4. Ensure any null roles default to 'customer'
  await sql`
    UPDATE auth_users 
    SET role = 'customer' 
    WHERE role IS NULL OR role = ''
  `;
  console.log("✓ auth_users default roles standardized");

  // 5. Seed or verify a designated delivery partner user for testing/operations
  const deliveryEmail = "delivery@sriusha.com";
  const existingDelivery = await sql`
    SELECT id, email, role FROM auth_users WHERE email = ${deliveryEmail} LIMIT 1
  `;

  let deliveryUserId;
  if (existingDelivery.length === 0) {
    const created = await sql`
      INSERT INTO auth_users (name, email, role, created_at)
      VALUES ('Sri Usha Delivery Partner', ${deliveryEmail}, 'delivery_partner', NOW())
      RETURNING id
    `;
    deliveryUserId = created[0].id;
    const hashedPassword = await bcrypt.hash("Delivery@1234", 10);
    await sql`
      INSERT INTO auth_accounts ("userId", provider, type, "providerAccountId", password)
      VALUES (${deliveryUserId}, 'credentials', 'credentials', ${deliveryUserId}, ${hashedPassword})
    `;
    console.log(`✓ Created delivery partner account (${deliveryEmail}) with id: ${deliveryUserId}`);
  } else {
    deliveryUserId = existingDelivery[0].id;
    await sql`
      UPDATE auth_users SET role = 'delivery_partner' WHERE id = ${deliveryUserId}
    `;
    console.log(`✓ Delivery partner account exists with id: ${deliveryUserId}`);
  }

  // 6. Verify existing orders have order_status_history initial record
  const initialHistory = await sql`
    INSERT INTO order_status_history (order_id, status, notes)
    SELECT id, COALESCE(status, 'placed'), 'Initial order status'
    FROM orders o
    WHERE NOT EXISTS (
      SELECT 1 FROM order_status_history h WHERE h.order_id = o.id
    )
  `;
  console.log("✓ Backfilled order_status_history for existing orders");

  console.log("Database upgrade v3 completed successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
