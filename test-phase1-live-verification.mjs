import fs from "fs";
if (fs.existsSync(".env")) {
  fs.readFileSync(".env", "utf8").split("\n").forEach((l) => {
    const [k, ...v] = l.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}
import { neon } from "@neondatabase/serverless";
import { getSafeReturnUrl } from "./src/utils/safeRedirect.js";

const sql = neon(process.env.DATABASE_URL);
const BASE_URL = "http://localhost:4000";

let passed = 0;
let failed = 0;

function assert(condition, name, details = "") {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name} ${details ? "(" + details + ")" : ""}`);
    failed++;
  }
}

async function runPhase1Tests() {
  console.log("\n=======================================================");
  console.log("   SRI USHA VET & PET STORES — PHASE 1 LIVE VERIFICATION");
  console.log("=======================================================\n");

  // 1. SETUP TEST ACCOUNTS IN NEON DATABASE
  console.log("--- 1. Verification of Role Setup in Neon DB ---");
  const adminUsers = await sql`SELECT id, name, email, role FROM auth_users WHERE role = 'admin' LIMIT 1`;
  assert(adminUsers.length > 0, "Admin account exists in database", `Found: ${adminUsers[0]?.email}`);
  const admin = adminUsers[0];

  const deliveryUsers = await sql`SELECT id, name, email, role FROM auth_users WHERE role = 'delivery_partner' LIMIT 2`;
  assert(deliveryUsers.length >= 2, "At least two delivery partner accounts exist in database for cross-order isolation testing");
  const driver1 = deliveryUsers[0];
  const driver2 = deliveryUsers[1];

  // 2. NEW SIGNUP BECOMES CUSTOMER ONLY (PRIVILEGE ESCALATION TEST)
  console.log("\n--- 2. Public Registration Privilege Escalation Protection ---");
  const testEmail = `newcustomer_${Date.now()}@example.com`;
  const signupRes = await fetch(`${BASE_URL}/api/account/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: "StrongPassword123!",
      name: "Phase 1 Customer",
      role: "admin", // ATTEMPT PRIVILEGE ESCALATION
    }),
  });
  const signupData = await signupRes.json();
  assert(signupRes.ok, "Customer registration endpoint succeeded");
  
  // Verify in Neon DB that role is strictly 'customer'
  const createdUser = await sql`SELECT id, email, role FROM auth_users WHERE email = ${testEmail}`;
  assert(createdUser.length === 1, "New user found in Neon database");
  assert(createdUser[0]?.role === "customer", "New user role is strictly 'customer' (Privilege escalation to 'admin' blocked)");
  const customer = createdUser[0];

  // 3. CUSTOMER OPENING /admin AND /delivery IS BLOCKED
  console.log("\n--- 3. Customer Route & API Access Boundaries ---");
  // Customer accessing /api/admin/stats
  const custAdminApiRes = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { "x-test-user-id": String(customer.id) },
  });
  assert(custAdminApiRes.status === 403, `Customer blocked from /api/admin/stats (HTTP ${custAdminApiRes.status} === 403)`);

  // Customer accessing /api/delivery/orders
  const custDeliveryApiRes = await fetch(`${BASE_URL}/api/delivery/orders`, {
    headers: { "x-test-user-id": String(customer.id) },
  });
  assert(custDeliveryApiRes.status === 403, `Customer blocked from /api/delivery/orders (HTTP ${custDeliveryApiRes.status} === 403)`);

  // Check role endpoint for customer
  const custRoleRes = await fetch(`${BASE_URL}/api/admin/check-role`, {
    headers: { "x-test-user-id": String(customer.id) },
  });
  const custRoleData = await custRoleRes.json();
  assert(custRoleData.role === "customer" && custRoleData.isAdmin === false && custRoleData.isDeliveryPartner === false, "Customer role check returns isAdmin=false, isDeliveryPartner=false");

  // 4. DELIVERY PARTNER OPENING /admin IS BLOCKED & CANNOT READ ANOTHER DRIVER'S ORDER
  console.log("\n--- 4. Delivery Partner Isolation & Access Boundaries ---");
  // Driver accessing /api/admin/stats
  const driverAdminApiRes = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { "x-test-user-id": String(driver1.id) },
  });
  assert(driverAdminApiRes.status === 403, `Delivery partner blocked from /api/admin/stats (HTTP ${driverAdminApiRes.status} === 403)`);

  // Create an order assigned to driver2
  const assignedOrder = await sql`
    INSERT INTO orders (user_id, total_amount, status, payment_method, payment_status, assigned_delivery_partner_id, shipping_pincode, shipping_address)
    VALUES (${customer.id}, 999.00, 'assigned', 'cod', 'pending', ${driver2.id}, '500039', 'Uppal, Hyderabad')
    RETURNING id
  `;
  const orderId = assignedOrder[0].id;

  // Driver 1 attempts to read Driver 2's assigned order via /api/delivery/orders/:id
  const driver1CrossAccessRes = await fetch(`${BASE_URL}/api/delivery/orders/${orderId}`, {
    headers: { "x-test-user-id": String(driver1.id) },
  });
  assert(driver1CrossAccessRes.status === 403, `Driver 1 blocked from reading Driver 2's order (HTTP ${driver1CrossAccessRes.status} === 403)`);

  // Driver 2 (the assigned partner) CAN read their order
  const driver2AssignedAccessRes = await fetch(`${BASE_URL}/api/delivery/orders/${orderId}`, {
    headers: { "x-test-user-id": String(driver2.id) },
  });
  assert(driver2AssignedAccessRes.status === 200, `Assigned Driver 2 CAN read their own order (HTTP ${driver2AssignedAccessRes.status} === 200)`);

  // Driver 1 attempts to update Driver 2's order
  const driver1CrossUpdateRes = await fetch(`${BASE_URL}/api/delivery/orders/${orderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(driver1.id),
    },
    body: JSON.stringify({ status: "out_for_delivery" }),
  });
  assert(driver1CrossUpdateRes.status === 403, `Driver 1 blocked from updating Driver 2's order (HTTP ${driver1CrossUpdateRes.status} === 403)`);

  // Clean up test order
  await sql`DELETE FROM orders WHERE id = ${orderId}`;

  // 5. ADMIN CAN OPEN /admin AND CHANGE A USER'S ROLE (SAVED IN admin_audit_logs)
  console.log("\n--- 5. Admin Role Promotion & Audit Trail ---");
  // Admin accessing /api/admin/stats
  const adminStatsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { "x-test-user-id": String(admin.id) },
  });
  assert(adminStatsRes.status === 200, `Admin successfully authenticated for /api/admin/stats (HTTP ${adminStatsRes.status} === 200)`);

  // Admin changes customer role to delivery_partner
  const roleUpdateRes = await fetch(`${BASE_URL}/api/admin/users/${customer.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(admin.id),
    },
    body: JSON.stringify({ role: "delivery_partner" }),
  });
  assert(roleUpdateRes.status === 200, `Admin successfully updated user ${customer.id} role to delivery_partner`);

  // Verify in Neon DB
  const updatedUser = await sql`SELECT role FROM auth_users WHERE id = ${customer.id}`;
  assert(updatedUser[0]?.role === "delivery_partner", "User role in Neon DB successfully updated to 'delivery_partner'");

  // Verify audit log entry exists
  const auditLogs = await sql`
    SELECT * FROM admin_audit_logs 
    WHERE admin_id = ${admin.id} AND target_user_id = ${customer.id} AND action = 'update_role'
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  assert(auditLogs.length > 0, "Role change successfully logged in admin_audit_logs table");
  assert(auditLogs[0]?.details?.new_role === "delivery_partner", "Audit log records accurate new_role details");

  // Clean up test user
  await sql`DELETE FROM admin_audit_logs WHERE target_user_id = ${customer.id}`;
  await sql`DELETE FROM auth_users WHERE id = ${customer.id}`;

  // 6. LOGIN REDIRECTS WORKFLOW
  console.log("\n--- 6. Post-Login Safe Redirects Workflow ---");
  // Customer -> /account
  const customerRedirect = getSafeReturnUrl("", "customer");
  assert(customerRedirect === "/account", `Customer without callbackUrl redirects to /account (got: ${customerRedirect})`);

  // Admin -> /admin
  const adminRedirect = getSafeReturnUrl("", "admin");
  assert(adminRedirect === "/admin", `Admin without callbackUrl redirects to /admin (got: ${adminRedirect})`);

  // Delivery Partner -> /delivery
  const driverRedirect = getSafeReturnUrl("", "delivery_partner");
  assert(driverRedirect === "/delivery", `Delivery Partner without callbackUrl redirects to /delivery (got: ${driverRedirect})`);

  // Malicious/tampered attempts
  const customerAdminHijack = getSafeReturnUrl("/admin", "customer");
  assert(customerAdminHijack === "/account", `Customer attempting callbackUrl='/admin' deflected safely to /account`);

  const driverAdminHijack = getSafeReturnUrl("/admin", "delivery_partner");
  assert(driverAdminHijack === "/delivery", `Delivery partner attempting callbackUrl='/admin' deflected safely to /delivery`);

  const openRedirectAttack = getSafeReturnUrl("https://evil-site.com/steal-creds", "customer");
  assert(openRedirectAttack === "/account", `Phishing open redirect blocked and deflected safely to /account`);

  // 7. FRONTEND PAGES HTTP 200
  console.log("\n--- 7. Application Key Pages HTTP Health ---");
  const pagesToTest = [
    { name: "Homepage", url: `${BASE_URL}/` },
    { name: "Customer Sign In", url: `${BASE_URL}/account/signin` },
    { name: "Customer Sign Up", url: `${BASE_URL}/account/signup` },
    { name: "Customer Account", url: `${BASE_URL}/account` },
    { name: "Delivery Partner App", url: `${BASE_URL}/delivery` },
    { name: "Admin Dashboard", url: `${BASE_URL}/admin` },
    { name: "Admin Orders", url: `${BASE_URL}/admin/orders` },
    { name: "Admin Inventory", url: `${BASE_URL}/admin/inventory` },
    { name: "Admin Users", url: `${BASE_URL}/admin/users` },
    { name: "Not Found / 404 Route", url: `${BASE_URL}/non-existent-route-paw-check` },
  ];

  for (const page of pagesToTest) {
    const res = await fetch(page.url);
    assert(res.status === 200, `${page.name} (${page.url}) returns HTTP 200`);
  }

  console.log("\n=======================================================");
  console.log(`PHASE 1 LIVE VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase1Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
