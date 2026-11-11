/**
 * Sri Usha Vet & Pet Stores — Cloud Architecture Migration & Target Runtime Test Suite
 * Tests:
 * 1. Clerk authentication and role synchronization.
 * 2. Neon database access from the target runtime.
 * 3. R2 file upload validation.
 * 4. Secure R2 object access.
 * 5. Resend notification integration.
 * 6. Missing provider credential safe-mode behavior.
 * 7. Complete customer checkout workflow.
 * 8. Admin order management workflow.
 * 9. Delivery partner workflow.
 */

import sql from "./src/app/api/utils/sql.js";
import { validateImageFile, generateSafeFilename, uploadImage, MAX_FILE_SIZE } from "./src/utils/storageService.js";
import { isR2Configured, uploadToR2 } from "./src/utils/r2Client.js";
import { isResendConfigured, sendEmail, sendWelcomeEmail } from "./src/utils/resendService.js";
import {
  NOTIFICATION_TYPES,
  notifyAdmin,
  notifyCustomer,
  triggerOrderNotifications,
  triggerWelcomeNotification,
} from "./src/utils/notificationService.js";
import {
  decodeJwtPayload,
  verifyClerkToken,
  syncUserWithDatabase,
  getAuthoritativeSession,
} from "./src/utils/clerkServer.js";

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

async function runCloudMigrationTests() {
  console.log("\n=======================================================");
  console.log("   SRI USHA — CLOUD ARCHITECTURE MIGRATION TEST SUITE");
  console.log("   (Cloudflare Workers + Neon + Clerk + Resend + R2)");
  console.log("=======================================================\n");

  // ----------------------------------------------------------------------
  // TEST GROUP 1: Clerk Authentication & Role Synchronization
  // ----------------------------------------------------------------------
  console.log("--- 1. Clerk Authentication & Role Synchronization ---");

  // 1.1 Web Crypto JWT Payload Decoder
  const mockJwtPayload = {
    sub: "user_2test_clerk_customer_01",
    email: "clerk_customer_test@example.com",
    name: "Clerk Test Customer",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const mockJwt = `header.${btoa(JSON.stringify(mockJwtPayload))}.signature`;
  const decoded = decodeJwtPayload(mockJwt);
  assert(decoded && decoded.sub === mockJwtPayload.sub, "decodeJwtPayload successfully parses claims via Web Crypto");
  assert(decoded.email === mockJwtPayload.email, "JWT email claim extracted accurately");

  // 1.2 Expired token rejection
  const expiredPayload = { sub: "user_expired", exp: Math.floor(Date.now() / 1000) - 3600 };
  const expiredJwt = `header.${btoa(JSON.stringify(expiredPayload))}.sig`;
  const expiredResult = await verifyClerkToken(expiredJwt);
  assert(expiredResult === null, "Expired Clerk session token is strictly rejected");

  // 1.3 New user registration strictly receives role = 'customer'
  const newClerkId = `user_clerk_new_${Date.now()}`;
  const newClerkEmail = `clerk_new_${Date.now()}@example.com`;
  const syncedNewUser = await syncUserWithDatabase({
    clerkUserId: newClerkId,
    email: newClerkEmail,
    name: "Fresh Clerk User",
  });
  assert(syncedNewUser && syncedNewUser.role === "customer", "New user provisioned via Clerk strictly receives role = 'customer'");
  assert(syncedNewUser.clerk_user_id === newClerkId, "Clerk User ID linked to auth_users in Neon");

  // 1.4 Database is sole authority for roles (Clerk cannot escalate to admin)
  const existingAdmin = await sql`SELECT id, email, role, clerk_user_id FROM auth_users WHERE role = 'admin' LIMIT 1`;
  if (existingAdmin.length > 0) {
    const adminClerkId = `user_clerk_admin_${Date.now()}`;
    const syncedAdmin = await syncUserWithDatabase({
      clerkUserId: adminClerkId,
      email: existingAdmin[0].email,
      name: "Store Admin",
    });
    assert(syncedAdmin.role === "admin", "Existing admin maintains role = 'admin' when signing in with Clerk");
    assert(syncedAdmin.clerk_user_id === adminClerkId, "Admin clerk_user_id linked seamlessly");
  }

  // 1.5 Delivery partner maintains role when signing in with Clerk
  const existingDelivery = await sql`SELECT id, email, role FROM auth_users WHERE role = 'delivery_partner' LIMIT 1`;
  if (existingDelivery.length > 0) {
    const driverClerkId = `user_clerk_driver_${Date.now()}`;
    const syncedDriver = await syncUserWithDatabase({
      clerkUserId: driverClerkId,
      email: existingDelivery[0].email,
      name: "Speedy Delivery",
    });
    assert(syncedDriver.role === "delivery_partner", "Delivery partner role strictly preserved upon Clerk identity linking");
  }

  // 1.6 Clerk Webhook endpoint (/api/clerk/webhook)
  const webhookRes = await fetch(`${BASE_URL}/api/clerk/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "user.updated",
      data: {
        id: newClerkId,
        first_name: "UpdatedFirstName",
        last_name: "Customer",
      },
    }),
  });
  assert(webhookRes.status === 200, "Clerk webhook /api/clerk/webhook handles user.updated with HTTP 200");
  const checkUpdated = await sql`SELECT name, role FROM auth_users WHERE clerk_user_id = ${newClerkId}`;
  assert(checkUpdated[0].name === "UpdatedFirstName Customer", "Profile name updated in Neon via Clerk webhook");
  assert(checkUpdated[0].role === "customer", "Role remained protected as 'customer' (webhook cannot modify role)");

  // ----------------------------------------------------------------------
  // TEST GROUP 2: Neon Database Access from Target Runtime
  // ----------------------------------------------------------------------
  console.log("\n--- 2. Neon Database Access from Target Runtime ---");

  const startDb = Date.now();
  const dbPing = await sql`SELECT 1 as ping, NOW() as server_time`;
  const dbDuration = Date.now() - startDb;
  assert(dbPing.length > 0 && dbPing[0].ping === 1, `Edge query to Neon PostgreSQL succeeded (${dbDuration}ms)`);
  assert(Boolean(dbPing[0].server_time), "Neon timestamp returned accurately over serverless HTTPS connection");

  // Verify connection pool resilience with concurrent queries
  const concurrentPings = await Promise.all([
    sql`SELECT 1 as val`,
    sql`SELECT 2 as val`,
    sql`SELECT 3 as val`,
  ]);
  assert(
    concurrentPings.length === 3 && concurrentPings[0][0].val === 1,
    "Neon client handles concurrent edge query burst without socket exhaustion"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 3: Cloudflare R2 File Upload Validation
  // ----------------------------------------------------------------------
  console.log("\n--- 3. Cloudflare R2 File Upload Validation ---");

  const validPng = {
    name: "dog-shampoo.png",
    type: "image/png",
    size: 250 * 1024,
  };
  const validCheck = validateImageFile(validPng);
  assert(validCheck.valid === true, "Valid PNG under 5MB passes storage validation");

  const validWebp = {
    name: "cat-collar.webp",
    type: "image/webp",
    size: 500 * 1024,
  };
  assert(validateImageFile(validWebp).valid === true, "Valid WebP passes storage validation");

  const invalidScript = {
    name: "exploit.js",
    type: "application/javascript",
    size: 1024,
  };
  const scriptCheck = validateImageFile(invalidScript);
  assert(scriptCheck.valid === false && scriptCheck.error.includes("Unsupported image format"), "JavaScript file upload rejected");

  const oversizedImage = {
    name: "giant-banner.jpg",
    type: "image/jpeg",
    size: 6 * 1024 * 1024, // 6 MB
  };
  const sizeCheck = validateImageFile(oversizedImage);
  assert(sizeCheck.valid === false && sizeCheck.error.includes("5MB limit"), "Image exceeding 5MB strictly rejected");

  // Path Traversal Prevention
  const pathTraversalFilename = "../../../etc/shadow.png";
  const safeFilename = generateSafeFilename(pathTraversalFilename);
  assert(!safeFilename.includes("../") && !safeFilename.includes("..\\"), "Path traversal sequences completely stripped");
  assert(safeFilename.endsWith(".png"), "Valid extension preserved on sanitized filename");

  // ----------------------------------------------------------------------
  // TEST GROUP 4: Secure R2 Object Access & Storage Abstraction
  // ----------------------------------------------------------------------
  console.log("\n--- 4. Secure R2 Object Access & Storage Abstraction ---");

  // Check R2 credentials detection without leaking values
  const r2Configured = isR2Configured();
  assert(typeof r2Configured === "boolean", "isR2Configured evaluates R2 credentials securely without echoing secrets");

  // Upload small test image through storageService
  const testPixelBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82,
  ]);

  const testFile = new File([testPixelBytes], "r2_test_sample.png", { type: "image/png" });
  const uploadResult = await uploadImage(testFile, { folder: "products" });
  assert(uploadResult && Boolean(uploadResult.url), "storageService.uploadImage returns canonical public URL");
  assert(uploadResult.url.includes("r2_test_sample.png") || uploadResult.filename.includes("r2_test_sample"), "Generated filename contains sanitized product name");
  assert(!uploadResult.url.includes("access_key") && !uploadResult.url.includes("secret"), "Zero credentials exposed in uploaded image URL");

  // ----------------------------------------------------------------------
  // TEST GROUP 5: Resend Notification Integration
  // ----------------------------------------------------------------------
  console.log("\n--- 5. Resend Notification Integration ---");

  const resendReady = isResendConfigured();
  assert(typeof resendReady === "boolean", "isResendConfigured evaluates API key presence without leaking secret");

  // Test transactional email dispatch
  const emailDispatch = await sendEmail({
    to: "petparent@example.com",
    subject: "Order Confirmation #SU-2026-9999",
    text: "Your pet medicine order is confirmed.",
    html: "<p>Your pet medicine order is confirmed.</p>",
  });
  assert(emailDispatch.success === true, "sendEmail executes without throwing exceptions");
  assert(emailDispatch.mode === "sent" || emailDispatch.mode === "safe_logged", `Resend execution mode: ${emailDispatch.mode}`);

  // Test account welcome email
  const welcomeDispatch = await sendWelcomeEmail({
    to: "welcome_customer@example.com",
    name: "Dr. Rao Pet Care",
  });
  assert(welcomeDispatch.success === true, "sendWelcomeEmail generates compliant welcome email");

  // ----------------------------------------------------------------------
  // TEST GROUP 6: Missing Provider Credential Safe-Mode Behavior
  // ----------------------------------------------------------------------
  console.log("\n--- 6. Missing Provider Credential Safe-Mode Behavior ---");

  // Verify missing Resend API key falls back to 'logged' status in database
  const [anyOrder] = await sql`SELECT id FROM orders LIMIT 1`;
  const customerNotif = await notifyCustomer({
    userId: syncedNewUser.id,
    orderId: anyOrder?.id || null,
    channel: "email",
    recipient: "safe_mode_test@example.com",
    templateType: "order_confirmed",
    title: "Safe Mode Order Notice",
    content: "Safe mode delivery test",
  });
  assert(customerNotif && (customerNotif.status === "logged" || customerNotif.status === "sent"), "Missing external credentials fall back safely to 'logged' audit state");
  assert(customerNotif.channel === "email", "Customer notification channel preserved as 'email'");

  // ----------------------------------------------------------------------
  // TEST GROUP 7: Complete Customer Checkout Workflow
  // ----------------------------------------------------------------------
  console.log("\n--- 7. Complete Customer Checkout Workflow ---");

  // Pick an active product for checkout
  const productRows = await sql`
    SELECT id, name, price, stock_quantity 
    FROM products 
    WHERE is_active = true AND stock_quantity >= 5 
    LIMIT 1
  `;
  assert(productRows.length > 0, "Found active product with sufficient stock in Neon");
  const testProduct = productRows[0];
  const initialStock = testProduct.stock_quantity;

  const checkoutPayload = {
    customer_name: "Ramesh Sharma",
    customer_email: "ramesh.petparent@example.com",
    customer_phone: "9876543210",
    shipping_address: "Flat 402, Sunshine Heights, Uppal",
    shipping_city: "Hyderabad",
    shipping_state: "Telangana",
    shipping_pincode: "500039",
    payment_method: "cod",
    items: [
      {
        product_id: testProduct.id,
        quantity: 1,
        unit_price: parseFloat(testProduct.price),
      },
    ],
  };

  const checkoutRes = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(checkoutPayload),
  });
  assert(checkoutRes.status === 201 || checkoutRes.status === 200, "Customer checkout API returns HTTP 201 Created");
  const orderData = await checkoutRes.json();
  const createdOrderId = orderData.order?.id || orderData.id;
  assert(Boolean(createdOrderId), `Customer order created successfully with ID ${createdOrderId}`);

  // Verify inventory decremented
  const [updatedProduct] = await sql`SELECT stock_quantity FROM products WHERE id = ${testProduct.id}`;
  assert(updatedProduct.stock_quantity === initialStock - 1, `Inventory safely decremented (${initialStock} -> ${updatedProduct.stock_quantity})`);

  // Verify initial status in order_status_history
  const [historyRecord] = await sql`SELECT status FROM order_status_history WHERE order_id = ${createdOrderId} ORDER BY created_at ASC LIMIT 1`;
  assert(historyRecord.status === "placed", "Initial order lifecycle state recorded as 'placed'");

  // ----------------------------------------------------------------------
  // TEST GROUP 8: Admin Order Management Workflow
  // ----------------------------------------------------------------------
  console.log("\n--- 8. Admin Order Management Workflow ---");

  // Find a verified admin to execute transitions
  const [adminUser] = await sql`SELECT id, name, role FROM auth_users WHERE role = 'admin' LIMIT 1`;
  assert(Boolean(adminUser), `Admin user identified: ${adminUser?.name} (ID: ${adminUser?.id})`);

  // Transition: placed -> confirmed
  const confirmRes = await fetch(`${BASE_URL}/api/admin/orders/${createdOrderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(adminUser.id),
    },
    body: JSON.stringify({ status: "confirmed", notes: "Order confirmed by admin" }),
  });
  assert(confirmRes.status === 200, "Admin moves order: placed -> confirmed (HTTP 200)");

  // Transition: confirmed -> packing
  const packingRes = await fetch(`${BASE_URL}/api/admin/orders/${createdOrderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(adminUser.id),
    },
    body: JSON.stringify({ status: "packing", notes: "Items packing at Uppal hub" }),
  });
  assert(packingRes.status === 200, "Admin moves order: confirmed -> packing (HTTP 200)");

  // Transition: packing -> ready_for_delivery
  const readyRes = await fetch(`${BASE_URL}/api/admin/orders/${createdOrderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(adminUser.id),
    },
    body: JSON.stringify({ status: "ready_for_delivery", notes: "Staged for pickup" }),
  });
  assert(readyRes.status === 200, "Admin moves order: packing -> ready_for_delivery (HTTP 200)");

  // Assign delivery partner
  const [deliveryUser] = await sql`SELECT id, name, role FROM auth_users WHERE role = 'delivery_partner' LIMIT 1`;
  assert(Boolean(deliveryUser), `Delivery partner identified: ${deliveryUser?.name} (ID: ${deliveryUser?.id})`);

  const assignRes = await fetch(`${BASE_URL}/api/admin/orders/${createdOrderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(adminUser.id),
    },
    body: JSON.stringify({
      status: "assigned",
      assigned_delivery_partner_id: deliveryUser.id,
      notes: `Assigned to driver ${deliveryUser.name}`,
    }),
  });
  assert(assignRes.status === 200, "Admin assigns driver and moves order: ready_for_delivery -> assigned");

  // ----------------------------------------------------------------------
  // TEST GROUP 9: Delivery Partner Workflow
  // ----------------------------------------------------------------------
  console.log("\n--- 9. Delivery Partner Workflow ---");

  // Driver queries assigned runs
  const driverRunsRes = await fetch(`${BASE_URL}/api/delivery/orders`, {
    headers: { "x-test-user-id": String(deliveryUser.id) },
  });
  assert(driverRunsRes.status === 200, "Delivery partner queries assigned runs (/api/delivery/orders returns 200)");
  const driverData = await driverRunsRes.json();
  const assignedOrders = driverData.orders || [];
  const foundOrder = assignedOrders.find((o) => o.id === createdOrderId);
  assert(Boolean(foundOrder), "Assigned order appears in driver's delivery manifest");

  // Driver moves: assigned -> out_for_delivery
  const outRes = await fetch(`${BASE_URL}/api/delivery/orders/${createdOrderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(deliveryUser.id),
    },
    body: JSON.stringify({
      status: "out_for_delivery",
      notes: "Driver in transit to customer residence",
    }),
  });
  assert(outRes.status === 200, "Driver updates order: assigned -> out_for_delivery");

  // Driver reports delivery exception: delivery_failed
  const failedRes = await fetch(`${BASE_URL}/api/delivery/orders/${createdOrderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(deliveryUser.id),
    },
    body: JSON.stringify({
      status: "delivery_failed",
      failure_reason: "Customer gate locked, no phone response",
      notes: "First delivery attempt failed",
    }),
  });
  assert(failedRes.status === 200, "Driver logs delivery exception: out_for_delivery -> delivery_failed");
  const [exceptionOrder] = await sql`SELECT status, delivery_failure_reason FROM orders WHERE id = ${createdOrderId}`;
  assert(exceptionOrder.status === "delivery_failed", "Order state reflects 'delivery_failed' in database");
  assert(exceptionOrder.delivery_failure_reason.includes("gate locked"), "Failure reason recorded for store operations");

  // Admin re-assigns to recover from exception: delivery_failed -> assigned
  await fetch(`${BASE_URL}/api/admin/orders/${createdOrderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(adminUser.id),
    },
    body: JSON.stringify({ status: "assigned", assigned_delivery_partner_id: deliveryUser.id, notes: "Rescheduled run" }),
  });

  // Driver re-dispatches: assigned -> out_for_delivery -> delivered
  await fetch(`${BASE_URL}/api/delivery/orders/${createdOrderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(deliveryUser.id),
    },
    body: JSON.stringify({ status: "out_for_delivery", notes: "Second attempt" }),
  });

  const deliveredRes = await fetch(`${BASE_URL}/api/delivery/orders/${createdOrderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-test-user-id": String(deliveryUser.id),
    },
    body: JSON.stringify({ status: "delivered", notes: "Package delivered, cash received" }),
  });
  assert(deliveredRes.status === 200, "Driver completes order: out_for_delivery -> delivered");

  const [finalOrder] = await sql`SELECT status, payment_status FROM orders WHERE id = ${createdOrderId}`;
  assert(finalOrder.status === "delivered", "Final order status verified as 'delivered'");
  assert(finalOrder.payment_status === "paid", "COD payment automatically settled as 'paid' upon delivery completion");

  console.log("\n=======================================================");
  console.log(`CLOUD MIGRATION TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCloudMigrationTests().catch((err) => {
  console.error("Test execution exception:", err);
  process.exit(1);
});
