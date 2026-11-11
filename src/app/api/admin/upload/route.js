import { put } from "@vercel/blob";
import { requireAdmin } from "@/app/api/utils/security";
import fs from "fs";
import path from "path";

export async function POST(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        { error: "Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed." },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return Response.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // If Vercel Blob token is configured, use Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_READ_WRITE_TOKEN !== "your_vercel_blob_read_write_token") {
      const blob = await put(`uploads/${Date.now()}-${file.name}`, file, {
        access: "public",
      });

      return Response.json({
        url: blob.url,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    // Local filesystem fallback for dev
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(file.name) || ".png";
    const safeBase = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_\-]/g, "_");
    const filename = `${Date.now()}-${safeBase}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    return Response.json({
      url: `/uploads/${filename}`,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return Response.json(
      { error: "Failed to upload file: " + error.message },
      { status: 500 }
    );
  }
}
