import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

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
      WHERE c.user_id = ${session.user.id}
      ORDER BY c.created_at DESC
    `;

    return Response.json({ cartItems });
  } catch (error) {
    console.error("Error fetching cart:", error);
    return Response.json({ error: "Failed to fetch cart" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, quantity, variant_id = null, variant_name = null } = body;

    if (!product_id || !quantity || quantity < 1) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const vid = variant_id ? parseInt(variant_id, 10) : null;

    // Check live stock on server before adding to cart
    if (vid) {
      const vars = await sql`
        SELECT stock_quantity, is_active, label 
        FROM product_variants 
        WHERE id = ${vid} AND product_id = ${product_id}
      `;
      if (vars.length === 0 || !vars[0].is_active) {
        return Response.json({ error: "Selected item variant is unavailable." }, { status: 400 });
      }
      const stock = vars[0].stock_quantity ?? 0;
      const existing = await sql`
        SELECT quantity FROM cart_items 
        WHERE user_id = ${session.user.id} AND product_id = ${product_id} AND variant_id = ${vid}
      `;
      const currentQty = existing[0]?.quantity || 0;
      if (currentQty + quantity > stock) {
        return Response.json(
          { error: stock <= 0 ? "Product is out of stock" : `Only ${stock} left in stock` },
          { status: 400 }
        );
      }
    } else {
      const prods = await sql`
        SELECT stock_quantity, is_active 
        FROM products 
        WHERE id = ${product_id}
      `;
      if (prods.length === 0 || !prods[0].is_active) {
        return Response.json({ error: "Product is currently unavailable." }, { status: 400 });
      }
      const stock = prods[0].stock_quantity ?? 0;
      const existing = await sql`
        SELECT quantity FROM cart_items 
        WHERE user_id = ${session.user.id} AND product_id = ${product_id} AND variant_id IS NULL
      `;
      const currentQty = existing[0]?.quantity || 0;
      if (currentQty + quantity > stock) {
        return Response.json(
          { error: stock <= 0 ? "Product is out of stock" : `Only ${stock} left in stock` },
          { status: 400 }
        );
      }
    }

    // Check if item (with same variant) already exists in cart
    const existing = vid
      ? await sql`
          SELECT * FROM cart_items 
          WHERE user_id = ${session.user.id} AND product_id = ${product_id} AND variant_id = ${vid}
        `
      : await sql`
          SELECT * FROM cart_items 
          WHERE user_id = ${session.user.id} AND product_id = ${product_id} AND variant_id IS NULL
        `;

    if (existing.length > 0) {
      await sql`
        UPDATE cart_items 
        SET quantity = quantity + ${quantity}, updated_at = NOW()
        WHERE id = ${existing[0].id} AND user_id = ${session.user.id}
      `;
    } else {
      await sql`
        INSERT INTO cart_items (user_id, product_id, variant_id, variant_name, quantity)
        VALUES (${session.user.id}, ${product_id}, ${vid}, ${variant_name}, ${quantity})
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
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, quantity } = body;

    if (!id || quantity < 0) {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    if (quantity === 0) {
      await sql`
        DELETE FROM cart_items 
        WHERE id = ${id} AND user_id = ${session.user.id}
      `;
      return Response.json({ success: true });
    }

    // Check available stock on server
    const items = await sql`
      SELECT c.*, p.stock_quantity as prod_stock, pv.stock_quantity as var_stock, pv.is_active as var_active, p.is_active as prod_active
      FROM cart_items c
      JOIN products p ON c.product_id = p.id
      LEFT JOIN product_variants pv ON c.variant_id = pv.id
      WHERE c.id = ${id} AND c.user_id = ${session.user.id}
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
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error updating cart:", error);
    return Response.json({ error: "Failed to update cart" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    await sql`
      DELETE FROM cart_items 
      WHERE id = ${id} AND user_id = ${session.user.id}
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
