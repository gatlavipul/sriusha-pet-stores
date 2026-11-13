import path from "path";
import fs from "fs";
import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/security";

const PRIVATE_RX_DIR = path.join(process.cwd(), "private_uploads", "prescriptions");

export async function GET(_request, { params }) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const rxId = parseInt(params?.id, 10);
    if (!Number.isInteger(rxId) || rxId <= 0) {
      return Response.json({ error: "Invalid prescription ID" }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, user_id, file_path, mime_type, original_filename
      FROM prescriptions
      WHERE id = ${rxId}
      LIMIT 1
    `;
    if (!rows || rows.length === 0) {
      return Response.json({ error: "Prescription not found" }, { status: 404 });
    }

    const rx = rows[0];
    const isOwner = rx.user_id === authResult.user.id;
    const isAdmin = authResult.user.role === "admin";
    if (!isOwner && !isAdmin) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    const safeBasename = path.basename(rx.file_path);
    const fullPath = path.join(PRIVATE_RX_DIR, safeBasename);
    if (!fs.existsSync(fullPath)) {
      return Response.json({ error: "Prescription file not found on storage" }, { status: 404 });
    }

    const buffer = fs.readFileSync(fullPath);
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": rx.mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${safeBasename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error serving private prescription:", error);
    return Response.json({ error: "Failed to load prescription file" }, { status: 500 });
  }
}

