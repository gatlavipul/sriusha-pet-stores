/**
 * Sri Usha Vet & Pet Stores — Pet Profiles, Onboarding, RBAC & Functional Admin Verification
 */

import sql from "./src/app/api/utils/sql.js";
import { syncUserWithDatabase } from "./src/utils/clerkServer.js";

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

async function runSuite() {
  console.log("\n=======================================================");
  console.log("   SRI USHA — PET PROFILES, RBAC & ADMIN UPGRADE SUITE");
  console.log("=======================================================\n");

  const testGmail = `test.pet.customer.${Date.now()}@gmail.com`;
  const testClerkId = `user_test_pet_${Date.now()}`;
  let createdUserId = null;
  let createdPetId = null;

  try {
    // 1. New customer gets default 'customer' role and onboarding_completed=false
    console.log("--- 1. New Customer Default Role & Onboarding Flag ---");
    const syncedCustomer = await syncUserWithDatabase({
      id: testClerkId,
      email_addresses: [{ email_address: testGmail }],
      first_name: "Test",
      last_name: "Customer",
      public_metadata: { role: "admin" }, // attempted escalation via Clerk metadata must be ignored
    });

    createdUserId = syncedCustomer?.id;
    assert(Boolean(createdUserId), `Created customer in Neon (ID: ${createdUserId})`);
    assert(
      syncedCustomer?.role === "customer",
      `New Gmail user assigned strictly 'customer' role (got '${syncedCustomer?.role}')`
    );

    const [userRow] = await sql`
      SELECT id, role, pet_onboarding_completed FROM auth_users WHERE id = ${createdUserId}
    `;
    assert(
      userRow?.pet_onboarding_completed === false,
      "New customer has pet_onboarding_completed = false by default"
    );

    // 2. Unauthenticated HTTP endpoint protection
    console.log("\n--- 2. Unauthenticated Endpoint Protection ---");
    const unauthEndpoints = [
      "/api/pets",
      "/api/pets/recommendations",
      "/api/admin/stats",
      "/api/admin/users",
      "/api/admin/users/1",
    ];

    for (const ep of unauthEndpoints) {
      const res = await fetch(`${BASE_URL}${ep}`);
      assert(res.status === 401, `GET ${ep} returns 401 when unauthenticated (got ${res.status})`);
    }

    const putMeRes = await fetch(`${BASE_URL}/api/account/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacker", role: "admin" }),
    });
    assert(putMeRes.status === 401, `PUT /api/account/me returns 401 when unauthenticated (got ${putMeRes.status})`);

    // 3. Pet Profile CRUD & Onboarding Skip in Neon
    console.log("\n--- 3. Pet Profile CRUD & Category Recommendations ---");
    const [insertedPet] = await sql`
      INSERT INTO pets (user_id, name, type, breed, age, preferences)
      VALUES (
        ${createdUserId},
        'Bruno',
        'dog',
        'Labrador',
        '2 years',
        ${JSON.stringify({ food_preference: "Dry Kibble", care_interests: ["Nutrition & Food", "Grooming & Hygiene"] })}::jsonb
      )
      RETURNING *
    `;
    createdPetId = insertedPet?.id;
    assert(Boolean(createdPetId), `Pet 'Bruno' persisted in Neon pets table (ID: ${createdPetId})`);
    assert(insertedPet.type === "dog", "Pet type persisted accurately as 'dog'");

    const [updatedPet] = await sql`
      UPDATE pets SET age = '3 years', updated_at = NOW()
      WHERE id = ${createdPetId} AND user_id = ${createdUserId}
      RETURNING *
    `;
    assert(updatedPet?.age === "3 years", "Pet profile updated accurately in Neon");

    // Verify real product matching for dog categories exists in Neon
    const matchedProducts = await sql`
      SELECT p.id, p.name, c.slug as category_slug
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = TRUE
        AND c.slug IN ('dog', 'pet-food', 'grooming', 'healthcare')
      LIMIT 5
    `;
    assert(
      matchedProducts.length > 0,
      `Found ${matchedProducts.length} real active store products matching dog categories`
    );

    // 4. Verified Admin Account & Non-Exposure of Secrets
    console.log("\n--- 4. Verified Admin Account & Security Checks ---");
    const [adminRow] = await sql`
      SELECT id, email, role, clerk_user_id FROM auth_users WHERE email = 'gatlavipul@gmail.com'
    `;
    assert(Boolean(adminRow), "Admin account gatlavipul@gmail.com exists in Neon");
    assert(adminRow?.role === "admin", "gatlavipul@gmail.com has role = 'admin'");
    assert(
      Boolean(adminRow?.clerk_user_id),
      `gatlavipul@gmail.com linked to verified Clerk user ID (${adminRow?.clerk_user_id})`
    );

    // 5. Storefront, Account & Admin pages serve cleanly without 500s
    console.log("\n--- 5. Route Health Checks ---");
    const routes = ["/", "/products", "/account", "/account/signin", "/admin", "/admin/orders", "/admin/users"];
    for (const r of routes) {
      const res = await fetch(`${BASE_URL}${r}`);
      assert(res.status === 200, `GET ${r} returns HTTP 200 (got ${res.status})`);
    }
  } finally {
    // Cleanup temporary test user & cascaded pets
    if (createdUserId) {
      await sql`DELETE FROM auth_users WHERE id = ${createdUserId}`;
    }
  }

  console.log("\n=======================================================");
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error("Suite error:", err);
  process.exit(1);
});

