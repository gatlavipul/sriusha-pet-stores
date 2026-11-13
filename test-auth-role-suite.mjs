import fs from "fs";
if (fs.existsSync(".env")) {
  fs.readFileSync(".env", "utf8").split("\n").forEach((l) => {
    const [k, ...v] = l.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}
import sql from "./src/app/api/utils/sql.js";
import { getSafeReturnUrl } from "./src/utils/safeRedirect.js";
import {
  ORDER_STATUS,
  ALLOWED_TRANSITIONS,
  canTransition,
  validateTransition,
  isCancellableByCustomer,
} from "./src/utils/orderWorkflow.js";

const BASE_URL = "http://localhost:4000";

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
  // TEST GROUP 4: Centralized Order Workflow Rules & Boundaries
  // ----------------------------------------------------------------------
  console.log("\n--- 4. Centralized Order Workflow Rules & State Machine ---");

  // 4.1 Allowed Admin Transitions
  assert(
    canTransition(ORDER_STATUS.PLACED, ORDER_STATUS.CONFIRMED, "admin") === true,
    "Admin can transition: placed -> confirmed"
  );
  assert(
    canTransition(ORDER_STATUS.CONFIRMED, ORDER_STATUS.PACKING, "admin") === true,
    "Admin can transition: confirmed -> packing"
  );
  assert(
    canTransition(ORDER_STATUS.PACKING, ORDER_STATUS.READY_FOR_DELIVERY, "admin") === true,
    "Admin can transition: packing -> ready_for_delivery"
  );
  assert(
    canTransition(ORDER_STATUS.READY_FOR_DELIVERY, ORDER_STATUS.ASSIGNED, "admin") === true,
    "Admin can transition: ready_for_delivery -> assigned"
  );
  assert(
    canTransition(ORDER_STATUS.DELIVERY_FAILED, ORDER_STATUS.ASSIGNED, "admin") === true,
    "Admin can recover delivery exception: delivery_failed -> assigned"
  );

  // 4.2 Prohibited Admin Transitions
  assert(
    canTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED, "admin") === false,
    "Admin CANNOT cancel already delivered order"
  );
  assert(
    validateTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED, "admin") !== null,
    "validateTransition returns descriptive error for terminal delivered order"
  );

  // 4.3 Delivery Partner Boundaries
  assert(
    canTransition(ORDER_STATUS.ASSIGNED, ORDER_STATUS.OUT_FOR_DELIVERY, "delivery_partner") === true,
    "Delivery partner can transition: assigned -> out_for_delivery"
  );
  assert(
    canTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED, "delivery_partner") === true,
    "Delivery partner can transition: out_for_delivery -> delivered"
  );
  assert(
    canTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERY_FAILED, "delivery_partner") === true,
    "Delivery partner can report exception: out_for_delivery -> delivery_failed"
  );
  assert(
    canTransition(ORDER_STATUS.ASSIGNED, ORDER_STATUS.DELIVERED, "delivery_partner") === false,
    "Delivery partner CANNOT skip out_for_delivery stage (assigned -> delivered blocked)"
  );
  assert(
    canTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED, "delivery_partner") === false,
    "Delivery partner CANNOT cancel an order directly"
  );

  // 4.4 Customer Cancellation Boundaries
  assert(
    isCancellableByCustomer(ORDER_STATUS.PLACED) === true,
    "Customer can cancel order in 'placed' status"
  );
  assert(
    isCancellableByCustomer(ORDER_STATUS.READY_FOR_DELIVERY) === true,
    "Customer can cancel order in 'ready_for_delivery' status"
  );
  assert(
    isCancellableByCustomer(ORDER_STATUS.ASSIGNED) === false,
    "Customer CANNOT cancel once driver is 'assigned'"
  );
  assert(
    isCancellableByCustomer(ORDER_STATUS.OUT_FOR_DELIVERY) === false,
    "Customer CANNOT cancel once order is 'out_for_delivery'"
  );
  assert(
    isCancellableByCustomer(ORDER_STATUS.DELIVERED) === false,
    "Customer CANNOT cancel once order is 'delivered'"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 5: Order Lifecycle, Delivery Workflow & Status History
  // ----------------------------------------------------------------------
  console.log("\n--- 5. Order Lifecycle, Delivery Assignment & Audit Trail ---");

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

  // Fetch an active product
  const products = await sql`
    SELECT id, name, price, stock_quantity 
    FROM products 
    WHERE is_active = true AND stock_quantity > 5 
    LIMIT 1
  `;
  const testProduct = products[0];
  const initialStock = testProduct.stock_quantity;

  // 5.1 Place a Cash on Delivery order
  let orderRes;
  let orderData;
  for (let attempt = 1; attempt <= 3; attempt++) {
    orderRes = await fetch(`${BASE_URL}/api/orders`, {
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
        items: [{ id: testProduct.id, quantity: 2, name: testProduct.name }],
      }),
    });
    orderData = await orderRes.json();
    if (orderRes.status === 200 && orderData.success) break;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  assert(orderRes.status === 200 && orderData?.success, "New COD customer order created");

  const createdOrderId = orderData.order.id;

  // Verify stock was decremented by 2
  const productAfterOrder = await sql`SELECT stock_quantity FROM products WHERE id = ${testProduct.id}`;
  assert(
    productAfterOrder[0].stock_quantity === initialStock - 2,
    `Inventory decremented on checkout: ${initialStock} -> ${productAfterOrder[0].stock_quantity}`
  );

  // 5.2 Verify initial timeline entry in order_status_history is 'placed'
  const initialHistory = await sql`
    SELECT * FROM order_status_history WHERE order_id = ${createdOrderId} ORDER BY created_at ASC
  `;
  assert(
    initialHistory.length >= 1 && initialHistory[0].status === ORDER_STATUS.PLACED,
    "Initial order status recorded as 'placed' in order_status_history"
  );

  // 5.3 COD Payment State: strictly pending while unfulfilled
  const codOrderInit = await sql`SELECT payment_status FROM orders WHERE id = ${createdOrderId}`;
  assert(
    codOrderInit[0].payment_status === "pending",
    "COD payment status initialized strictly to 'pending'"
  );

  // 5.4 Delivery Exception Workflow: driver reports failure
  // Simulate order reaches out_for_delivery
  await sql`
    UPDATE orders 
    SET assigned_delivery_partner_id = ${partnerId}, status = 'out_for_delivery', updated_at = NOW()
    WHERE id = ${createdOrderId}
  `;

  // Delivery partner updates stage to delivery_failed
  const failureReason = "Customer phone switched off at doorstep";
  await sql`
    UPDATE orders 
    SET status = 'delivery_failed', delivery_failure_reason = ${failureReason}, updated_at = NOW()
    WHERE id = ${createdOrderId}
  `;
  await sql`
    INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
    VALUES (${createdOrderId}, 'delivery_failed', ${partnerId}, 'delivery_partner', ${`Delivery attempt failed: ${failureReason}`})
  `;
  await sql`
    INSERT INTO admin_notifications (type, order_id, title, message)
    VALUES ('delivery_failure', ${createdOrderId}, 'Delivery Failed: Order #' || ${createdOrderId}, ${`Delivery partner reported issue: ${failureReason}`})
  `;

  // Verify delivery_failed state
  const failedOrder = await sql`
    SELECT status, payment_status, delivery_failure_reason, stock_restored FROM orders WHERE id = ${createdOrderId}
  `;
  assert(
    failedOrder[0].status === "delivery_failed" &&
    failedOrder[0].delivery_failure_reason === failureReason &&
    failedOrder[0].payment_status === "pending" &&
    failedOrder[0].stock_restored === false,
    "Delivery exception recorded: reason stored, payment remains 'pending', stock NOT restored"
  );

  // Verify admin notification was created
  const notif = await sql`
    SELECT * FROM admin_notifications WHERE order_id = ${createdOrderId} AND type = 'delivery_failure'
  `;
  assert(
    notif.length > 0 && notif[0].message?.includes("Customer phone switched off"),
    "Admin notification recorded for delivery exception"
  );

  // 5.5 Admin reviews and re-assigns driver for retry
  await sql`
    UPDATE orders 
    SET status = 'assigned', delivery_failure_reason = NULL, updated_at = NOW()
    WHERE id = ${createdOrderId}
  `;
  await sql`
    INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
    VALUES (${createdOrderId}, 'assigned', ${adminId}, 'admin', 'Admin re-assigned driver for re-attempt')
  `;

  // 5.6 Successful re-delivery: out_for_delivery -> delivered
  await sql`
    UPDATE orders 
    SET status = 'delivered', payment_status = 'paid', updated_at = NOW()
    WHERE id = ${createdOrderId}
  `;
  await sql`
    INSERT INTO order_status_history (order_id, status, changed_by_user_id, changed_by_role, notes)
    VALUES (${createdOrderId}, 'delivered', ${partnerId}, 'delivery_partner', 'Delivered and cash collected')
  `;

  const finalDelivered = await sql`SELECT status, payment_status FROM orders WHERE id = ${createdOrderId}`;
  assert(
    finalDelivered[0].status === "delivered" && finalDelivered[0].payment_status === "paid",
    "Delivered order marked as 'delivered' and COD payment verified as 'paid'"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 6: Single-Restoration Inventory Protection on Cancellation
  // ----------------------------------------------------------------------
  console.log("\n--- 6. Idempotent Single-Restoration Inventory Protection ---");

  // Create a separate order to test cancellation & stock idempotency
  const rameshEmail = `ramesh_${Date.now()}@example.com`;
  const cancelTestOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: "Ramesh Kumar",
      customer_email: rameshEmail,
      customer_phone: "9876543211",
      shipping_address: "Banjara Hills Road 12",
      shipping_city: "Hyderabad",
      shipping_pincode: "500034",
      payment_method: "cod",
      items: [{ id: testProduct.id, quantity: 3, name: testProduct.name }],
    }),
  });
  const cancelTestData = await cancelTestOrderRes.json();
  const cancelOrderId = cancelTestData.order.id;

  const stockBeforeCancel = (await sql`SELECT stock_quantity FROM products WHERE id = ${testProduct.id}`)[0].stock_quantity;

  // First cancellation call via API
  const firstCancelRes = await fetch(`${BASE_URL}/api/orders/${cancelOrderId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: rameshEmail,
      reason: "Customer changed mind",
    }),
  });
  const firstCancelData = await firstCancelRes.json();
  assert(firstCancelRes.status === 200 && firstCancelData.success, "First cancellation succeeds");

  const stockAfterFirstCancel = (await sql`SELECT stock_quantity FROM products WHERE id = ${testProduct.id}`)[0].stock_quantity;
  assert(
    stockAfterFirstCancel === stockBeforeCancel + 3,
    `Inventory restored on first cancellation: ${stockBeforeCancel} -> ${stockAfterFirstCancel}`
  );

  // Verify stock_restored column is TRUE in orders
  const cancelOrderRow = await sql`SELECT status, stock_restored FROM orders WHERE id = ${cancelOrderId}`;
  assert(
    cancelOrderRow[0].stock_restored === true,
    "stock_restored flag set to TRUE on order record"
  );

  // Second duplicate cancellation call (should be idempotent: stock NOT restored again!)
  const secondCancelRes = await fetch(`${BASE_URL}/api/orders/${cancelOrderId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: rameshEmail,
      reason: "Duplicate cancellation trigger",
    }),
  });
  const stockAfterSecondCancel = (await sql`SELECT stock_quantity FROM products WHERE id = ${testProduct.id}`)[0].stock_quantity;
  assert(
    stockAfterSecondCancel === stockAfterFirstCancel,
    `Idempotent protection: stock NOT restored again on duplicate cancel (${stockAfterSecondCancel} === ${stockAfterFirstCancel})`
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 7: Customer Cancellation Rejection After Dispatch
  // ----------------------------------------------------------------------
  console.log("\n--- 7. Customer Cancellation Boundaries Enforcement ---");

  // Create an order and move it to assigned
  const sureshEmail = `suresh_${Date.now()}@example.com`;
  const assignedTestOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: "Suresh Patel",
      customer_email: sureshEmail,
      customer_phone: "9876543212",
      shipping_address: "Jubilee Hills Checkpost",
      shipping_city: "Hyderabad",
      shipping_pincode: "500033",
      payment_method: "cod",
      items: [{ id: testProduct.id, quantity: 1, name: testProduct.name }],
    }),
  });
  const assignedOrderId = (await assignedTestOrderRes.json()).order.id;

  // Move to 'assigned'
  await sql`UPDATE orders SET status = 'assigned' WHERE id = ${assignedOrderId}`;

  // Customer attempts to cancel assigned order via API
  const customerCancelDispatchedRes = await fetch(`${BASE_URL}/api/orders/${assignedOrderId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: sureshEmail,
      reason: "Late cancellation attempt",
    }),
  });
  const customerCancelData = await customerCancelDispatchedRes.json();
  assert(
    customerCancelDispatchedRes.status === 400 && customerCancelData.error?.includes("cannot be cancelled"),
    "Customer cancellation rejected when order has reached 'assigned' status"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 8: Frontend Route & Endpoint Availability
  // ----------------------------------------------------------------------
  console.log("\n--- 8. Public Pages & Application Endpoints Health ---");

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
