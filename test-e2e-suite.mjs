import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const BASE_URL = 'http://localhost:4000';
const sql = neon(process.env.DATABASE_URL);

async function runTests() {
  console.log("==================================================");
  console.log("SRI USHA PET STORES - COMPREHENSIVE TEST SUITE");
  console.log("==================================================\n");

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

  // -----------------------------------------------------------
  // TEST 1: Guest Browsing Products & Categories
  // -----------------------------------------------------------
  console.log("\n[Scenario 1] Guest Browsing Products & Categories");
  try {
    const catRes = await fetch(`${BASE_URL}/api/categories`);
    const catData = await catRes.json();
    assert(catRes.status === 200 && catData.categories?.length > 0, `Categories API returned ${catData.categories?.length} categories`);

    const prodRes = await fetch(`${BASE_URL}/api/products?limit=8`);
    const prodData = await prodRes.json();
    assert(prodRes.status === 200 && prodData.products?.length > 0, `Products API returned ${prodData.products?.length} products`);

    const firstProduct = prodData.products[0];
    const detailRes = await fetch(`${BASE_URL}/api/products/${firstProduct.slug}`);
    const detailData = await detailRes.json();
    assert(detailRes.status === 200 && detailData.product?.id === firstProduct.id, `Product detail retrieved for "${firstProduct.name}"`);
  } catch (err) {
    assert(false, `Browsing failed: ${err.message}`);
  }

  // -----------------------------------------------------------
  // TEST 2: Unauthorized Admin Access Prevention (Security Audit)
  // -----------------------------------------------------------
  console.log("\n[Scenario 2] Unauthorized Admin Access Protection (Security Audit)");
  try {
    const unauthStats = await fetch(`${BASE_URL}/api/admin/stats`);
    assert(unauthStats.status === 401 || unauthStats.status === 403, `Guest blocked from /api/admin/stats (HTTP ${unauthStats.status})`);

    const unauthOrders = await fetch(`${BASE_URL}/api/admin/orders`);
    assert(unauthOrders.status === 401 || unauthOrders.status === 403, `Guest blocked from /api/admin/orders (HTTP ${unauthOrders.status})`);

    const unauthProds = await fetch(`${BASE_URL}/api/admin/products`);
    assert(unauthProds.status === 401 || unauthProds.status === 403, `Guest blocked from /api/admin/products (HTTP ${unauthProds.status})`);

    const unauthRole = await fetch(`${BASE_URL}/api/admin/check-role`);
    const roleData = await unauthRole.json();
    assert(roleData.isAdmin === false, `Guest role correctly identified as non-admin`);
  } catch (err) {
    assert(false, `Security audit test failed: ${err.message}`);
  }

  // -----------------------------------------------------------
  // TEST 3: Cash on Delivery (COD) Checkout & Stock Decrement
  // -----------------------------------------------------------
  console.log("\n[Scenario 3] COD Checkout, Validation & Stock Decrement");
  let testOrder = null;
  let testProduct = null;
  let initialStock = 0;

  try {
    const products = await sql`SELECT id, name, slug, price, stock_quantity FROM products WHERE is_active = true AND stock_quantity > 2 LIMIT 1`;
    testProduct = products[0];
    initialStock = testProduct.stock_quantity;

    // 1. Test invalid inputs
    const invalidRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: "",
        customer_email: "not-an-email",
        customer_phone: "123",
        items: []
      })
    });
    assert(invalidRes.status === 400, "Server rejected invalid order inputs with 400 Bad Request");

    // 2. Test valid COD order
    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: "Ramesh Sharma",
        customer_email: "ramesh.test@example.com",
        customer_phone: "9876543210",
        shipping_address: "Flat 402, Sri Sai Nilayam, Uppal",
        shipping_city: "Hyderabad",
        shipping_pincode: "500039",
        payment_method: "cod",
        items: [
          {
            product_id: testProduct.id,
            name: testProduct.name,
            quantity: 2,
            price: testProduct.price
          }
        ]
      })
    });

    const orderData = await orderRes.json();
    assert(orderRes.status === 200 && orderData.success, `COD Order placed successfully (ID: ${orderData.order?.id}, Number: ${orderData.order?.order_number})`);
    testOrder = orderData.order;

    // Verify unique order format
    assert(testOrder.order_number?.startsWith("SU-"), `Order reference correctly formatted: ${testOrder.order_number}`);

    // Verify stock decrement in database
    const updatedProd = await sql`SELECT stock_quantity FROM products WHERE id = ${testProduct.id}`;
    const newStock = updatedProd[0].stock_quantity;
    assert(newStock === initialStock - 2, `Stock correctly decremented from ${initialStock} to ${newStock}`);
  } catch (err) {
    assert(false, `COD checkout failed: ${err.message}`);
  }

  // -----------------------------------------------------------
  // TEST 4: Order Receipt Tracking & Customer Cancellation Workflow
  // -----------------------------------------------------------
  console.log("\n[Scenario 4] Order Receipt Tracking & Stock Restoration on Cancellation");
  if (testOrder) {
    try {
      // 1. Fetch order receipt
      const fetchOrd = await fetch(`${BASE_URL}/api/orders/${testOrder.id}?email=ramesh.test@example.com`);
      const ordDetail = await fetchOrd.json();
      assert(fetchOrd.status === 200 && ordDetail.order?.id === testOrder.id, `Order tracking retrieved order #${ordDetail.order?.id}`);

      // 2. Cancel order
      const cancelRes = await fetch(`${BASE_URL}/api/orders/${testOrder.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: "ramesh.test@example.com",
          reason: "Testing cancellation workflow"
        })
      });
      const cancelData = await cancelRes.json();
      assert(cancelRes.status === 200 && cancelData.success, "Order cancellation succeeded");

      // 3. Verify stock restoration in database
      const restoredProd = await sql`SELECT stock_quantity FROM products WHERE id = ${testProduct.id}`;
      assert(restoredProd[0].stock_quantity === initialStock, `Stock restored back to original count (${restoredProd[0].stock_quantity}) upon cancellation`);
    } catch (err) {
      assert(false, `Cancellation workflow failed: ${err.message}`);
    }
  }

  // -----------------------------------------------------------
  // TEST 5: Razorpay Payment Initiation & Cryptographic Verification
  // -----------------------------------------------------------
  console.log("\n[Scenario 5] Razorpay Payment Initiation & Cryptographic Signature Verification");
  try {
    // 1. Initiate checkout
    const initRes = await fetch(`${BASE_URL}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ product_id: testProduct.id, quantity: 1 }],
        promo_code: "USHA10"
      })
    });
    const initData = await initRes.json();
    assert(initRes.status === 200 && initData.orderId, `Razorpay order created securely on backend (ID: ${initData.orderId}, Amount: ₹${initData.finalAmount})`);

    // 2. Tampered signature test (attacker sending fake signature)
    const fakeVerify = await fetch(`${BASE_URL}/api/checkout/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: initData.orderId,
        razorpay_payment_id: "pay_fake123456789",
        razorpay_signature: "invalid_tampered_signature_hex",
        customer_name: "Hacker Test",
        customer_email: "hacker@example.com",
        customer_phone: "9876543210",
        shipping_address: "123 Fake St",
        shipping_city: "Hyderabad",
        shipping_pincode: "500039",
        items: [{ product_id: testProduct.id, quantity: 1 }]
      })
    });
    assert(fakeVerify.status === 400, "Server rejected fraudulent/tampered payment signature with 400");

    // 3. Authentic HMAC signature test
    const mockPaymentId = `pay_test_${Date.now()}`;
    const authenticSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${initData.orderId}|${mockPaymentId}`)
      .digest('hex');

    const validVerify = await fetch(`${BASE_URL}/api/checkout/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: initData.orderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: authenticSignature,
        customer_name: "Priya Rao",
        customer_email: "priya.rao@example.com",
        customer_phone: "9123456780",
        shipping_address: "Plot 88, Uppal Main Road",
        shipping_city: "Hyderabad",
        shipping_pincode: "500039",
        items: [{ product_id: testProduct.id, quantity: 1 }]
      })
    });
    const validData = await validVerify.json();
    assert(validVerify.status === 200 && validData.success, `Authentic HMAC SHA256 signature verified and paid order confirmed (#${validData.order?.order_number})`);

    // 4. Idempotency test (duplicate submission of same payment ID)
    const duplicateVerify = await fetch(`${BASE_URL}/api/checkout/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: initData.orderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: authenticSignature,
        customer_name: "Priya Rao",
        customer_email: "priya.rao@example.com",
        customer_phone: "9123456780",
        shipping_address: "Plot 88, Uppal Main Road",
        shipping_city: "Hyderabad",
        shipping_pincode: "500039",
        items: [{ product_id: testProduct.id, quantity: 1 }]
      })
    });
    const dupData = await duplicateVerify.json();
    assert(dupData.message === "Order already registered", "Idempotency prevents duplicate order submission");
  } catch (err) {
    assert(false, `Razorpay payment test failed: ${err.message}`);
  }

  // -----------------------------------------------------------
  // TEST 6: Reviews & Ratings API
  // -----------------------------------------------------------
  console.log("\n[Scenario 6] Customer Reviews & Rating Engine");
  try {
    const revGet = await fetch(`${BASE_URL}/api/products/${testProduct.slug}/reviews`);
    const revData = await revGet.json();
    assert(revGet.status === 200 && typeof revData.rating === 'number', `Fetched reviews (Average Rating: ${revData.rating}★, Count: ${revData.count})`);

    const newRev = await fetch(`${BASE_URL}/api/products/${testProduct.slug}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: "Dr. Ananya Reddy",
        rating: 5,
        title: "Outstanding Veterinary Quality",
        comment: "Excellent balance of proteins and nutrients. Highly recommended."
      })
    });
    const postData = await newRev.json();
    assert(newRev.status === 200 && postData.success, "New customer review posted and published");
  } catch (err) {
    assert(false, `Reviews test failed: ${err.message}`);
  }

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
