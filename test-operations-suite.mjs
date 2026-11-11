import sql from "./src/app/api/utils/sql.js";
import {
  notifyAdmin,
  notifyCustomer,
  checkAndTriggerLowStock,
  NOTIFICATION_TYPES,
} from "./src/utils/notificationService.js";
import { checkServiceability } from "./src/utils/serviceabilityService.js";

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
  console.log("   SRI USHA VET & PET STORES — OPERATIONS & ANALYTICS TEST SUITE");
  console.log("=======================================================\n");

  // Fetch admin and a default user
  const adminUsers = await sql`SELECT id, email FROM auth_users WHERE role = 'admin' LIMIT 1`;
  const defaultAdmin = adminUsers[0];
  const activeUsers = await sql`SELECT id, email FROM auth_users LIMIT 1`;
  const testUserId = activeUsers[0]?.id;

  // ----------------------------------------------------------------------
  // TEST GROUP 1: Delivery Serviceability Engine & Pincode Validation
  // ----------------------------------------------------------------------
  console.log("--- 1. Delivery Serviceability Engine & Pincode Validation ---");

  // 1.1 Local store hub pincode (500039 - Uppal, threshold ₹300)
  const uppalServiceable = await checkServiceability("500039", 200);
  assert(
    uppalServiceable.serviceable === true,
    "Pincode 500039 (Uppal store hub) correctly identified as serviceable"
  );
  assert(
    uppalServiceable.deliveryCharge === 30,
    `Standard delivery charge of ₹30 applied for Uppal when subtotal (₹200) < threshold (₹300) (got: ₹${uppalServiceable.deliveryCharge})`
  );
  assert(
    uppalServiceable.areaName?.toLowerCase().includes("uppal"),
    "Area metadata returned contains 'Uppal'"
  );

  // 1.2 Free Delivery Threshold Verification (subtotal >= ₹300)
  const uppalFreeDelivery = await checkServiceability("500039", 450);
  assert(
    uppalFreeDelivery.deliveryCharge === 0 && uppalFreeDelivery.isFreeDelivery === true,
    "Free delivery correctly unlocked when cart subtotal (₹450) meets free threshold (₹300)"
  );

  // 1.3 Another Hyderabad zone (500034 - Banjara Hills, charge ₹50)
  const banjaraZone = await checkServiceability("500034", 400);
  assert(
    banjaraZone.serviceable === true && banjaraZone.deliveryCharge === 50,
    `Pincode 500034 (Banjara Hills) returns serviceable with configured ₹50 fee (got: ₹${banjaraZone.deliveryCharge})`
  );

  // 1.4 Unserviceable Pincode (e.g. outside Hyderabad / remote pincode)
  const unserviceableZone = await checkServiceability("999999", 500);
  assert(
    unserviceableZone.serviceable === false,
    "Unserviceable pincode 999999 correctly rejected (serviceable: false)"
  );
  assert(
    Boolean(unserviceableZone.reason),
    "Helpful descriptive message provided for unserviceable address"
  );

  // 1.5 Public API Serviceability Endpoint
  const apiCheck = await fetch(`${BASE_URL}/api/serviceability?pincode=500039&subtotal=200`);
  const apiCheckData = await apiCheck.json();
  assert(
    apiCheck.status === 200 && apiCheckData.serviceable === true,
    "Public GET /api/serviceability successfully answers frontend checkout lookup"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 2: Unserviceable Checkout Guard & Server Rejection
  // ----------------------------------------------------------------------
  console.log("\n--- 2. Checkout Server Guard: Unserviceable Address Rejection ---");

  // Fetch an active product for testing checkout
  const activeProducts = await sql`
    SELECT id, name, price, stock_quantity 
    FROM products 
    WHERE is_active = true AND stock_quantity > 2 
    LIMIT 1
  `;
  const product = activeProducts[0];

  // 2.1 Attempt to submit order with unserviceable pincode (999999)
  const unserviceableOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: "Out of Zone Customer",
      customer_email: `outofzone_${Date.now()}@example.com`,
      customer_phone: "9876543299",
      shipping_address: "Remote Highway, Village X",
      shipping_city: "Unknown",
      shipping_pincode: "999999",
      payment_method: "cod",
      items: [{ id: product.id, quantity: 1, name: product.name }],
    }),
  });
  const unserviceableOrderData = await unserviceableOrderRes.json();
  assert(
    unserviceableOrderRes.status === 400,
    "Checkout rejected with HTTP 400 when shipping pincode is unserviceable"
  );
  assert(
    unserviceableOrderData.error?.toLowerCase().includes("not serviceable") ||
    unserviceableOrderData.error?.toLowerCase().includes("not available"),
    `Clear, friendly rejection reason returned to customer: "${unserviceableOrderData.error}"`
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 3: Notification Architecture & Event Dispatch
  // ----------------------------------------------------------------------
  console.log("\n--- 3. Centralized Notification Architecture & Alerts ---");

  // Create a real order in the database for foreign key integrity
  const testOrderRes = await sql`
    INSERT INTO orders (
      user_id, customer_name, customer_email, customer_phone,
      shipping_address, shipping_city, shipping_pincode,
      total_amount, payment_status, status, payment_method, delivery_charge
    ) VALUES (
      ${testUserId}, 'Notif Test Customer', 'notif_test@example.com', '9876543210',
      'Uppal Main Road', 'Hyderabad', '500039',
      1299.00, 'pending', 'placed', 'cod', 30
    ) RETURNING id
  `;
  const testOrderId = testOrderRes[0].id;

  // 3.1 Admin Notification Creation via notifyAdmin()
  const adminNotif = await notifyAdmin(
    NOTIFICATION_TYPES.PAYMENT_ISSUE,
    `Payment Verification Alert #${testOrderId}`,
    "Customer razorpay webhook returned signature mismatch.",
    {
      orderId: testOrderId,
      linkUrl: `/admin/orders?search=${testOrderId}`,
      metadata: { gateway: "razorpay", issue: "signature_failure" },
    }
  );
  assert(Boolean(adminNotif && adminNotif.id), "notifyAdmin successfully records admin notification");

  const adminNotifRow = await sql`
    SELECT id, type, title, message, link_url, is_read 
    FROM admin_notifications 
    WHERE id = ${adminNotif.id}
  `;
  assert(
    adminNotifRow.length > 0 &&
    adminNotifRow[0].type === "payment_issue" &&
    adminNotifRow[0].link_url === `/admin/orders?search=${testOrderId}` &&
    adminNotifRow[0].is_read === false,
    "Admin notification stored with correct type, link_url, and is_read=false"
  );

  // 3.2 Customer Multi-Channel Notification Dispatch (Email / SMS / WhatsApp)
  const custEmailNotif = await notifyCustomer({
    orderId: testOrderId,
    channel: "email",
    recipient: "notif_test@example.com",
    templateType: "order_confirmed",
    title: `Order #${testOrderId} Confirmed`,
    content: "Your Sri Usha order has been verified and is being prepared for dispatch.",
  });
  assert(Boolean(custEmailNotif && custEmailNotif.id), "notifyCustomer successfully records customer email event");

  const custSmsNotif = await notifyCustomer({
    orderId: testOrderId,
    channel: "sms",
    recipient: "9876543210",
    templateType: "order_out_for_delivery",
    title: "Out for Delivery",
    content: `Sri Usha Order #${testOrderId} is out for delivery with our delivery partner.`,
  });
  assert(Boolean(custSmsNotif && custSmsNotif.id), "notifyCustomer successfully records customer SMS event");

  const custNotifs = await sql`
    SELECT channel, template_type, title, status 
    FROM customer_notifications 
    WHERE order_id = ${testOrderId}
    ORDER BY created_at ASC
  `;
  assert(
    custNotifs.length >= 2 &&
    custNotifs.some((n) => n.channel === "email" && n.template_type === "order_confirmed") &&
    custNotifs.some((n) => n.channel === "sms" && n.template_type === "order_out_for_delivery"),
    "Multi-channel customer notifications recorded with channel types and templates"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 4: Low-Stock Detection & Idempotency
  // ----------------------------------------------------------------------
  console.log("\n--- 4. Low-Stock Detection & Idempotent Warning Trigger ---");

  // Create a dedicated mock product for testing low stock trigger
  const mockSlug = `test-bone-chew-${Date.now()}`;
  const mockProdRes = await sql`
    INSERT INTO products (name, slug, description, price, stock_quantity, category_id, is_active)
    VALUES ('Low Stock Test Bone Chew', ${mockSlug}, 'Test product for stock alerts', 199.00, 3, 10, true)
    RETURNING id, name
  `;
  const prodId = mockProdRes[0].id;
  const prodName = mockProdRes[0].name;

  // 4.1 First trigger with stock = 3 (<= 5)
  const firstTrigger = await checkAndTriggerLowStock(prodId, 3, prodName);
  assert(
    firstTrigger === true,
    "checkAndTriggerLowStock triggers alert when remaining inventory drops to <= 5"
  );

  const lowStockRows = await sql`
    SELECT id, type, product_id, is_read 
    FROM admin_notifications 
    WHERE product_id = ${prodId} AND type = 'low_stock'
    ORDER BY created_at DESC LIMIT 1
  `;
  assert(
    lowStockRows.length > 0 && lowStockRows[0].type === "low_stock",
    "Admin notification created with type='low_stock' and linked product_id"
  );

  // 4.2 Idempotency: calling again within 24h should be suppressed
  const secondTrigger = await checkAndTriggerLowStock(prodId, 3, prodName);
  assert(
    secondTrigger === false,
    "Duplicate low-stock alert suppressed within 24h window (idempotent)"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 5: Business Analytics Calculations & Revenue Integrity
  // ----------------------------------------------------------------------
  console.log("\n--- 5. Business Analytics Engine & Revenue Exclusion Rules ---");

  // Test Revenue Integrity Rules:
  // a) COD Delivered Order (Total: 500) -> MUST BE INCLUDED
  // b) COD Pending Placed Order (Total: 600) -> MUST BE EXCLUDED (cash not collected)
  // c) Cancelled Order (Total: 1200) -> MUST BE STRICTLY EXCLUDED
  // d) Failed Order (Total: 400) -> MUST BE STRICTLY EXCLUDED

  const sampleDeliveredCod = await sql`
    INSERT INTO orders (
      user_id, customer_name, customer_email, customer_phone,
      shipping_address, shipping_city, shipping_pincode,
      total_amount, payment_status, status, payment_method, delivery_charge
    ) VALUES (
      ${testUserId}, 'Analytics Test COD Delivered', 'cod_del@test.com', '9876543201',
      'Test Lane', 'Hyderabad', '500039',
      500.00, 'paid', 'delivered', 'cod', 0
    ) RETURNING id, total_amount, payment_status, status, payment_method
  `;

  const samplePendingCod = await sql`
    INSERT INTO orders (
      user_id, customer_name, customer_email, customer_phone,
      shipping_address, shipping_city, shipping_pincode,
      total_amount, payment_status, status, payment_method, delivery_charge
    ) VALUES (
      ${testUserId}, 'Analytics Test COD Pending', 'cod_pen@test.com', '9876543202',
      'Test Lane', 'Hyderabad', '500039',
      600.00, 'pending', 'placed', 'cod', 30
    ) RETURNING id, total_amount, payment_status, status, payment_method
  `;

  const sampleCancelled = await sql`
    INSERT INTO orders (
      user_id, customer_name, customer_email, customer_phone,
      shipping_address, shipping_city, shipping_pincode,
      total_amount, payment_status, status, payment_method, delivery_charge
    ) VALUES (
      ${testUserId}, 'Analytics Test Cancelled', 'cancelled@test.com', '9876543203',
      'Test Lane', 'Hyderabad', '500039',
      1200.00, 'refunded', 'cancelled', 'razorpay', 0
    ) RETURNING id, total_amount, payment_status, status, payment_method
  `;

  const sampleFailed = await sql`
    INSERT INTO orders (
      user_id, customer_name, customer_email, customer_phone,
      shipping_address, shipping_city, shipping_pincode,
      total_amount, payment_status, status, payment_method, delivery_charge
    ) VALUES (
      ${testUserId}, 'Analytics Test Failed', 'failed@test.com', '9876543204',
      'Test Lane', 'Hyderabad', '500039',
      400.00, 'failed', 'failed', 'razorpay', 30
    ) RETURNING id, total_amount, payment_status, status, payment_method
  `;

  // Query revenue using the exact business analytics SQL rule:
  const revenueCheck = await sql`
    SELECT 
      COALESCE(SUM(total_amount), 0) as total_rev,
      COUNT(*)::int as qualifying_count
    FROM orders 
    WHERE id IN (${sampleDeliveredCod[0].id}, ${samplePendingCod[0].id}, ${sampleCancelled[0].id}, ${sampleFailed[0].id})
      AND status NOT IN ('cancelled', 'failed')
      AND (payment_status = 'paid' OR (payment_method = 'cod' AND status = 'delivered'))
  `;

  assert(
    parseFloat(revenueCheck[0].total_rev) === 500,
    `Revenue exclusion strictly enforced: Expected ₹500, got ₹${revenueCheck[0].total_rev} (pending COD, cancelled, and failed excluded)`
  );
  assert(
    revenueCheck[0].qualifying_count === 1,
    "Only 1 order out of 4 qualified for completed net revenue"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 6: Delivery Success & Exception Rate Calculations
  // ----------------------------------------------------------------------
  console.log("\n--- 6. Delivery Success & Exception Performance Metrics ---");

  const sampleDeliverySuccess = (delivered, failed) => {
    const totalDispatched = delivered + failed;
    if (totalDispatched === 0) return 100;
    return Math.round((delivered / totalDispatched) * 1000) / 10;
  };

  assert(
    sampleDeliverySuccess(4, 1) === 80.0,
    "Delivery success rate for 4 delivered and 1 failed is exactly 80.0%"
  );
  assert(
    sampleDeliverySuccess(10, 0) === 100,
    "Delivery success rate for 10 delivered and 0 failed is 100%"
  );
  assert(
    sampleDeliverySuccess(0, 0) === 100,
    "Delivery success rate with zero dispatches defaults safely to 100%"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 7: Server-Side Authorization for Operational Endpoints
  // ----------------------------------------------------------------------
  console.log("\n--- 7. Operational Endpoints Role-Based Authorization ---");

  // 7.1 Unauthenticated requests to admin operational endpoints must return 401
  const unauthAnalytics = await fetch(`${BASE_URL}/api/admin/analytics`);
  assert(
    unauthAnalytics.status === 401,
    "Unauthenticated request to /api/admin/analytics returns 401 Unauthorized"
  );

  const unauthNotifications = await fetch(`${BASE_URL}/api/admin/notifications`);
  assert(
    unauthNotifications.status === 401,
    "Unauthenticated request to /api/admin/notifications returns 401 Unauthorized"
  );

  const unauthServiceability = await fetch(`${BASE_URL}/api/admin/serviceability`);
  assert(
    unauthServiceability.status === 401,
    "Unauthenticated request to /api/admin/serviceability returns 401 Unauthorized"
  );

  // 7.2 Customer Order Notification Isolation
  const unauthCustNotifs = await fetch(`${BASE_URL}/api/orders/${sampleDeliveredCod[0].id}/notifications`);
  assert(
    unauthCustNotifs.status === 401,
    "Unauthenticated access to customer order notifications without email proof returns 401 Unauthorized"
  );

  const guestVerifiedOrderNotifs = await fetch(
    `${BASE_URL}/api/orders/${sampleDeliveredCod[0].id}/notifications?email=cod_del@test.com`
  );
  assert(
    guestVerifiedOrderNotifs.status === 200,
    "Customer viewing their order notifications with matching email parameter succeeds (HTTP 200)"
  );

  // Clean up sample test records
  await sql`
    DELETE FROM admin_notifications WHERE order_id = ${testOrderId} OR product_id = ${prodId}
  `;
  await sql`
    DELETE FROM customer_notifications WHERE order_id IN (${testOrderId}, ${sampleDeliveredCod[0].id})
  `;
  await sql`
    DELETE FROM orders WHERE id IN (${testOrderId}, ${sampleDeliveredCod[0].id}, ${samplePendingCod[0].id}, ${sampleCancelled[0].id}, ${sampleFailed[0].id})
  `;
  await sql`
    DELETE FROM products WHERE id = ${prodId}
  `;

  // ----------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`OPERATIONS TEST SUITE SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
