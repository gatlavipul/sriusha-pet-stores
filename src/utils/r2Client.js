/**
 * Sri Usha Vet & Pet Stores — Cloudflare R2 Storage Client
 * Edge-native S3-compatible client powered by standard Web Crypto (crypto.subtle).
 * Zero heavy external dependencies, 100% compatible with Cloudflare Workers & Node.js 20+.
 */
import logger from "./logger.js";

export function isR2Configured() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;

  return Boolean(
    accountId &&
    accessKeyId &&
    secretKey &&
    bucket &&
    accountId !== "your_cloudflare_account_id" &&
    accessKeyId !== "your_r2_access_key_id" &&
    secretKey !== "your_r2_secret_access_key" &&
    !accountId.includes("placeholder")
  );
}

// Helpers for AWS SigV4 via Web Crypto
async function sha256Hex(data) {
  const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    typeof data === "string" ? new TextEncoder().encode(data) : data
  );
  return new Uint8Array(signature);
}

async function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  const kSigning = await hmacSha256(kService, "aws4_request");
  return kSigning;
}

/**
 * Uploads an object to Cloudflare R2 using standard S3 REST API (SigV4)
 */
export async function uploadToR2({ key, data, contentType, env = null }) {
  // 1. Direct Cloudflare Worker R2 bucket binding if present
  if (env && env.R2_BUCKET && typeof env.R2_BUCKET.put === "function") {
    try {
      await env.R2_BUCKET.put(key, data, {
        httpMetadata: { contentType: contentType || "application/octet-stream" },
      });
      const publicBase =
        process.env.R2_PUBLIC_URL ||
        env.R2_PUBLIC_URL ||
        `https://${process.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com`;
      const cleanBase = publicBase.replace(/\/+$/, "");
      const cleanKey = key.replace(/^\/+/, "");
      return {
        success: true,
        url: `${cleanBase}/${cleanKey}`,
        key,
        provider: "cloudflare_r2_binding",
      };
    } catch (err) {
      logger.error("r2_binding_upload_error", "Failed to upload via R2 binding", err);
      throw err;
    }
  }

  // 2. S3-Compatible REST API with SigV4
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  const publicBase = process.env.R2_PUBLIC_URL;

  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured in the environment.");
  }

  const endpointHost = `${accountId}.r2.cloudflarestorage.com`;
  const cleanKey = key.replace(/^\/+/, "");
  const requestPath = `/${bucket}/${cleanKey}`;
  const url = `https://${endpointHost}${requestPath}`;

  const payloadBuffer =
    data instanceof ArrayBuffer
      ? data
      : data instanceof Uint8Array
      ? data.buffer
      : Buffer.isBuffer(data)
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : new TextEncoder().encode(String(data)).buffer;

  const payloadHash = await sha256Hex(payloadBuffer);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);
  const region = "auto";
  const service = "s3";

  const canonicalHeaders = [
    `content-type:${contentType || "application/octet-stream"}`,
    `host:${endpointHost}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join("\n") + "\n";

  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    "PUT",
    requestPath,
    "", // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const canonicalRequestHash = await sha256Hex(canonicalRequest);

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signatureHex = Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signatureHex}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      Host: endpointHost,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: authorizationHeader,
    },
    body: payloadBuffer,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error("r2_s3_upload_failed", `R2 S3 API returned status ${response.status}`, {
      status: response.status,
      body: errorBody,
    });
    throw new Error(`R2 upload failed with HTTP ${response.status}: ${errorBody}`);
  }

  const finalPublicBase = publicBase
    ? publicBase.replace(/\/+$/, "")
    : `https://${bucket}.${endpointHost}`;

  return {
    success: true,
    url: `${finalPublicBase}/${cleanKey}`,
    key: cleanKey,
    provider: "cloudflare_r2",
  };
}

export default {
  isR2Configured,
  uploadToR2,
};

