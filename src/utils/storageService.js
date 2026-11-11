/**
 * Sri Usha Vet & Pet Stores - Production Cloud Image Storage Service
 * Provides an abstraction layer over Cloudflare R2 (primary) and Vercel Blob,
 * with a secure local filesystem fallback for development.
 * 100% compatible with Cloudflare Workers runtime and Node.js.
 */
import path from "path";
import fs from "fs";
import crypto from "crypto";
import logger from "./logger.js";
import { isR2Configured, uploadToR2 } from "./r2Client.js";

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
]);

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates file MIME type, extension, and size
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: "No file was provided." };
  }

  // 1. Validate MIME type
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `Unsupported image format "${file.type}". Allowed formats: JPEG, PNG, WebP, GIF.`,
    };
  }

  // 2. Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the 5MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // 3. Validate file extension
  const rawExt = path.extname(file.name || "").toLowerCase();
  if (rawExt && !ALLOWED_EXTENSIONS.has(rawExt)) {
    return {
      valid: false,
      error: `Invalid file extension "${rawExt}". Allowed: .jpg, .jpeg, .png, .webp, .gif.`,
    };
  }

  return { valid: true };
}

/**
 * Generates a collision-resistant, path-traversal-safe filename & object key
 */
export function generateSafeFilename(originalName) {
  const rawExt = path.extname(originalName || "").toLowerCase() || ".png";
  const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".png";

  // Prevent path traversal by isolating the basename
  const isolatedBase = path.basename(originalName || "image", rawExt);
  const sanitizedBase =
    isolatedBase
      .replace(/[^a-zA-Z0-9_\-]/g, "_")
      .substring(0, 40)
      .replace(/^_+|_+$/g, "") || "item";

  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const timestamp = Date.now();

  return `${timestamp}-${randomSuffix}-${sanitizedBase}${ext}`;
}

/**
 * Uploads an image file to the configured storage driver (Cloudflare R2, Blob, or Local fallback)
 */
export async function uploadImage(file, options = {}) {
  // 1. Validation check
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const safeFilename = generateSafeFilename(file.name);
  const folder = options.folder || "uploads";
  const targetKey = `${folder}/${safeFilename}`;

  const arrayBuffer = await file.arrayBuffer();

  // 2. Primary Provider: Cloudflare R2
  if (isR2Configured() || (options.env && options.env.R2_BUCKET)) {
    try {
      const r2Result = await uploadToR2({
        key: targetKey,
        data: arrayBuffer,
        contentType: file.type,
        env: options.env || null,
      });

      logger.info("r2_image_uploaded", `Uploaded image to Cloudflare R2: ${r2Result.url}`, {
        filename: safeFilename,
        key: targetKey,
        size: file.size,
        type: file.type,
      });

      return {
        url: r2Result.url,
        key: targetKey,
        filename: safeFilename,
        size: file.size,
        type: file.type,
        provider: "cloudflare_r2",
      };
    } catch (err) {
      logger.error("r2_upload_error", "Failed to upload to Cloudflare R2", err);
      if (process.env.NODE_ENV === "production") {
        throw new Error("Cloudflare R2 storage service is currently unavailable.");
      }
    }
  }

  // 3. Secondary Cloud Provider: Vercel Blob (if configured)
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken && blobToken.trim() !== "" && blobToken !== "your_vercel_blob_read_write_token") {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(targetKey, file, {
        access: "public",
        addRandomSuffix: false,
      });

      logger.info("cloud_image_uploaded", `Uploaded image to Vercel Blob: ${blob.url}`, {
        filename: safeFilename,
        size: file.size,
        type: file.type,
      });

      return {
        url: blob.url,
        key: targetKey,
        filename: safeFilename,
        size: file.size,
        type: file.type,
        provider: "vercel_blob",
      };
    } catch (err) {
      logger.error("vercel_blob_upload_error", "Failed to upload to Vercel Blob", err);
      if (process.env.NODE_ENV === "production") {
        throw new Error("Cloud image storage service is currently unavailable.");
      }
    }
  }

  // 4. Safe Local Development Fallback
  try {
    const uploadsDir = path.join(process.cwd(), "public", folder);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, safeFilename);
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/${folder}/${safeFilename}`;
    logger.info("local_image_uploaded", `Uploaded image to local storage: ${publicUrl}`, {
      filename: safeFilename,
      size: file.size,
      type: file.type,
    });

    return {
      url: publicUrl,
      key: targetKey,
      filename: safeFilename,
      size: file.size,
      type: file.type,
      provider: "local",
    };
  } catch (err) {
    logger.error("local_image_upload_error", "Failed to save image to local storage", err);
    throw new Error("Failed to store image: " + err.message);
  }
}

export default {
  validateImageFile,
  generateSafeFilename,
  uploadImage,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_EXTENSIONS,
};
