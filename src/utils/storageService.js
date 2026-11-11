/**
 * Sri Usha Vet & Pet Stores - Production Cloud Image Storage Service
 * Provides an abstraction layer over cloud providers (Vercel Blob, S3/R2)
 * with a secure local filesystem fallback for development.
 */
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { put } from "@vercel/blob";
import logger from "./logger.js";

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
 * Generates a collision-resistant, path-traversal-safe filename
 */
export function generateSafeFilename(originalName) {
  const rawExt = path.extname(originalName || "").toLowerCase() || ".png";
  const ext = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : ".png";

  // Prevent path traversal by isolating the basename
  const isolatedBase = path.basename(originalName || "image", rawExt);
  const sanitizedBase = isolatedBase
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .substring(0, 40)
    .replace(/^_+|_+$/g, "") || "item";

  const randomSuffix = crypto.randomBytes(4).toString("hex");
  const timestamp = Date.now();

  return `${timestamp}-${randomSuffix}-${sanitizedBase}${ext}`;
}

/**
 * Uploads an image file to the configured storage driver
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

  // 2. Provider: Vercel Blob
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken && blobToken.trim() !== "" && blobToken !== "your_vercel_blob_read_write_token") {
    try {
      const blob = await put(targetKey, file, {
        access: "public",
        addRandomSuffix: false, // We already use cryptographically random safe filenames
      });

      logger.info("cloud_image_uploaded", `Uploaded image to Vercel Blob: ${blob.url}`, {
        filename: safeFilename,
        size: file.size,
        type: file.type,
      });

      return {
        url: blob.url,
        filename: safeFilename,
        size: file.size,
        type: file.type,
        provider: "vercel_blob",
      };
    } catch (err) {
      logger.error("vercel_blob_upload_error", "Failed to upload to Vercel Blob, evaluating fallback", err);
      // If Vercel Blob fails, proceed to local fallback if in development
      if (process.env.NODE_ENV === "production") {
        throw new Error("Cloud image storage service is currently unavailable.");
      }
    }
  }

  // 3. Fallback: Local Filesystem Storage (public/uploads)
  try {
    const uploadsDir = path.join(process.cwd(), "public", folder);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, safeFilename);
    const arrayBuffer = await file.arrayBuffer();
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
      filename: safeFilename,
      size: file.size,
      type: file.type,
      provider: "local",
    };
  } catch (err) {
    logger.error("local_image_upload_error", "Failed to save image to local filesystem", err);
    throw new Error("Failed to store image on server: " + err.message);
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
