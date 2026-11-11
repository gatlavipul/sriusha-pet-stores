/**
 * Sri Usha Vet & Pet Stores - Production Environment Validator
 * Ensures all required environment variables are set without leaking secrets.
 */
import logger from "./logger.js";

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "AUTH_SECRET",
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

  // Check optional production integrations
  const diagnostics = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    authConfigured: Boolean(process.env.AUTH_SECRET),
    razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    blobStorageConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN !== "your_vercel_blob_read_write_token"),
    emailConfigured: Boolean(process.env.SENDGRID_API_KEY || process.env.EMAIL_PROVIDER),
    smsConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID || process.env.SMS_PROVIDER),
  };

  return diagnostics;
}

export default validateEnvironment;
