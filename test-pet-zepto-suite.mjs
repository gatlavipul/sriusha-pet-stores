import fs from "fs";
if (fs.existsSync(".env")) {
  fs.readFileSync(".env", "utf8").split("\n").forEach((l) => {
    const [k, ...v] = l.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}
import { encode } from "@auth/core/jwt";
import sql from "./src/app/api/utils/sql.js";
import {
  parsePackGrams,
  estimateDailyGrams,
  getCustomerPetPantry,
} from "./src/utils/petPantryService.js";

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
  console.log("   SRI USHA PET ZEPTO — FEATURE VERIFICATION SUITE");
  console.log("=======================================================\n");

  const ts = Date.now();
  const custEmail = `zepto_cust_${ts}@example.com`;
  const driverEmail = `zepto_driver_${ts}@example.com`;
  const password = "TestPassword123!";
  let custId = null;
  let driverId = null;
  let custCookie = "";
  let driverCookie = "";
  let createdOrderId = null;
  let createdPetId = null;
  let createdSubId = null;
  let createdHealthId = null;

  try {
    // 1. Unit checks for Pet Pantry predictor
    console.log("--- 1. Pet Pantry Consumption Math ---");
    assert(parsePackGrams("3 kg") === 3000, "parsePackGrams('3 kg') === 3000");
    assert(parsePackGrams("500 g") === 500, "parsePackGrams('500 g') === 500");
    assert(parsePackGrams("1.5kg Pack") === 1500, "parsePackGrams('1.5kg Pack') === 1500");
    assert(estimateDailyGrams({ species: "Dog", weight_kg: 10 }) > 0, "estimateDailyGrams returns positive daily grams");

    // 2. Auth setup: Create Customer + Delivery Partner & mint session cookies
    console.log("\n--- 2. Setup Test Customer & Delivery Partner ---");
    const custInsert = await sql`
      INSERT INTO auth_users (name, email, role)
      VALUES ('Zepto Customer', ${custEmail}, 'customer')
      RETURNING id, name, email, role
    `;
    custId = custInsert[0]?.id;
    assert(Boolean(custId), "Customer created in auth_users");

    custCookie = await mintSessionCookie(custInsert[0]);
    const meCustRes = await fetch(`${BASE_URL}/api/account/me`, { headers: { Cookie: custCookie } });
    const meCustData = await meCustRes.json();
    assert(meCustRes.ok && meCustData.authenticated === true, "Customer session verified via /api/account/me");

    const driverInsert = await sql`
      INSERT INTO auth_users (name, email, role)
      VALUES ('Zepto Driver', ${driverEmail}, 'delivery_partner')
      RETURNING id, name, email, role
    `;
    driverId = driverInsert[0]?.id;
    driverCookie = await mintSessionCookie(driverInsert[0]);
    const meDriverRes = await fetch(`${BASE_URL}/api/account/me`, { headers: { Cookie: driverCookie } });
    const meDriverData = await meDriverRes.json();
    assert(
      meDriverRes.ok && meDriverData.authenticated === true && meDriverData.user?.role === "delivery_partner",
      "Delivery partner session verified via /api/account/me"
    );

    // 3. Pet creation + Pet Health Passport CRUD
    console.log("\n--- 3. Pet Health Passport CRUD & Due Reminders ---");
    const unauthHealth = await fetch(`${BASE_URL}/api/pets/health`);
    assert(unauthHealth.status === 401, "Unauthenticated GET /api/pets/health rejected with 401");

    const petRows = await sql`
      INSERT INTO pets (user_id, name, type, breed, age, weight_kg)
      VALUES (${custId}, 'Bruno', 'Dog', 'Labrador', '3', 22)
      RETURNING *
    `;
    createdPetId = petRows[0].id;

    const nextDue = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const addHealthRes = await fetch(`${BASE_URL}/api/pets/health`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({
        pet_id: createdPetId,
        record_type: "vaccination",
        title: "Rabies Annual Booster",
        next_due_date: nextDue,
        clinic_name: "Sri Usha Vet Clinic",
      }),
    });
    const addHealthData = await addHealthRes.json();
    createdHealthId = addHealthData.record?.id;
    assert(addHealthRes.status === 201 && Boolean(createdHealthId), "POST /api/pets/health created health record");

    const getHealthRes = await fetch(`${BASE_URL}/api/pets/health?pet_id=${createdPetId}`, {
      headers: { Cookie: custCookie },
    });
    const getHealthData = await getHealthRes.json();
    const rec = getHealthData.records?.find((r) => r.id === createdHealthId);
    assert(
      getHealthRes.ok && rec && rec.days_until_due >= 6 && rec.days_until_due <= 8,
      "GET /api/pets/health computes accurate days_until_due reminder"
    );

    // 4. Delivery OTP + Gentle Delivery Mode Order Lifecycle
    console.log("\n--- 4. Delivery OTP & Gentle Delivery Mode ---");
    const prodRows = await sql`
      SELECT id, name, price, sale_price, stock_quantity
      FROM products
      WHERE COALESCE(requires_prescription, FALSE) = FALSE AND stock_quantity >= 2
      ORDER BY id ASC
      LIMIT 1
    `;
    const prod = prodRows[0];
    assert(Boolean(prod), "Found in-stock non-Rx product for test order");

    const orderRes = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({
        customer_name: "Zepto Customer",
        customer_email: custEmail,
        customer_phone: "9876543210",
        shipping_address: "Plot 12, Tarnaka",
        shipping_city: "Hyderabad",
        shipping_pincode: "500007",
        payment_method: "cod",
        gentle_delivery: true,
        delivery_instructions: "Please call at gate, dog barks at bell",
        items: [
          {
            product_id: prod.id,
            name: prod.name,
            price: Number(prod.sale_price || prod.price),
            quantity: 1,
          },
        ],
      }),
    });
    const orderData = await orderRes.json();
    createdOrderId = orderData.order?.id;
    assert(orderRes.ok && Boolean(createdOrderId), "COD Order placed with Gentle Delivery flags");

    const dbOrders = await sql`SELECT delivery_otp, gentle_delivery, delivery_instructions FROM orders WHERE id = ${createdOrderId}`;
    const savedOtp = dbOrders[0]?.delivery_otp;
    assert(/^\d{4}$/.test(savedOtp || ""), `Server generated 4-digit delivery_otp (${savedOtp})`);
    assert(dbOrders[0]?.gentle_delivery === true, "gentle_delivery persisted as true");
    assert(
      dbOrders[0]?.delivery_instructions === "Please call at gate, dog barks at bell",
      "delivery_instructions persisted"
    );

    // Move order to assigned -> out_for_delivery -> test OTP rejection -> test OTP match
    await sql`
      UPDATE orders
      SET status = 'assigned', assigned_delivery_partner_id = ${driverId}
      WHERE id = ${createdOrderId}
    `;
    const outRes = await fetch(`${BASE_URL}/api/delivery/orders/${createdOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: driverCookie },
      body: JSON.stringify({ status: "out_for_delivery" }),
    });
    assert(outRes.ok, "Delivery partner moved order to out_for_delivery");

    const wrongOtpRes = await fetch(`${BASE_URL}/api/delivery/orders/${createdOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: driverCookie },
      body: JSON.stringify({ status: "delivered", delivery_otp: "0000" === savedOtp ? "9999" : "0000" }),
    });
    assert(wrongOtpRes.status === 400, "PUT /api/delivery/orders/[id] rejects wrong 4-digit Delivery OTP with 400");

    const rightOtpRes = await fetch(`${BASE_URL}/api/delivery/orders/${createdOrderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: driverCookie },
      body: JSON.stringify({ status: "delivered", delivery_otp: savedOtp }),
    });
    assert(rightOtpRes.ok, "PUT /api/delivery/orders/[id] succeeds with matching 4-digit Delivery OTP");

    // 5. Pet Pantry Prediction API
    console.log("\n--- 5. Smart Pet Pantry Prediction API ---");
    const pantryResult = await getCustomerPetPantry(custId);
    assert(Array.isArray(pantryResult?.items) && pantryResult.items.length >= 1, "getCustomerPetPantry returns real order item prediction");

    const pantryApiRes = await fetch(`${BASE_URL}/api/pantry`, {
      headers: { Cookie: custCookie },
    });
    const pantryApiData = await pantryApiRes.json();
    assert(pantryApiRes.ok && Array.isArray(pantryApiData.items) && pantryApiData.items.length >= 1, "GET /api/pantry returns customer pantry items");

    // 6. Pet Subscriptions Lifecycle
    console.log("\n--- 6. Pet Subscriptions Lifecycle ---");
    const subCreateRes = await fetch(`${BASE_URL}/api/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({
        pet_id: createdPetId,
        product_id: prod.id,
        quantity: 1,
        frequency_days: 30,
      }),
    });
    const subCreateData = await subCreateRes.json();
    createdSubId = subCreateData.subscription?.id;
    assert(
      subCreateRes.status === 201 && Number(subCreateData.subscription?.discount_percent) === 5,
      "POST /api/subscriptions creates 30-day subscription with 5% discount"
    );

    const subSkipRes = await fetch(`${BASE_URL}/api/subscriptions/${createdSubId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({ action: "skip" }),
    });
    assert(subSkipRes.ok, "PUT /api/subscriptions/[id] skip succeeded");

    const subPauseRes = await fetch(`${BASE_URL}/api/subscriptions/${createdSubId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({ action: "pause" }),
    });
    const subPauseData = await subPauseRes.json();
    assert(subPauseRes.ok && subPauseData.subscription?.status === "paused", "Subscription paused");

    const subResumeRes = await fetch(`${BASE_URL}/api/subscriptions/${createdSubId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({ action: "resume" }),
    });
    const subResumeData = await subResumeRes.json();
    assert(subResumeRes.ok && subResumeData.subscription?.status === "active", "Subscription resumed");

    const subCancelRes = await fetch(`${BASE_URL}/api/subscriptions/${createdSubId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: custCookie },
      body: JSON.stringify({ action: "cancel" }),
    });
    const subCancelData = await subCancelRes.json();
    assert(subCancelRes.ok && subCancelData.subscription?.status === "cancelled", "Subscription cancelled");

    // Delete health record via API
    const delHealthRes = await fetch(`${BASE_URL}/api/pets/health?id=${createdHealthId}`, {
      method: "DELETE",
      headers: { Cookie: custCookie },
    });
    assert(delHealthRes.ok, "DELETE /api/pets/health removed health record");
  } finally {
    // Cleanup test data
    if (createdHealthId) await sql`DELETE FROM pet_health_records WHERE id = ${createdHealthId}`.catch(() => {});
    if (createdSubId) await sql`DELETE FROM pet_subscriptions WHERE id = ${createdSubId}`.catch(() => {});
    if (createdOrderId) {
      await sql`DELETE FROM notifications WHERE order_id = ${createdOrderId}`.catch(() => {});
      await sql`DELETE FROM order_status_history WHERE order_id = ${createdOrderId}`.catch(() => {});
      await sql`DELETE FROM order_items WHERE order_id = ${createdOrderId}`.catch(() => {});
      await sql`DELETE FROM orders WHERE id = ${createdOrderId}`.catch(() => {});
    }
    if (createdPetId) await sql`DELETE FROM pets WHERE id = ${createdPetId}`.catch(() => {});
    if (custId) await sql`DELETE FROM loyalty_transactions WHERE user_id = ${custId}`.catch(() => {});
    if (custId) await sql`DELETE FROM auth_users WHERE id = ${custId}`.catch(() => {});
    if (driverId) await sql`DELETE FROM auth_users WHERE id = ${driverId}`.catch(() => {});
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test suite error:", err);
  process.exit(1);
});

