import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { validateAndCalculateOffer } from "@/utils/offerService";

export async function GET() {
  try {
    const now = new Date();
    const offers = await sql`
      SELECT id, code, title, description, offer_type, discount_type, discount_value, min_order_amount, max_discount, start_date, end_date
      FROM offers
      WHERE status = 'active'
        AND (start_date IS NULL OR start_date <= ${now})
        AND (end_date IS NULL OR end_date >= ${now})
      ORDER BY created_at DESC
      LIMIT 10
    `;
    return Response.json({ offers: offers || [] });
  } catch (error) {
    console.error("Error loading active offers:", error);
    return Response.json({ offers: [] });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    const body = await request.json();
    const { code, items = [], customer_email = null } = body;

    const productIds = (items || [])
      .map((it) => parseInt(it.product_id || it.id, 10))
      .filter((n) => Number.isInteger(n) && n > 0);

    let cartItems = [];
    let subtotal = 0;

    if (productIds.length > 0) {
      const dbProducts = await sql`
        SELECT id, category_id, price, sale_price
        FROM products
        WHERE id = ANY(${productIds}::int[]) AND is_active = TRUE
      `;
      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

      const variantIds = items
        .map((it) => parseInt(it.variant_id, 10))
        .filter((n) => Number.isInteger(n) && n > 0);
      const dbVariants =
        variantIds.length > 0
          ? await sql`SELECT id, product_id, price FROM product_variants WHERE id = ANY(${variantIds}::int[])`
          : [];
      const varMap = new Map(dbVariants.map((v) => [v.id, v]));

      for (const it of items) {
        const pid = parseInt(it.product_id || it.id, 10);
        const prod = prodMap.get(pid);
        if (!prod) continue;
        const vid = parseInt(it.variant_id, 10);
        const variant = varMap.get(vid);
        const unitPrice = parseFloat(variant?.price || prod.sale_price || prod.price || 0);
        const qty = Math.max(1, parseInt(it.quantity || 1, 10));
        subtotal += unitPrice * qty;
        cartItems.push({
          product_id: pid,
          category_id: prod.category_id,
          unit_price: unitPrice,
          quantity: qty,
        });
      }
    }

    const result = await validateAndCalculateOffer({
      code,
      userId: session?.user?.id || null,
      customerEmail: customer_email || session?.user?.email || null,
      cartItems,
      subtotal,
    });

    if (!result.valid) {
      return Response.json({ valid: false, error: result.error, discountAmount: 0 }, { status: 400 });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Error validating offer:", error);
    return Response.json({ valid: false, error: "Failed to validate offer" }, { status: 500 });
  }
}

