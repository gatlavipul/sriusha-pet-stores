import fs from "fs";
if (fs.existsSync(".env")) {
  fs.readFileSync(".env", "utf8").split("\n").forEach((l) => {
    const [k, ...v] = l.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}
import { encode } from "@auth/core/jwt";
import sql from "./src/app/api/utils/sql.js";

const BASE_URL = "http://localhost:4000";

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  FAIL: ${testName}`);
    failed++;
  }
}

async function mintSessionCookie(user) {
  const salt = "authjs.session-token";
  const jwt = await encode({
    token: {
      sub: String(user.id),
      id: String(user.id),
      email: user.email,
      name: user.name,
      role: user.role,
    },
    secret: process.env.AUTH_SECRET,
    salt,
  });
  return `${salt}=${jwt}`;
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("  SRI USHA — OPERATIONS, SUPPORT & MOBILE ARCHITECTURE");
  console.log("=======================================================\n");

  const ts = Date.now();
  const custEmail = `support_cust_${ts}@example.com`;
  const adminEmail = `admin_ops_${ts}@example.com`;
  let custId = null;
  let adminId = null;
  let custCookie = "";
  let adminCookie = "";
  let testOrderId = null;
  let createdTicketId = null;

  try {
    // 1. Setup Customer & Admin
    console.log("--- 1. Identity & Session Setup ---");
    const custInsert = await sql`
      INSERT INTO auth_users (name, email, role)
      VALUES ('Ticket Customer', ${custEmail}, 'customer')
      RETURNING id, name, email, role
    `;
    custId = custInsert[0]?.id;
    custCookie = await mintSessionCookie(custInsert[0]);
    assert(Boolean(custId), "Customer user created in Neon");

    const adminInsert = await sql`
      INSERT INTO auth_users (name, email, role)
      VALUES ('Operations Admin', ${adminEmail}, 'admin')
      RETURNING id, name, email, role
    `;
    adminId = adminInsert[0]?.id;
    adminCookie = await mintSessionCookie(adminInsert[0]);
    assert(Boolean(adminId), "Admin user created in Neon");

    // 2. Create Order to attach support ticket to
    console.log("\n--- 2. Create Test Order for Support Ticket ---");
    const prodRows = await sql`
      SELECT id, name, price, sale_price FROM products WHERE stock_quantity >= 5 LIMIT 1
    `;
    const prod = prodRows[0];
    const orderRows = await sql`
      INSERT INTO orders (
        user_id, customer_name, customer_email, customer_phone,
        shipping_address, shipping_city, shipping_pincode,
        total_amount, payment_status, status, payment_method,
        delivery_otp, gentle_delivery
      ) VALUES (
        ${custId}, 'Ticket Customer', ${custEmail}, '9876543210',
        'Plot 88, Uppal Store Area', 'Hyderabad', '500039',
        650, 'paid', 'delivered', 'cod',
        '4321', true
      )
      RETURNING *
    `;
    testOrderId = orderRows[0]?.id;
    assert(Boolean(testOrderId), "Delivered test order created for support ticket flow");

    // 3. Customer Support Ticket Flow
    console.log("\n--- 3. Customer Support Ticket Creation & Protection ---");
    const unauthPost = await fetch(`${BASE_URL}/api/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: "Test", description: "Unauth test" }),
    });
    assert(unauthPost.status === 401, "Unauthenticated POST /api/support rejected with 401");

    const shortTicket = await fetch(`${BASE_URL}/api/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({
        order_id: testOrderId,
        category: "damaged_product",
        subject: "No",
        description: "short",
      }),
    });
    assert(shortTicket.status === 400, "Validation rejects short subject / description (400)");

    const validTicketRes = await fetch(`${BASE_URL}/api/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({
        order_id: testOrderId,
        category: "damaged_product",
        subject: "Damaged packaging on dog food bag",
        description: "The outer bag had a tear upon delivery. Requesting replacement or partial refund.",
      }),
    });
    const validTicketData = await validTicketRes.json();
    createdTicketId = validTicketData.ticket?.id;
    assert(validTicketRes.status === 201 && Boolean(createdTicketId), "POST /api/support created ticket in open status");

    // Customer can fetch own tickets
    const custGetRes = await fetch(`${BASE_URL}/api/support?order_id=${testOrderId}`, {
      headers: { Cookie: custCookie },
    });
    const custGetData = await custGetRes.json();
    assert(
      custGetRes.ok && custGetData.tickets?.some((t) => t.id === createdTicketId),
      "Customer can retrieve own support tickets linked to order"
    );

    // 4. Admin Resolution & Refund Handling
    console.log("\n--- 4. Admin Support Ticket Resolution & Refunds ---");
    const custPutAttempt = await fetch(`${BASE_URL}/api/support`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({ ticket_id: createdTicketId, status: "resolved" }),
    });
    assert(custPutAttempt.status === 403, "Non-admin cannot update or resolve support tickets (403)");

    const adminResolveRes = await fetch(`${BASE_URL}/api/support`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        ticket_id: createdTicketId,
        status: "resolved",
        resolution_notes: "Inspected photograph; approved ₹200 store credit / partial refund.",
        refund_status: "approved",
        refund_amount: 200,
      }),
    });
    const adminResolveData = await adminResolveRes.json();
    assert(
      adminResolveRes.ok &&
        adminResolveData.ticket?.status === "resolved" &&
        Number(adminResolveData.ticket?.refund_amount) === 200,
      "Admin successfully resolved ticket with approved refund"
    );

    // 5. Admin Stats Endpoint includes open support metrics
    console.log("\n--- 5. Admin Live Operations Metrics ---");
    const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Cookie: adminCookie },
    });
    const statsData = await statsRes.json();
    assert(
      statsRes.ok && typeof statsData.todayStats?.attention?.openSupportCount === "number",
      "GET /api/admin/stats returns real openSupportCount metric"
    );

    // 6. Public Storefront & Endpoints Health Check
    console.log("\n--- 6. Operations & Page Health Checks ---");
    const opsPage = await fetch(`${BASE_URL}/admin/operations`, { headers: { Cookie: adminCookie } });
    assert(opsPage.status === 200, "Admin operations dispatch center (/admin/operations) renders HTTP 200");

    const orderPage = await fetch(`${BASE_URL}/orders/${testOrderId}`, { headers: { Cookie: custCookie } });
    assert(orderPage.status === 200, "Customer order details with support modal (/orders/[id]) renders HTTP 200");
  } finally {
    // Cleanup
    if (createdTicketId) await sql`DELETE FROM support_tickets WHERE id = ${createdTicketId}`.catch(() => {});
    if (testOrderId) await sql`DELETE FROM orders WHERE id = ${testOrderId}`.catch(() => {});
    if (custId) await sql`DELETE FROM auth_users WHERE id = ${custId}`.catch(() => {});
    if (adminId) await sql`DELETE FROM auth_users WHERE id = ${adminId}`.catch(() => {});
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
