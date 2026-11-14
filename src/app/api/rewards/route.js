import { requireUser } from "@/app/api/utils/security";
import { getCustomerLoyaltySummary } from "@/utils/loyaltyService";

export async function GET(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const summary = await getCustomerLoyaltySummary(authResult.user.id);
    return Response.json(summary);
  } catch (error) {
    console.error("Error loading loyalty rewards:", error);
    return Response.json({ error: "Failed to load rewards" }, { status: 500 });
  }
}

