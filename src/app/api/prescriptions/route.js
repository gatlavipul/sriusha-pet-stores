import path from "path";
import fs from "fs";
import crypto from "crypto";
import sql from "@/app/api/utils/sql";
import { requireUser, sanitizeText } from "@/app/api/utils/security";
import { notifyAdmin } from "@/utils/notificationService";

const ALLOWED_RX_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_RX_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
const MAX_RX_SIZE = 5 * 1024 * 1024;
const PRIVATE_RX_DIR = path.join(process.cwd(), "private_uploads", "prescriptions");

export async function GET(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");
    const statusFilter = searchParams.get("status");

    if (scope === "all" && authResult.user.role === "admin") {
      let query = `
        SELECT
          pr.id, pr.user_id, pr.order_id, pr.product_id, pr.original_filename,
          pr.mime_type, pr.status, pr.notes, pr.reviewed_at, pr.created_at,
          u.name as customer_name, u.email as customer_email,
          p.name as product_name,
          o.order_number
        FROM prescriptions pr
        LEFT JOIN auth_users u ON pr.user_id = u.id
        LEFT JOIN products p ON pr.product_id = p.id
        LEFT JOIN orders o ON pr.order_id = o.id
        WHERE 1=1
      `;
      const params = [];
      if (statusFilter && statusFilter !== "all") {
        params.push(statusFilter);
        query += ` AND pr.status = $${params.length}`;
      }
      query += ` ORDER BY pr.created_at DESC`;
      const rows = await sql(query, params);
      return Response.json({ prescriptions: rows || [] });
    }

    const rows = await sql`
      SELECT
        pr.id, pr.user_id, pr.order_id, pr.product_id, pr.original_filename,
        pr.mime_type, pr.status, pr.notes, pr.reviewed_at, pr.created_at,
        p.name as product_name,
        o.order_number
      FROM prescriptions pr
      LEFT JOIN products p ON pr.product_id = p.id
      LEFT JOIN orders o ON pr.order_id = o.id
      WHERE pr.user_id = ${authResult.user.id}
      ORDER BY pr.created_at DESC
    `;

    return Response.json({ prescriptions: rows || [] });
  } catch (error) {
    console.error("Error fetching prescriptions:", error);
    return Response.json({ error: "Failed to fetch prescriptions" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const productIdRaw = formData.get("product_id");
    const orderIdRaw = formData.get("order_id");
    const notes = sanitizeText(formData.get("notes") || "", 500);

    if (!file || typeof file === "string") {
      return Response.json({ error: "Prescription file is required." }, { status: 400 });
    }

    if (!ALLOWED_RX_TYPES.has(file.type)) {
      return Response.json(
        { error: "Unsupported prescription format. Allowed: JPG, PNG, WebP, or PDF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_RX_SIZE) {
      return Response.json({ error: "Prescription file must be 5 MB or smaller." }, { status: 400 });
    }

    const ext = path.extname(file.name || "").toLowerCase() || (file.type === "application/pdf" ? ".pdf" : ".jpg");
    if (!ALLOWED_RX_EXTS.has(ext)) {
      return Response.json({ error: "Invalid file extension." }, { status: 400 });
    }

    const safeFileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    fs.mkdirSync(PRIVATE_RX_DIR, { recursive: true });
    const fullPath = path.join(PRIVATE_RX_DIR, safeFileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);

    const productId = productIdRaw ? parseInt(String(productIdRaw), 10) : null;
    const orderId = orderIdRaw ? parseInt(String(orderIdRaw), 10) : null;

    const inserted = await sql`
      INSERT INTO prescriptions (
        user_id, order_id, product_id, file_path, original_filename, mime_type, status, notes
      ) VALUES (
        ${authResult.user.id},
        ${Number.isInteger(orderId) && orderId > 0 ? orderId : null},
        ${Number.isInteger(productId) && productId > 0 ? productId : null},
        ${safeFileName},
        ${sanitizeText(file.name || safeFileName, 255)},
        ${file.type},
        'pending_review',
        ${notes || null}
      )
      RETURNING id, user_id, order_id, product_id, original_filename, mime_type, status, notes, created_at
    `;

    await notifyAdmin({
      type: "prescription_review",
      title: "New Veterinary Prescription Uploaded",
      message: `${authResult.user.name || authResult.user.email} uploaded a prescription (#${inserted[0].id}) for review.`,
      orderId: inserted[0].order_id,
      linkUrl: "/admin/prescriptions",
    });

    return Response.json({ prescription: inserted[0] }, { status: 201 });
  } catch (error) {
    console.error("Error uploading prescription:", error);
    return Response.json({ error: "Failed to upload prescription" }, { status: 500 });
  }
}

