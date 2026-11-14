import sql from "@/app/api/utils/sql";
import { requireDeliveryPartner } from "@/app/api/utils/security";

/**
 * GET /api/delivery/check-access
 * Verifies if the authenticated session has permission to access the delivery portal.
 */
export async function GET(request) {
  try {
    const authResult = await requireDeliveryPartner(request);
    if (authResult.error) {
      return Response.json(
        {
          allowed: false,
          error: authResult.error,
          status: authResult.status || 403,
          disabled: Boolean(authResult.disabled),
        },
        { status: authResult.status || 403 }
      );
    }

    return Response.json({
      allowed: true,
      isAdmin: Boolean(authResult.isAdmin),
      role: authResult.isAdmin ? "admin" : "delivery",
      user: {
        id: authResult.user.id,
        name: authResult.user.name,
        email: authResult.user.email,
        phone: authResult.user.phone || "",
      },
    });
  } catch (err) {
    console.error("Error in /api/delivery/check-access:", err);
    return Response.json(
      { allowed: false, error: "Internal authorization error", status: 500 },
      { status: 500 }
    );
  }
}
