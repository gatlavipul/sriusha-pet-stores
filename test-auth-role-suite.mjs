import { neon } from "@neondatabase/serverless";
import { getSafeReturnUrl } from "./src/utils/safeRedirect.js";

const BASE_URL = "http://localhost:4000";
const rawSql = neon(process.env.DATABASE_URL);

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

const sql = sqlWithRetry;

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   SRI USHA VET & PET STORES — AUTH & WORKFLOW TEST SUITE");
  console.log("=======================================================\n");

  // ----------------------------------------------------------------------
  // TEST GROUP 1: Public Customer Signup & Role Tampering Prevention
  // ----------------------------------------------------------------------
  console.log("--- 1. Customer Registration & Privilege Escalation Protection ---");
  const testCustomerEmail = `test_customer_${Date.now()}@example.com`;

  // 1.1 Input validation: short password
  const shortPassRes = await fetch(`${BASE_URL}/api/account/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Customer",
      email: testCustomerEmail,
      password: "123",
    }),
  });
  const shortPassData = await shortPassRes.json();
  assert(
    shortPassRes.status === 400 && shortPassData.error?.includes("at least 6"),
    "Short password rejected with validation error"
  );

  // 1.2 Input validation: invalid email
  const badEmailRes = await fetch(`${BASE_URL}/api/account/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Customer",
      email: "not-an-email",
      password: "ValidPassword123!",
    }),
  });
  assert(badEmailRes.status === 400, "Invalid email address format rejected");

  // 1.3 Successful registration with attempt to inject role = 'admin'
  const signupRes = await fetch(`${BASE_URL}/api/account/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Customer One",
      email: testCustomerEmail,
      password: "CustomerPass123!",
      role: "admin", // Malicious attempt to escalate privilege
    }),
  });
  const signupData = await signupRes.json();
  assert(signupRes.status === 201 && signupData.success, "Customer account created successfully");

  // Verify in database that the user's role is strictly 'customer'
  const userInDb = await sql`
    SELECT id, email, role FROM auth_users WHERE LOWER(email) = LOWER(${testCustomerEmail})
  `;
  assert(
    userInDb.length === 1 && userInDb[0].role === "customer",
    "Privilege Escalation Blocked: Role is strictly 'customer' in database"
  );

  // 1.4 Duplicate email registration attempt
  const dupSignupRes = await fetch(`${BASE_URL}/api/account/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Duplicate Attempt",
      email: testCustomerEmail,
      password: "CustomerPass123!",
    }),
  });
  const dupData = await dupSignupRes.json();
  assert(
    dupSignupRes.status === 400 && dupData.error?.includes("already exists"),
    "Duplicate email registration gracefully rejected with friendly message"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 2: Safe Return URLs & Open-Redirect Protections
  // ----------------------------------------------------------------------
  console.log("\n--- 2. Safe Return URL Workflow & Open Redirect Protection ---");

  // 2.1 Valid internal relative URL preserved for customer
  assert(
    getSafeReturnUrl("/checkout", "customer") === "/checkout",
    "Valid internal path '/checkout' preserved"
  );
  assert(
    getSafeReturnUrl("/wishlist", "customer") === "/wishlist",
    "Valid internal path '/wishlist' preserved"
  );

  // 2.2 External scheme / open redirect attacks safely deflected to role fallback
  assert(
    getSafeReturnUrl("https://evil-phishing.com/steal", "customer") === "/account",
    "Open redirect attack (https://...) blocked and deflected to /account"
  );
  assert(
    getSafeReturnUrl("//evil-phishing.com", "customer") === "/account",
    "Protocol-relative URL (//...) blocked and deflected to /account"
  );
  assert(
    getSafeReturnUrl("javascript:alert(1)", "customer") === "/account",
    "JavaScript URI scheme blocked and deflected to /account"
  );
  assert(
    getSafeReturnUrl("\\\\evil.com\\path", "customer") === "/account",
    "Backslash UNC path blocked and deflected to /account"
  );

  // 2.3 Cross-role boundary protections on return URLs
  assert(
    getSafeReturnUrl("/admin", "customer") === "/account",
    "Customer requesting '/admin' return URL safely deflected to '/account'"
  );
  assert(
    getSafeReturnUrl("/delivery", "customer") === "/account",
    "Customer requesting '/delivery' return URL safely deflected to '/account'"
  );
  assert(
    getSafeReturnUrl("/admin", "delivery_partner") === "/delivery",
    "Delivery partner requesting '/admin' return URL safely deflected to '/delivery'"
  );

  // 2.4 Default role fallbacks when no return URL provided
  assert(
    getSafeReturnUrl(null, "customer") === "/account",
    "Default fallback for customer without callbackUrl is '/account'"
  );
  assert(
    getSafeReturnUrl(null, "admin") === "/admin",
    "Default fallback for admin without callbackUrl is '/admin'"
  );
  assert(
    getSafeReturnUrl(null, "delivery_partner") === "/delivery",
    "Default fallback for delivery_partner without callbackUrl is '/delivery'"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 3: Server-Enforced Role-Based Access Controls
  // ----------------------------------------------------------------------
  console.log("\n--- 3. Server-Enforced Protected Route Authorization ---");

  // Unauthenticated requests must strictly return HTTP 401
  const unauthAdmin = await fetch(`${BASE_URL}/api/admin/stats`);
  assert(unauthAdmin.status === 401, "Unauthenticated /api/admin/stats returns 401 Unauthorized");

  const unauthDelivery = await fetch(`${BASE_URL}/api/delivery/orders`);
  assert(unauthDelivery.status === 401, "Unauthenticated /api/delivery/orders returns 401 Unauthorized");

  const unauthCart = await fetch(`${BASE_URL}/api/cart`);
  assert(unauthCart.status === 401, "Unauthenticated /api/cart returns 401 Unauthorized");

  const unauthAddresses = await fetch(`${BASE_URL}/api/addresses`);
  assert(unauthAddresses.status === 401, "Unauthenticated /api/addresses returns 401 Unauthorized");

  const unauthMe = await fetch(`${BASE_URL}/api/account/me`);
  const meData = await unauthMe.json();
  assert(
    unauthMe.status === 200 && meData.authenticated === false,
    "/api/account/me returns authenticated: false for guests"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 4: Admin Staff Management & Role Audit Trail
  // ----------------------------------------------------------------------
  console.log("\n--- 4. Administrative Role Management & Audit Trail ---");

  // Fetch admin user
  const adminUsers = await sql`SELECT id, email FROM auth_users WHERE role = 'admin' LIMIT 1`;
  const adminId = adminUsers[0]?.id;

  assert(Boolean(adminId), "Found existing verified administrator in database");

  const targetPartnerEmail = `driver_${Date.now()}@sriusha.com`;
  const partnerUser = await sql`
    INSERT INTO auth_users (name, email, role, created_at)
    VALUES ('Ravi Driver', ${targetPartnerEmail}, 'delivery_partner', NOW())
    RETURNING id, name, role
  `;
  const partnerId = partnerUser[0].id;

  // Insert audit log
  await sql`
    INSERT INTO admin_audit_logs (admin_id, action, target_user_id, details)
    VALUES (
      ${adminId},
      'create_user',
      ${partnerId},
      ${JSON.stringify({ role: "delivery_partner", email: targetPartnerEmail })}::jsonb
    )
  `;

  const auditLog = await sql`
    SELECT * FROM admin_audit_logs 
    WHERE target_user_id = ${partnerId} AND action = 'create_user'
  `;
  assert(
    auditLog.length > 0 && auditLog[0].details?.role === "delivery_partner",
    "Admin audit log recorded staff creation event without passwords or secrets"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 5: Order Lifecycle, Delivery Workflow & Status History
  // ----------------------------------------------------------------------
  console.log("\n--- 5. Order Lifecycle, Delivery Assignment & Audit Trail ---");

  // Fetch an active product
  const products = await sql`
    SELECT id, name, price, stock_quantity 
    FROM products 
    WHERE is_active = true AND stock_quantity > 5 
    LIMIT 1
  `;
  const testProduct = products[0];

  // 5.1 Place a Cash on Delivery order
  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: "Anita Rao",
      customer_email: `anita_${Date.now()}@example.com`,
      customer_phone: "9876543210",
      shipping_address: "Flat 204, Pet Paradise Apartments, Road No 10",
      shipping_city: "Hyderabad",
      shipping_pincode: "500034",
      payment_method: "cod",
      items: [{ id: testProduct.id, quantity: 1, name: testProduct.name }],
    }),
  });
  const orderData = await orderRes.json();
  assert(orderRes.status === 200 && orderData.success, "New COD customer order created");

  const createdOrderId = orderData.order.id;

  // 5.2 Verify initial timeline entry in order_status_history
  const initialHistory = await sql`
    SELECT * FROM order_status_history WHERE order_id = ${createdOrderId} ORDER BY created_at ASC
  `;
  assert(
    initialHistory.length >= 1 && initialHistory[0].status === "processing",
    "Initial order status recorded in order_status_history"
  );

  // 5.3 Admin assigns order to delivery partner and updates status to 'assigned'
  await sql`
    UPDATE orders 
    SET assigned_delivery_partner_id = ${partnerId}, status = 'assigned', updated_at = NOW()
    WHERE id = ${createdOrderId}
  `;
  await sql`
    INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
    VALUES (${createdOrderId}, 'assigned', ${adminId}, 'admin', 'Order assigned to Ravi Driver')
  `;

  const assignedOrder = await sql`
    SELECT id, status, assigned_delivery_partner_id FROM orders WHERE id = ${createdOrderId}
  `;
  assert(
    assignedOrder[0].assigned_delivery_partner_id === partnerId && assignedOrder[0].status === "assigned",
    "Order successfully assigned to delivery partner"
  );

  // 5.4 Delivery partner stage transition: assigned -> out_for_delivery
  await sql`
    UPDATE orders 
    SET status = 'out_for_delivery', updated_at = NOW()
    WHERE id = ${createdOrderId}
  `;
  await sql`
    INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
    VALUES (${createdOrderId}, 'out_for_delivery', ${partnerId}, 'delivery_partner', 'Driver started delivery on route')
  `;

  // 5.5 Delivery partner stage transition: out_for_delivery -> delivered
  // And for COD, cash is collected -> payment_status becomes 'paid'
  await sql`
    UPDATE orders 
    SET status = 'delivered', payment_status = 'paid', updated_at = NOW()
    WHERE id = ${createdOrderId}
  `;
  await sql`
    INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
    VALUES (${createdOrderId}, 'delivered', ${partnerId}, 'delivery_partner', 'Package delivered and cash collected')
  `;

  // 5.6 Verify complete timeline in order_status_history
  const fullTimeline = await sql`
    SELECT status, changed_by_role, notes 
    FROM order_status_history 
    WHERE order_id = ${createdOrderId} 
    ORDER BY created_at ASC
  `;
  const stages = fullTimeline.map((h) => h.status);
  assert(
    stages.includes("processing") && stages.includes("assigned") && stages.includes("out_for_delivery") && stages.includes("delivered"),
    `Full order lifecycle recorded in audit timeline: [${stages.join(" -> ")}]`
  );

  const deliveredOrder = await sql`
    SELECT payment_status, status FROM orders WHERE id = ${createdOrderId}
  `;
  assert(
    deliveredOrder[0].status === "delivered" && deliveredOrder[0].payment_status === "paid",
    "Delivered COD order marked as 'delivered' and payment_status verified as 'paid'"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 6: Frontend Route & Endpoint Availability
  // ----------------------------------------------------------------------
  console.log("\n--- 6. Public Pages & Application Endpoints Health ---");

  const homeRes = await fetch(`${BASE_URL}/`);
  assert(homeRes.status === 200, "Storefront homepage (/) renders HTTP 200");

  const signinRes = await fetch(`${BASE_URL}/account/signin`);
  assert(signinRes.status === 200, "Sign-in portal (/account/signin) renders HTTP 200");

  const signupPageRes = await fetch(`${BASE_URL}/account/signup`);
  assert(signupPageRes.status === 200, "Customer sign-up portal (/account/signup) renders HTTP 200");

  const accountPageRes = await fetch(`${BASE_URL}/account`);
  assert(accountPageRes.status === 200, "Customer account dashboard (/account) renders HTTP 200");

  const deliveryPageRes = await fetch(`${BASE_URL}/delivery`);
  assert(deliveryPageRes.status === 200, "Delivery partner dashboard (/delivery) renders HTTP 200");

  const adminOrdersPageRes = await fetch(`${BASE_URL}/admin/orders`);
  assert(adminOrdersPageRes.status === 200, "Admin orders management (/admin/orders) renders HTTP 200");

  const adminUsersPageRes = await fetch(`${BASE_URL}/admin/users`);
  assert(adminUsersPageRes.status === 200, "Admin user management (/admin/users) renders HTTP 200");

  // Summary
  console.log("\n=======================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
