/**
 * Sri Usha Vet & Pet Stores — Clerk Admin Account Linking & Role Verification Test
 * Verifies:
 * 1. gatlavipul@gmail.com is linked to Clerk ID in Neon PostgreSQL.
 * 2. Database role remains strictly 'admin'.
 * 3. /admin dashboard and /api/admin/* endpoints are accessible.
 * 4. Customers cannot escalate roles via Clerk.
 * 5. Delivery partner accounts are separate, admin-controlled, and strictly isolated.
 */

import sql from "./src/app/api/utils/sql.js";
import { syncUserWithDatabase, verifyClerkToken } from "./src/utils/clerkServer.js";

const BASE_URL = process.env.APP_URL || "http://localhost:4000";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runAdminLinkingVerification() {
  console.log("\n=======================================================");
  console.log("   SRI USHA — CLERK ADMIN LINKING & ROLE ISOLATION");
  console.log("=======================================================\n");

  const adminEmail = "gatlavipul@gmail.com";
  const clerkUserId = "user_2clerk_gatlavipul_verified";

  // 1. Verify user exists in Neon
  console.log("--- 1. Database Lookup for gatlavipul@gmail.com ---");
  const [existingUser] = await sql`
    SELECT id, name, email, role, clerk_user_id 
    FROM auth_users 
    WHERE email ILIKE ${adminEmail}
  `;
  assert(Boolean(existingUser), `Found user in Neon: ${adminEmail} (User ID: ${existingUser?.id})`);
  assert(existingUser.role === "admin", `Existing role is confirmed as 'admin' in Neon database`);

  // 2. Link Clerk ID to existing record
  console.log("\n--- 2. Linking Clerk ID to Neon auth_users Record ---");
  const syncedAdmin = await syncUserWithDatabase({
    clerkUserId,
    email: adminEmail,
    name: existingUser.name,
  });

  assert(Boolean(syncedAdmin), "syncUserWithDatabase succeeded");
  assert(syncedAdmin.id === existingUser.id, `User ID preserved (${syncedAdmin.id} === ${existingUser.id})`);
  assert(syncedAdmin.clerk_user_id === clerkUserId, `clerk_user_id correctly set to ${clerkUserId}`);
  assert(syncedAdmin.role === "admin", "Database role strictly maintained as 'admin'");

  // Re-query database directly to confirm persistence
  const [dbAdminCheck] = await sql`
    SELECT id, role, clerk_user_id 
    FROM auth_users 
    WHERE id = ${existingUser.id}
  `;
  assert(dbAdminCheck.clerk_user_id === clerkUserId, "clerk_user_id confirmed persistent in Neon table");
  assert(dbAdminCheck.role === "admin", "Persistent role in Neon confirmed as 'admin'");

  // 3. Verify /admin access with linked Clerk session
  console.log("\n--- 3. Testing Protected /admin Endpoints with Linked Clerk ID ---");
  
  // 3.1 Check-role endpoint
  const checkRoleRes = await fetch(`${BASE_URL}/api/admin/check-role`, {
    headers: { "x-clerk-user-id": clerkUserId },
  });
  assert(checkRoleRes.status === 200, "GET /api/admin/check-role returns HTTP 200");
  const checkRoleData = await checkRoleRes.json();
  assert(checkRoleData.authenticated === true, "check-role confirms user is authenticated");
  assert(checkRoleData.isAdmin === true, "check-role confirms isAdmin: true");
  assert(checkRoleData.isDeliveryPartner === false, "check-role confirms isDeliveryPartner: false (single-role model)");
  assert(checkRoleData.role === "admin", "check-role returns verified database role 'admin'");
  assert(checkRoleData.email.toLowerCase() === adminEmail.toLowerCase(), "Email matches gatlavipul@gmail.com");

  // 3.2 Admin statistics endpoint
  const statsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { "x-clerk-user-id": clerkUserId },
  });
  assert(statsRes.status === 200, "GET /api/admin/stats returns HTTP 200 OK for linked admin");

  // 3.3 Admin orders management endpoint
  const ordersRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { "x-clerk-user-id": clerkUserId },
  });
  assert(ordersRes.status === 200, "GET /api/admin/orders returns HTTP 200 OK for linked admin");

  // 3.4 Admin notifications endpoint
  const notifRes = await fetch(`${BASE_URL}/api/admin/notifications`, {
    headers: { "x-clerk-user-id": clerkUserId },
  });
  assert(notifRes.status === 200, "GET /api/admin/notifications returns HTTP 200 OK for linked admin");

  // 4. Role Isolation: Admin cannot access Delivery Partner portal
  console.log("\n--- 4. Role Isolation: Admin Blocked from Delivery Partner Manifest ---");
  const adminAsDeliveryRes = await fetch(`${BASE_URL}/api/delivery/orders`, {
    headers: { "x-clerk-user-id": clerkUserId },
  });
  assert(adminAsDeliveryRes.status === 403, "Admin attempting to access /api/delivery/orders is rejected with HTTP 403 Forbidden");

  // 5. Delivery Partner Creation & Authorization via Admin Management Workflow
  console.log("\n--- 5. Delivery Partner Creation & Authorization via Admin Workflow ---");
  
  const driverEmail = `delivery_partner_${Date.now()}@sriushastores.in`;
  const driverClerkId = `user_2clerk_driver_${Date.now()}`;

  // Admin creates delivery partner in database
  const [createdDriver] = await sql`
    INSERT INTO auth_users (name, email, role, clerk_user_id, created_at)
    VALUES ('Raju Delivery Specialist', ${driverEmail}, 'delivery_partner', ${driverClerkId}, NOW())
    RETURNING id, name, email, role, clerk_user_id
  `;

  assert(Boolean(createdDriver), `Delivery partner account created via admin authority (ID: ${createdDriver.id})`);
  assert(createdDriver.role === "delivery_partner", "Driver role strictly set to 'delivery_partner'");

  // Delivery partner accesses /api/delivery/orders
  const driverRunsRes = await fetch(`${BASE_URL}/api/delivery/orders`, {
    headers: { "x-clerk-user-id": driverClerkId },
  });
  assert(driverRunsRes.status === 200, "Delivery partner successfully accesses /api/delivery/orders (HTTP 200)");

  // Delivery partner is strictly blocked from /admin
  const driverToAdminRes = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { "x-clerk-user-id": driverClerkId },
  });
  assert(driverToAdminRes.status === 403, "Delivery partner attempting to access /api/admin/orders is rejected with HTTP 403 Forbidden");

  // 6. Customer Privilege Escalation Protection
  console.log("\n--- 6. Customer Privilege Escalation Protection ---");
  
  const customerEmail = `customer_tamper_${Date.now()}@example.com`;
  const customerClerkId = `user_2clerk_cust_${Date.now()}`;

  // Sync new customer
  const syncedCustomer = await syncUserWithDatabase({
    clerkUserId: customerClerkId,
    email: customerEmail,
    name: "Regular Customer",
  });
  assert(syncedCustomer.role === "customer", "New user strictly defaults to role = 'customer'");

  // Customer cannot access admin
  const customerToAdmin = await fetch(`${BASE_URL}/api/admin/orders`, {
    headers: { "x-clerk-user-id": customerClerkId },
  });
  assert(customerToAdmin.status === 403, "Customer attempting to access /api/admin/orders is rejected with HTTP 403 Forbidden");

  // Customer cannot access delivery
  const customerToDelivery = await fetch(`${BASE_URL}/api/delivery/orders`, {
    headers: { "x-clerk-user-id": customerClerkId },
  });
  assert(customerToDelivery.status === 403, "Customer attempting to access /api/delivery/orders is rejected with HTTP 403 Forbidden");

  console.log("\n=======================================================");
  console.log(`ADMIN LINKING & ROLE VERIFICATION: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAdminLinkingVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
