import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json({ items: [], productIds: [] });
    }

    const userId = authResult.user.id;
    const items = await sql`
      SELECT w.id as wishlist_id, w.created_at as added_at, p.*, c.name as category_name
      FROM wishlist_items w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE w.user_id = ${userId}
      ORDER BY w.created_at DESC
    `;

    const productIds = (items || []).map((it) => it.id);
    return Response.json({ items: items || [], productIds });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return Response.json({ error: "Failed to fetch wishlist" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json({ error: "Please sign in to save items to your wishlist." }, { status: 401 });
    }

    const userId = authResult.user.id;
    const body = await request.json();
    const productId = parseInt(body.product_id || body.productId, 10);

    if (!productId || isNaN(productId)) {
      return Response.json({ error: "Invalid product ID" }, { status: 400 });
    }

    const existing = await sql`
      SELECT id FROM wishlist_items 
      WHERE user_id = ${userId} AND product_id = ${productId}
      LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        DELETE FROM wishlist_items 
        WHERE user_id = ${userId} AND product_id = ${productId}
      `;
      return Response.json({ success: true, action: "removed", inWishlist: false });
    } else {
      await sql`
        INSERT INTO wishlist_items (user_id, product_id)
        VALUES (${userId}, ${productId})
        ON CONFLICT DO NOTHING
      `;
      return Response.json({ success: true, action: "added", inWishlist: true });
    }
  } catch (error) {
    console.error("Error updating wishlist:", error);
    return Response.json({ error: "Failed to update wishlist" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authResult.user.id;
    const { searchParams } = new URL(request.url);
    const productId = parseInt(searchParams.get("product_id"), 10);

    if (!productId || isNaN(productId)) {
      return Response.json({ error: "Product ID required" }, { status: 400 });
    }

    await sql`
      DELETE FROM wishlist_items 
      WHERE user_id = ${userId} AND product_id = ${productId}
    `;

    return Response.json({ success: true, action: "removed" });
  } catch (error) {
    console.error("Error deleting from wishlist:", error);
    return Response.json({ error: "Failed to remove from wishlist" }, { status: 500 });
  }
}
