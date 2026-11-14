import sql from "@/app/api/utils/sql";

export async function GET() {
  try {
    const rows = await sql`
      SELECT key, value FROM settings 
      WHERE key IN ('store_phone', 'shop_latitude', 'shop_longitude', 'minimum_delivery_charge', 'maximum_delivery_distance')
    `;
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    if (!settings.store_phone) {
      settings.store_phone = "+91 94402 74418";
    }
    return Response.json({ settings });
  } catch (err) {
    console.error("Failed to read settings from DB:", err);
    return Response.json({
      settings: {
        store_phone: "+91 94402 74418",
      },
    });
  }
}
