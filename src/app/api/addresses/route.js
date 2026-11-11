import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { validatePhone, sanitizeText } from "@/app/api/utils/security";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ addresses: [] });
    }

    const addresses = await sql`
      SELECT * FROM user_addresses 
      WHERE user_id = ${session.user.id}
      ORDER BY is_default DESC, created_at DESC
    `;

    return Response.json({ addresses });
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return Response.json({ error: "Failed to fetch addresses" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Please sign in to save delivery addresses" }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, address_line, city, state, pincode, is_default } = body;

    const cleanName = sanitizeText(name, 100);
    const cleanPhone = sanitizeText(phone, 20);
    const cleanAddress = sanitizeText(address_line, 500);
    const cleanCity = sanitizeText(city, 100) || "Hyderabad";
    const cleanState = sanitizeText(state, 100) || "Telangana";
    const cleanPincode = sanitizeText(pincode, 20);

    if (!cleanName || !cleanAddress || !cleanPincode) {
      return Response.json({ error: "Recipient name, address, and pincode are required" }, { status: 400 });
    }

    if (!validatePhone(cleanPhone)) {
      return Response.json({ error: "Valid 10-digit phone number is required" }, { status: 400 });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await sql`UPDATE user_addresses SET is_default = false WHERE user_id = ${session.user.id}`;
    }

    const inserted = await sql`
      INSERT INTO user_addresses (
        user_id, name, phone, address_line, city, state, pincode, is_default
      ) VALUES (
        ${session.user.id}, ${cleanName}, ${cleanPhone}, ${cleanAddress}, 
        ${cleanCity}, ${cleanState}, ${cleanPincode}, ${Boolean(is_default)}
      )
      RETURNING *
    `;

    return Response.json({ address: inserted[0] });
  } catch (error) {
    console.error("Error saving address:", error);
    return Response.json({ error: "Failed to save address" }, { status: 500 });
  }
}

