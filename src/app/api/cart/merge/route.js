import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/security";

export async function POST(request) {
  try {
    const authResult = await requireUser();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const userId = authResult.user.id;
    const body = await request.json();
    const guestItems = Array.isArray(body?.items) ? body.items : [];

    for (const item of guestItems) {
      const productId = parseInt(item.product_id || item.id, 10);
      const guestQty = Math.max(1, parseInt(item.quantity, 10) || 1);

      if (isNaN(productId) || productId <= 0) continue;

      // Verify product exists and check stock
      const products = await sql`
        SELECT id, stock_quantity 
        FROM products 
        WHERE id = ${productId} 
        LIMIT 1
      `;
      if (products.length === 0) continue;

      const product = products[0];
      const maxStock = Math.max(1, product.stock_quantity ?? 99);

      // Check if item already exists in user's cart
      const existing = await sql`
        SELECT id, quantity 
        FROM cart_items 
        WHERE user_id = ${userId} AND product_id = ${productId}
        LIMIT 1
      `;

      if (existing.length > 0) {
        // Merge quantities safely without exceeding available stock
        const mergedQty = Math.min(existing[0].quantity + guestQty, maxStock);
        await sql`
          UPDATE cart_items 
          SET quantity = ${mergedQty}, updated_at = NOW()
          WHERE id = ${existing[0].id}
        `;
      } else {
        // Insert new item capped by stock
        const finalQty = Math.min(guestQty, maxStock);
        await sql`
          INSERT INTO cart_items (user_id, product_id, quantity)
          VALUES (${userId}, ${productId}, ${finalQty})
        `;
      }
    }

    // Return the full updated merged cart
    const cartItems = await sql`
      SELECT c.*, p.name, p.price, p.image_url, p.stock_quantity 
      FROM cart_items c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.user_id = ${userId}
      ORDER BY c.created_at DESC
    `;

    return Response.json({
      success: true,
      message: "Cart merged successfully",
      cartItems,
    });
  } catch (error) {
    console.error("Error in cart merge:", error);
    return Response.json({ error: "Failed to merge cart items" }, { status: 500 });
  }
}
