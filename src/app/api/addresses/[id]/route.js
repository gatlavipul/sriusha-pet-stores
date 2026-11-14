import sql from "@/app/api/utils/sql";
import { requireUser, validatePhone, sanitizeText } from "@/app/api/utils/security";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json(
        { error: "Unauthorized. Please sign in to update address." },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const resolvedParams = await (params || {});
    const id = parseInt(resolvedParams.id, 10);

    if (!id || isNaN(id)) {
      return Response.json({ error: "Invalid address ID" }, { status: 400 });
    }

    // Verify address ownership
    const existing = await sql`
      SELECT id, is_default 
      FROM user_addresses 
      WHERE id = ${id} AND user_id = ${user.id} 
      LIMIT 1
    `;

    if (!existing || existing.length === 0) {
      return Response.json(
        { error: "Address not found or unauthorized" },
        { status: 404 }
      );
    }

    const body = await request.json();

    // 1. Quick Set as Default operation
    if (body.set_default) {
      await sql`
        UPDATE user_addresses 
        SET is_default = false 
        WHERE user_id = ${user.id}
      `;
      await sql`
        UPDATE user_addresses 
        SET is_default = true, updated_at = NOW() 
        WHERE id = ${id} AND user_id = ${user.id}
      `;
      return Response.json({ success: true, message: "Default address updated" });
    }

    // 2. Full Edit Address operation
    const {
      name,
      phone,
      house_no,
      street_area,
      landmark,
      city = "Hyderabad",
      state = "Telangana",
      pincode,
      label = "Home",
      is_default,
      address_line,
    } = body;

    const cleanName = sanitizeText(name, 100);
    const cleanPhone = sanitizeText(phone, 20).replace(/\D/g, "");
    const cleanHouseNo = sanitizeText(house_no, 100);
    const cleanStreetArea = sanitizeText(street_area, 255);
    const cleanLandmark = sanitizeText(landmark, 150);
    const cleanCity = sanitizeText(city, 100) || "Hyderabad";
    const cleanState = sanitizeText(state, 100) || "Telangana";
    const cleanPincode = sanitizeText(pincode, 10).replace(/\D/g, "");

    let cleanLabel = "Home";
    const rawLabelLower = (label || "").trim().toLowerCase();
    if (rawLabelLower === "work") cleanLabel = "Work";
    else if (rawLabelLower === "other") cleanLabel = "Other";

    if (!cleanName || cleanName.length < 2) {
      return Response.json(
        { error: "Please enter a valid recipient full name." },
        { status: 400 }
      );
    }

    if (!validatePhone(cleanPhone) || cleanPhone.length !== 10) {
      return Response.json(
        { error: "Please enter a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    if (!cleanHouseNo) {
      return Response.json(
        { error: "House / Flat / Block number is required." },
        { status: 400 }
      );
    }

    if (!cleanStreetArea) {
      return Response.json(
        { error: "Street / Apartment / Area name is required." },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(cleanPincode)) {
      return Response.json(
        { error: "Please enter a valid 6-digit Hyderabad pincode." },
        { status: 400 }
      );
    }

    const combinedLine =
      address_line && address_line.trim()
        ? sanitizeText(address_line, 500)
        : [
            cleanHouseNo,
            cleanStreetArea,
            cleanLandmark ? `Near ${cleanLandmark}` : null,
            cleanCity,
            cleanState,
            cleanPincode,
          ]
            .filter(Boolean)
            .join(", ");

    const makeDefault = Boolean(is_default);
    if (makeDefault) {
      await sql`
        UPDATE user_addresses 
        SET is_default = false 
        WHERE user_id = ${user.id}
      `;
    }

    const updated = await sql`
      UPDATE user_addresses 
      SET 
        name = ${cleanName},
        phone = ${cleanPhone},
        house_no = ${cleanHouseNo},
        street_area = ${cleanStreetArea},
        landmark = ${cleanLandmark || null},
        city = ${cleanCity},
        state = ${cleanState},
        pincode = ${cleanPincode},
        label = ${cleanLabel},
        address_line = ${combinedLine},
        is_default = CASE WHEN ${makeDefault} THEN true ELSE is_default END,
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `;

    return Response.json({ address: updated[0], success: true });
  } catch (error) {
    console.error("Error updating address:", error);
    return Response.json({ error: "Failed to update address" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json(
        { error: "Unauthorized. Please sign in to remove address." },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const resolvedParams = await (params || {});
    const id = parseInt(resolvedParams.id, 10);

    if (!id || isNaN(id)) {
      return Response.json({ error: "Invalid address ID" }, { status: 400 });
    }

    // Check if target address exists and if it is currently default
    const existing = await sql`
      SELECT id, is_default 
      FROM user_addresses 
      WHERE id = ${id} AND user_id = ${user.id} 
      LIMIT 1
    `;

    if (!existing || existing.length === 0) {
      return Response.json(
        { error: "Address not found or unauthorized" },
        { status: 404 }
      );
    }

    const wasDefault = Boolean(existing[0].is_default);

    await sql`
      DELETE FROM user_addresses 
      WHERE id = ${id} AND user_id = ${user.id}
    `;

    // If deleted address was default, promote the newest remaining address to default
    if (wasDefault) {
      const remaining = await sql`
        SELECT id 
        FROM user_addresses 
        WHERE user_id = ${user.id} 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      if (remaining.length > 0) {
        await sql`
          UPDATE user_addresses 
          SET is_default = true 
          WHERE id = ${remaining[0].id}
        `;
      }
    }

    return Response.json({ success: true, message: "Address deleted successfully" });
  } catch (error) {
    console.error("Error deleting address:", error);
    return Response.json({ error: "Failed to delete address" }, { status: 500 });
  }
}
