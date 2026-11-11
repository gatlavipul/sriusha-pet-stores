/**
 * Sri Usha Vet & Pet Stores - Production Environment Validator
 * Ensures all required environment variables are set without leaking secrets.
 * Validates Neon, Clerk, Cloudflare R2, Resend, and Razorpay configurations.
 */
import logger from "./logger.js";

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
];

export function validateEnvironment() {
  const isProduction = process.env.NODE_ENV === "production";
  const missing = [];

  for (const envVar of REQUIRED_IN_PRODUCTION) {
    if (!process.env[envVar] || process.env[envVar].trim() === "") {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    const errorMsg = `Critical configuration error: Missing required environment variable(s): ${missing.join(", ")}`;
    if (isProduction) {
      logger.error("missing_required_env", errorMsg, null, { missing });
      throw new Error(errorMsg);
    } else {
      logger.warn("missing_env_development", `${errorMsg} (Running in development mode)`);
    }
  }

  // Diagnostics summary for target cloud architecture
  const diagnostics = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    authConfigured: Boolean(process.env.AUTH_SECRET || process.env.CLERK_SECRET_KEY),
    clerkAuth: Boolean(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY &&
      !process.env.CLERK_SECRET_KEY.includes("placeholder")
    ),
    cloudflareR2: Boolean(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME &&
      !process.env.R2_ACCOUNT_ID.includes("placeholder")
    ),
    resendEmail: Boolean(
      process.env.RESEND_API_KEY &&
      !process.env.RESEND_API_KEY.includes("placeholder")
    ),
    razorpay: Boolean(
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      !process.env.RAZORPAY_KEY_ID.includes("placeholder")
    ),
    razorpayConfigured: Boolean(
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      !process.env.RAZORPAY_KEY_ID.includes("placeholder")
    ),
    blobStorageConfigured: Boolean(
      (process.env.R2_ACCOUNT_ID && !process.env.R2_ACCOUNT_ID.includes("placeholder")) ||
      (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN !== "your_vercel_blob_read_write_token")
    ),
  };

  return diagnostics;
}

export default validateEnvironment;
