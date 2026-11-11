import sql from "@/app/api/utils/sql";
import Razorpay from "razorpay";

export async function POST(request) {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return Response.json(
        { error: "Payment gateway is currently in maintenance. Please select Cash on Delivery or contact support." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { items, promo_code } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ error: "Your cart is empty." }, { status: 400 });
    }

    const productIds = items
      .map((it) => parseInt(it.product_id || it.id, 10))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (productIds.length === 0) {
      return Response.json({ error: "Invalid products in cart." }, { status: 400 });
    }

    // Fetch live product records from database to ensure genuine prices & stock
    const dbProducts = await sql`
      SELECT id, name, price, sale_price, stock_quantity, is_active
      FROM products
      WHERE id = ANY(${productIds}::int[])
    `;

    const productMap = new Map();
    dbProducts.forEach((p) => productMap.set(p.id, p));

    let serverSubtotal = 0;

    for (const item of items) {
      const pid = parseInt(item.product_id || item.id, 10);
      const dbProd = productMap.get(pid);

      if (!dbProd || !dbProd.is_active) {
        return Response.json(
          { error: `Product "${item.name || 'Selected item'}" is no longer available.` },
          { status: 400 }
        );
      }

      const requestedQty = Math.max(1, parseInt(item.quantity || 1, 10));
      if (dbProd.stock_quantity < requestedQty) {
        return Response.json(
          {
            error: `Only ${dbProd.stock_quantity} unit(s) of "${dbProd.name}" remaining in stock. Please adjust your quantity.`,
          },
          { status: 400 }
        );
      }

      const unitPrice = parseFloat(dbProd.sale_price || dbProd.price);
      serverSubtotal += unitPrice * requestedQty;
    }

    // Delivery calculation: Free shipping above ₹500, else ₹40
    let deliveryCharge = serverSubtotal >= 500 ? 0 : 40;

    // Server-side promo calculation
    let discount = 0;
    if (promo_code) {
      const code = String(promo_code).toUpperCase().trim();
      if (code === "USHA10") {
        discount = Math.round(serverSubtotal * 0.1);
      } else if (code === "FLAT50") {
        discount = Math.min(50, serverSubtotal);
      }
    }

    const finalAmount = Math.max(1, Math.round(serverSubtotal + deliveryCharge - discount));

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const receiptId = `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const options = {
      amount: finalAmount * 100, // in paise
      currency: "INR",
      receipt: receiptId,
      notes: {
        item_count: String(items.length),
        promo_applied: promo_code || "none",
      },
    };

    const order = await razorpay.orders.create(options);

    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
      verifiedSubtotal: serverSubtotal,
      deliveryCharge,
      discount,
      finalAmount,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return Response.json(
      { error: "Failed to initiate payment. Please try again." },
      { status: 500 }
    );
  }
}
