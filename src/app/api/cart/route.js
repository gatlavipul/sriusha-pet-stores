import sql from "@/app/api/utils/sql";
import { requireUser } from "@/app/api/utils/security";

export async function GET(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json({ cartItems: [] });
    }

    const userId = authResult.user.id;
    const cartItems = await sql`
      SELECT
        c.*,
        p.name,
        COALESCE(pv.price, p.sale_price, p.price) as price,
        COALESCE(pv.compare_price, p.compare_price) as compare_price,
        p.image_url,
        COALESCE(pv.stock_quantity, p.stock_quantity) as stock_quantity,
        p.requires_prescription,
        COALESCE(pv.label, c.variant_name) as variant_name
      FROM cart_items c 
      JOIN products p ON c.product_id = p.id 
      LEFT JOIN product_variants pv ON c.variant_id = pv.id
      WHERE c.user_id = ${userId}
      ORDER BY c.created_at DESC
    `;

    return Response.json({ cartItems: cartItems || [] });
  } catch (error) {
    console.error("Error fetching cart:", error);
    return Response.json({ error: "Failed to fetch cart" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authResult.user.id;
    const body = await request.json();
    const { product_id, quantity, variant_id = null, variant_name = null } = body;

    if (!product_id || !quantity || quantity < 1) {
      return Response.json({ error: "Invalid product or quantity" }, { status: 400 });
    }

    // Check available stock on server
    const products = await sql`
      SELECT p.*, pv.stock_quantity as var_stock, pv.is_active as var_active, pv.needs_review as var_needs_review
      FROM products p
      LEFT JOIN product_variants pv ON pv.id = ${variant_id}
      WHERE p.id = ${product_id}
    `;

    if (products.length === 0) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    const product = products[0];

    if (variant_id && product.var_needs_review) {
      return Response.json(
        { error: "The selected size is pending review and cannot be purchased." },
        { status: 400 }
      );
    }
    const availableStock = variant_id ? (product.var_stock ?? 0) : product.stock_quantity;
    const isActive = variant_id ? Boolean(product.var_active) : product.is_active;

    if (!isActive) {
      return Response.json({ error: "Product is currently unavailable" }, { status: 400 });
    }

    if (availableStock <= 0) {
      return Response.json({ error: "Product is out of stock" }, { status: 400 });
    }

    // Check existing item in cart
    const existing = await sql`
      SELECT * FROM cart_items 
      WHERE user_id = ${userId} 
        AND product_id = ${product_id}
        AND (variant_id = ${variant_id} OR (variant_id IS NULL AND ${variant_id} IS NULL))
    `;

    const newQuantity = existing.length > 0 ? existing[0].quantity + quantity : quantity;

    if (newQuantity > availableStock) {
      return Response.json(
        { error: `Only ${availableStock} units available in stock` },
        { status: 400 }
      );
    }

    if (existing.length > 0) {
      await sql`
        UPDATE cart_items 
        SET quantity = ${newQuantity}, updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
    } else {
      await sql`
        INSERT INTO cart_items (user_id, product_id, quantity, variant_id, variant_name)
        VALUES (${userId}, ${product_id}, ${quantity}, ${variant_id}, ${variant_name})
      `;
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error adding to cart:", error);
    return Response.json({ error: "Failed to add to cart" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireUser(request);
    if (authResult.error || !authResult.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authResult.user.id;
    const body = await request.json();
    const { id, quantity } = body;

    if (!id || quantity < 0) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (quantity === 0) {
      await sql`
        DELETE FROM cart_items 
        WHERE id = ${id} AND user_id = ${userId}
      `;
      return Response.json({ success: true });
    }

    // Check available stock on server
    const items = await sql`
      SELECT c.*, p.stock_quantity as prod_stock, pv.stock_quantity as var_stock, pv.is_active as var_active, p.is_active as prod_active
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN product_variants pv ON c.variant_id = pv.id
      WHERE c.id = ${id} AND c.user_id = ${userId}
    `;

    if (items.length === 0) {
      return Response.json({ error: "Cart item not found" }, { status: 404 });
    }

    const item = items[0];
    const availableStock = item.variant_id ? (item.var_stock ?? 0) : (item.prod_stock ?? 0);
    const isActive = item.variant_id ? Boolean(item.var_active) : Boolean(item.prod_active);

    if (!isActive) {
      return Response.json({ error: "Item is no longer available" }, { status: 400 });
    }

    if (quantity > availableStock) {
      return Response.json(
        { error: availableStock <= 0 ? "Product is out of stock" : `Only ${availableStock} left in stock` },
        { status: 400 }
      );
    }

    await sql`
      UPDATE cart_items 
      SET quantity = ${quantity}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${userId}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating cart:", error);
    return Response.json({ error: "Failed to update cart" }, { status: 500 });
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
    const id = searchParams.get("id");

    await sql`
      DELETE FROM cart_items 
      WHERE id = ${id} AND user_id = ${userId}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error deleting cart item:", error);
    return Response.json(
      { error: "Failed to delete cart item" },
      { status: 500 },
    );
  }
}
