import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const rawSql = neon(databaseUrl);

async function sqlWithRetry(strings, ...values) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await rawSql(strings, ...values);
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 1200 * attempt));
    }
  }
}

async function runMigration() {
  console.log("Starting DB upgrade v5: Operations, Serviceability & Notifications...");

  // 1. Upgrade admin_notifications table with product_id and link_url
  await sqlWithRetry`
    ALTER TABLE admin_notifications 
    ADD COLUMN IF NOT EXISTS product_id INT,
    ADD COLUMN IF NOT EXISTS link_url TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB;
  `;
  console.log("✓ admin_notifications columns updated.");

  // 2. Create customer_notifications table
  await sqlWithRetry`
    CREATE TABLE IF NOT EXISTS customer_notifications (
      id SERIAL PRIMARY KEY,
      user_id INT,
      order_id INT REFERENCES orders(id) ON DELETE CASCADE,
      channel TEXT NOT NULL DEFAULT 'email',
      recipient TEXT NOT NULL,
      template_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'logged',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  await sqlWithRetry`
    CREATE INDEX IF NOT EXISTS idx_customer_notif_order ON customer_notifications(order_id);
  `;
  await sqlWithRetry`
    CREATE INDEX IF NOT EXISTS idx_customer_notif_user ON customer_notifications(user_id);
  `;
  console.log("✓ customer_notifications table created.");

  // 3. Create delivery_serviceability_zones table
  await sqlWithRetry`
    CREATE TABLE IF NOT EXISTS delivery_serviceability_zones (
      id SERIAL PRIMARY KEY,
      pincode VARCHAR(20) UNIQUE NOT NULL,
      area_name VARCHAR(100) NOT NULL,
      city VARCHAR(100) DEFAULT 'Hyderabad',
      state VARCHAR(100) DEFAULT 'Telangana',
      delivery_charge NUMERIC(10, 2) DEFAULT 40.00,
      free_delivery_threshold NUMERIC(10, 2) DEFAULT 500.00,
      estimated_delivery_time VARCHAR(100) DEFAULT 'Same-day in 2-4 hours',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;
  await sqlWithRetry`
    CREATE INDEX IF NOT EXISTS idx_serviceability_pincode ON delivery_serviceability_zones(pincode);
  `;
  console.log("✓ delivery_serviceability_zones table created.");

  // 4. Seed standard serviceable pincodes
  const zones = [
    { pincode: "500039", area: "Uppal & Ramanthapur (Local Store Hub)", charge: 30, freeThreshold: 300, time: "Express 1-2 hours" },
    { pincode: "500092", area: "Boduppal & Peerzadiguda", charge: 30, freeThreshold: 350, time: "Express 1-2 hours" },
    { pincode: "500007", area: "Habsiguda & Tarnaka", charge: 40, freeThreshold: 500, time: "Same-day 2-3 hours" },
    { pincode: "500076", area: "Nacharam & Mallapur", charge: 40, freeThreshold: 500, time: "Same-day 2-3 hours" },
    { pincode: "500068", area: "Nagole & Kothapet", charge: 40, freeThreshold: 500, time: "Same-day 2-4 hours" },
    { pincode: "500074", area: "LB Nagar & Vanasthalipuram", charge: 40, freeThreshold: 500, time: "Same-day 2-4 hours" },
    { pincode: "500060", area: "Dilsukhnagar & Malakpet", charge: 40, freeThreshold: 500, time: "Same-day 2-4 hours" },
    { pincode: "500003", area: "Secunderabad Station & Marredpally", charge: 50, freeThreshold: 600, time: "Same-day 3-4 hours" },
    { pincode: "500034", area: "Banjara Hills", charge: 50, freeThreshold: 600, time: "Same-day 3-5 hours" },
    { pincode: "500033", area: "Jubilee Hills", charge: 50, freeThreshold: 600, time: "Same-day 3-5 hours" },
    { pincode: "500081", area: "Madhapur & Hitec City", charge: 60, freeThreshold: 700, time: "Same-day 4-6 hours" },
    { pincode: "500032", area: "Gachibowli & Financial District", charge: 60, freeThreshold: 700, time: "Same-day 4-6 hours" },
  ];

  for (const z of zones) {
    await sqlWithRetry`
      INSERT INTO delivery_serviceability_zones (
        pincode, area_name, city, state, delivery_charge, free_delivery_threshold, estimated_delivery_time, is_active
      ) VALUES (
        ${z.pincode}, ${z.area}, 'Hyderabad', 'Telangana', ${z.charge}, ${z.freeThreshold}, ${z.time}, TRUE
      )
      ON CONFLICT (pincode) DO UPDATE SET
        area_name = EXCLUDED.area_name,
        delivery_charge = EXCLUDED.delivery_charge,
        free_delivery_threshold = EXCLUDED.free_delivery_threshold,
        estimated_delivery_time = EXCLUDED.estimated_delivery_time,
        updated_at = NOW();
    `;
  }
  console.log(`✓ Seeded ${zones.length} delivery serviceability zones.`);
  console.log("Migration v5 completed successfully!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

