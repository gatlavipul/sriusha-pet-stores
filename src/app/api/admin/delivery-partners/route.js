import sql from "@/app/api/utils/sql";
import { requireAdmin } from "@/app/api/utils/security";

/**
 * GET /api/admin/delivery-partners
 * Returns all active delivery partners for dropdowns and assignment.
 */
export async function GET(request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const partners = await sql`
      SELECT 
        COALESCE(u.id, ds.id) as id,
        u.id as user_id,
        COALESCE(ds.name, u.name, ds.email) as name,
        ds.email,
        COALESCE(ds.phone, u.phone) as phone,
        ds.status
      FROM delivery_staff ds
      LEFT JOIN auth_users u ON LOWER(u.email) = LOWER(ds.email) OR u.id = ds.user_id
      WHERE ds.status = 'active'
      ORDER BY ds.name ASC, ds.email ASC
    `;

    return Response.json({ deliveryPartners: partners || [] });
  } catch (error) {
    console.error("Error fetching delivery partners:", error);
    return Response.json({ error: "Failed to fetch delivery partners" }, { status: 500 });
  }
}
