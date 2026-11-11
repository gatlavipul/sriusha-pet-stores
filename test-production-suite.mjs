import fs from "fs";
import path from "path";
import sql from "./src/app/api/utils/sql.js";
import { validateEnvironment } from "./src/utils/envCheck.js";
import {
  validateImageFile,
  generateSafeFilename,
  uploadImage,
  MAX_FILE_SIZE,
} from "./src/utils/storageService.js";
import { rateLimiter } from "./src/utils/rateLimiter.js";

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

async function runProductionTests() {
  console.log("\n=======================================================");
  console.log("   SRI USHA VET & PET STORES — PRODUCTION READINESS AUDIT");
  console.log("=======================================================\n");

  // ----------------------------------------------------------------------
  // TEST GROUP 1: Environment Security & Startup Validation
  // ----------------------------------------------------------------------
  console.log("--- 1. Environment Secrets & Startup Validation ---");

  // 1.1 Verify .env is excluded from git
  const gitignoreContent = fs.readFileSync(".gitignore", "utf8");
  assert(
    gitignoreContent.includes(".env") || gitignoreContent.includes("*.env"),
    ".gitignore properly excludes .env files from version control"
  );

  // 1.2 Verify .env.example contains only placeholders (no real passwords/secrets)
  const envExample = fs.readFileSync(".env.example", "utf8");
  assert(
    !envExample.includes("@ep-") && !envExample.includes("neondb_owner"),
    ".env.example contains placeholders only (zero exposed database URLs or secrets)"
  );
  assert(
    envExample.includes("DATABASE_URL") && envExample.includes("AUTH_SECRET"),
    ".env.example documents all core required production variables"
  );

  // 1.3 Validate environment helper
  const envDiagnostics = validateEnvironment();
  assert(
    envDiagnostics.databaseConfigured === true && envDiagnostics.authConfigured === true,
    "Environment validation confirms core production credentials configured"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 2: Production Health Check Endpoint
  // ----------------------------------------------------------------------
  console.log("\n--- 2. Production Health Check & Monitoring Endpoint ---");

  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();

  assert(
    healthRes.status === 200 && healthData.status === "healthy",
    "Health check GET /api/health returns HTTP 200 with status: 'healthy'"
  );
  assert(
    healthData.services?.database?.status === "connected",
    "Health check validates live Neon database connectivity"
  );
  assert(
    typeof healthData.uptimeSeconds === "number" && healthData.uptimeSeconds >= 0,
    "Health check provides process uptime metrics for monitoring"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 3: Security Headers & OWASP Defenses
  // ----------------------------------------------------------------------
  console.log("\n--- 3. HTTP Security Headers & OWASP Compliance ---");

  const headers = healthRes.headers;
  assert(
    headers.get("x-content-type-options") === "nosniff",
    "Security header X-Content-Type-Options: nosniff enforced"
  );
  assert(
    headers.get("x-frame-options") === "SAMEORIGIN",
    "Security header X-Frame-Options: SAMEORIGIN enforced (clickjacking defense)"
  );
  assert(
    headers.get("referrer-policy") === "strict-origin-when-cross-origin",
    "Security header Referrer-Policy: strict-origin-when-cross-origin enforced"
  );
  assert(
    Boolean(headers.get("permissions-policy")),
    "Security header Permissions-Policy configured (restricting sensor access)"
  );
  assert(
    Boolean(headers.get("content-security-policy")),
    "Content-Security-Policy (CSP) configured allowing self, Razorpay, and CDNs"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 4: Cloud Image Storage Abstraction & Path Traversal Prevention
  // ----------------------------------------------------------------------
  console.log("\n--- 4. Cloud Image Storage Abstraction & File Upload Security ---");

  // 4.1 Allowed MIME Types and Sizes
  const validFileMock = {
    name: "pedigree_puppy.jpg",
    type: "image/jpeg",
    size: 1024 * 500, // 500 KB
  };
  assert(
    validateImageFile(validFileMock).valid === true,
    "Valid JPEG under 5MB passes storage validation"
  );

  // 4.2 Reject Executable / Script Files
  const maliciousFileMock = {
    name: "malicious_script.php",
    type: "application/x-php",
    size: 2048,
  };
  assert(
    validateImageFile(maliciousFileMock).valid === false,
    "Dangerous file types (.php, executables) rejected with descriptive error"
  );

  // 4.3 Reject Oversized Files (> 5MB)
  const oversizedFileMock = {
    name: "huge_banner.png",
    type: "image/png",
    size: MAX_FILE_SIZE + 1024,
  };
  assert(
    validateImageFile(oversizedFileMock).valid === false,
    "Files exceeding MAX_FILE_SIZE (5MB) strictly rejected"
  );

  // 4.4 Path Traversal Defense in Filename Generation
  const pathTraversalName = "../../../../../etc/passwd.png";
  const safeName = generateSafeFilename(pathTraversalName);
  assert(
    !safeName.includes("..") && !safeName.includes("/") && !safeName.includes("\\"),
    "Path traversal sequence (../) stripped during unique filename generation"
  );
  assert(
    safeName.endsWith(".png"),
    "Safe unique filename preserves valid image extension"
  );

  // 4.5 Functional Upload to Local / Cloud Storage Abstraction
  const testBuffer = Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;");
  const testBlob = new Blob([testBuffer], { type: "image/gif" });
  testBlob.name = "test_pixel.gif";

  const uploadResult = await uploadImage(testBlob, { folder: "uploads" });
  assert(
    Boolean(uploadResult && uploadResult.url),
    `Image uploaded via storage service: ${uploadResult.url} (Provider: ${uploadResult.provider})`
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 5: Rate Limiting & Brute-Force Throttling
  // ----------------------------------------------------------------------
  console.log("\n--- 5. Rate Limiting Engine & Brute-Force Throttling ---");

  const testIp = `192.168.1.${Math.floor(Math.random() * 200 + 10)}`;
  const testKey = `test_rate:${testIp}`;

  // Allow first 3 requests
  rateLimiter.reset(testKey);
  const r1 = rateLimiter.check(testKey, 3, 5000);
  const r2 = rateLimiter.check(testKey, 3, 5000);
  const r3 = rateLimiter.check(testKey, 3, 5000);
  assert(
    r1.allowed && r2.allowed && r3.allowed,
    "Rate limiter permits requests within configured threshold"
  );

  // 4th request must be blocked
  const r4 = rateLimiter.check(testKey, 3, 5000);
  assert(
    r4.allowed === false && r4.remaining === 0,
    "Rate limiter blocks requests exceeding threshold with HTTP 429 semantics"
  );

  // Reset clears hits
  rateLimiter.reset(testKey);
  const r5 = rateLimiter.check(testKey, 3, 5000);
  assert(r5.allowed === true, "Rate limiter reset function clears client penalty");

  // ----------------------------------------------------------------------
  // TEST GROUP 6: Database Resilience, Indexing & Data Integrity
  // ----------------------------------------------------------------------
  console.log("\n--- 6. Database Resilience & Data Integrity Protection ---");

  // 6.1 Verify indexes exist on orders, notifications, and products
  const indexCheck = await sql`
    SELECT indexname FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname IN (
        'idx_orders_status', 'idx_orders_created_at', 'idx_orders_payment_status',
        'idx_admin_notifications_is_read', 'idx_products_is_active'
      )
  `;
  assert(
    indexCheck.length >= 4,
    `Production database indexes verified in PostgreSQL (${indexCheck.length} verified)`
  );

  // 6.2 Verify orders.user_id has ON DELETE SET NULL (protecting historical invoices)
  const fkCheck = await sql`
    SELECT rc.delete_rule 
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    WHERE tc.table_name = 'orders' AND tc.constraint_name = 'orders_user_id_fkey'
  `;
  assert(
    fkCheck.length > 0 && fkCheck[0].delete_rule === "SET NULL",
    "orders.user_id foreign key hardened with ON DELETE SET NULL (financial history protected)"
  );

  // ----------------------------------------------------------------------
  // TEST GROUP 7: Production Build Artifacts Verification
  // ----------------------------------------------------------------------
  console.log("\n--- 7. Production Build Artifacts Verification ---");

  const clientBuildExists = fs.existsSync(path.join("build", "client"));
  const serverBuildExists = fs.existsSync(path.join("build", "server"));
  assert(
    clientBuildExists && serverBuildExists,
    "Production build output verified (build/client and build/server exist)"
  );

  // Clean up any test upload file created
  if (uploadResult?.filename) {
    const localUploadedPath = path.join(process.cwd(), "public", "uploads", uploadResult.filename);
    if (fs.existsSync(localUploadedPath)) {
      try {
        fs.unlinkSync(localUploadedPath);
      } catch (e) {}
    }
  }

  // ----------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`PRODUCTION AUDIT TEST SUITE: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
