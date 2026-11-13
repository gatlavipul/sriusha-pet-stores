import { requireUser } from "@/app/api/utils/security";
import { validateImageFile, uploadImage } from "@/utils/storageService";
import logger from "@/utils/logger";

export async function POST(request) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    const validation = validateImageFile(file);
    if (!validation.valid) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const result = await uploadImage(file, { folder: "pets" });

    return Response.json({
      url: result.url,
      name: result.filename,
      size: result.size,
      type: result.type,
      provider: result.provider,
    });
  } catch (error) {
    logger.error("pet_upload_error", "Failed to upload pet image", error);
    return Response.json(
      { error: error.message || "Failed to upload pet photo." },
      { status: 400 }
    );
  }
}

