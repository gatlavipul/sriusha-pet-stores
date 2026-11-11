import { requireAdmin } from "@/app/api/utils/security";
import { uploadImage } from "@/utils/storageService";
import logger from "@/utils/logger";

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

    const result = await uploadImage(file, { folder: "uploads" });

    return Response.json({
      url: result.url,
      name: result.filename,
      size: result.size,
      type: result.type,
      provider: result.provider,
    });
  } catch (error) {
    logger.error("admin_upload_error", "Failed to upload product image", error);
    return Response.json(
      { error: error.message || "Failed to upload image." },
      { status: 400 }
    );
  }
}
