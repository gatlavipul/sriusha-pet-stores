import sql from "@/app/api/utils/sql";
import { requireUser, validatePhone, sanitizeText } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json(
        { error: "Unauthorized. Please sign in to view saved addresses." },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;
    const addresses = await sql`
      SELECT 
        id, user_id, clerk_user_id, name, phone, 
        house_no, street_area, landmark, city, state, 
        pincode, label, address_line, is_default, 
        created_at, updated_at
      FROM user_addresses 
      WHERE user_id = ${userId}
      ORDER BY is_default DESC, created_at DESC
    `;

    return Response.json({ addresses: addresses || [] });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return Response.json({ error: "Failed to fetch addresses" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json(
        { error: "Please sign in to save delivery addresses" },
        { status: 401 }
      );
    }

    const user = authResult.user;
    const body = await request.json();
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
      is_default = false,
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
    
    // Label normalization (Home, Work, Other)
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

    // Combined snapshot line for compatibility
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

    // Check existing address count: first address saved automatically becomes default
    const existing = await sql`
      SELECT COUNT(*)::int as count 
      FROM user_addresses 
      WHERE user_id = ${user.id}
    `;
    const isFirstAddress = (existing[0]?.count || 0) === 0;
    const shouldBeDefault = Boolean(is_default || isFirstAddress);

    // If default, unset previous default addresses
    if (shouldBeDefault) {
      await sql`
        UPDATE user_addresses 
        SET is_default = false 
        WHERE user_id = ${user.id}
      `;
    }

    const inserted = await sql`
      INSERT INTO user_addresses (
        user_id, clerk_user_id, name, phone, house_no, 
        street_area, landmark, city, state, pincode, 
        label, address_line, is_default, created_at, updated_at
      ) VALUES (
        ${user.id}, ${user.clerk_user_id || null}, ${cleanName}, ${cleanPhone}, 
        ${cleanHouseNo}, ${cleanStreetArea}, ${cleanLandmark || null}, 
        ${cleanCity}, ${cleanState}, ${cleanPincode}, ${cleanLabel}, 
        ${combinedLine}, ${shouldBeDefault}, NOW(), NOW()
      )
      RETURNING *
    `;

    return Response.json({ address: inserted[0] });
  } catch (error) {
    console.error("Error saving address:", error);
    return Response.json({ error: "Failed to save address" }, { status: 500 });
  }
}
