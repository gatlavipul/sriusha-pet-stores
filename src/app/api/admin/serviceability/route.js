import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText } from "@/app/api/utils/security";
import logger from "@/utils/logger";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const zones = await sql`
      SELECT * FROM delivery_serviceability_zones 
      ORDER BY is_active DESC, area_name ASC
    `;

    return Response.json({ zones });
  } catch (error) {
    logger.error("admin_serviceability_get_error", "Failed to fetch serviceability zones", error);
    return Response.json({ error: "Failed to fetch serviceability zones" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const {
      pincode,
      area_name,
      city = "Hyderabad",
      state = "Telangana",
      delivery_charge = 40,
      free_delivery_threshold = 500,
      estimated_delivery_time = "Same-day in 2-4 hours",
      is_active = true,
    } = body;

    const cleanPincode = sanitizeText(pincode, 20).replace(/\s+/g, "");
    const cleanArea = sanitizeText(area_name, 100);

    if (!cleanPincode || cleanPincode.length < 5) {
      return Response.json({ error: "A valid pincode is required." }, { status: 400 });
    }

    if (!cleanArea) {
      return Response.json({ error: "Area / locality name is required." }, { status: 400 });
    }

    const chargeNum = Math.max(0, parseFloat(delivery_charge || 0));
    const thresholdNum = Math.max(0, parseFloat(free_delivery_threshold || 0));

    const inserted = await sql`
      INSERT INTO delivery_serviceability_zones (
        pincode, area_name, city, state, delivery_charge, 
        free_delivery_threshold, estimated_delivery_time, is_active, 
        created_at, updated_at
      ) VALUES (
        ${cleanPincode}, ${cleanArea}, ${sanitizeText(city, 100)}, 
        ${sanitizeText(state, 100)}, ${chargeNum}, ${thresholdNum}, 
        ${sanitizeText(estimated_delivery_time, 100)}, ${Boolean(is_active)},
        NOW(), NOW()
      )
      ON CONFLICT (pincode) DO UPDATE SET
        area_name = EXCLUDED.area_name,
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        delivery_charge = EXCLUDED.delivery_charge,
        free_delivery_threshold = EXCLUDED.free_delivery_threshold,
        estimated_delivery_time = EXCLUDED.estimated_delivery_time,
        is_active = EXCLUDED.is_active,
        updated_at = NOW()
      RETURNING *
    `;

    logger.info("serviceability_zone_saved", `Admin saved serviceability zone ${cleanPincode} (${cleanArea})`, {
      adminId: authResult.user.id,
      pincode: cleanPincode,
    });

    return Response.json({ success: true, zone: inserted[0] }, { status: 201 });
  } catch (error) {
    logger.error("admin_serviceability_post_error", "Failed to save serviceability zone", error);
    return Response.json({ error: "Failed to save zone: " + error.message }, { status: 500 });
  }
}

