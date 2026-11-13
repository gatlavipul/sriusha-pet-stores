import Razorpay from "razorpay";
import { auth } from "@/auth";
import { validateCheckoutPayload } from "@/utils/checkoutOrderHelper";
import { checkServiceability } from "@/utils/serviceabilityService";

export async function POST(request) {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return Response.json(
        { error: "Payment gateway is currently in maintenance. Please select Cash on Delivery or contact support." },
        { status: 503 }
      );
    }

    const session = await auth();
    const body = await request.json();
    const { items, promo_code, customer_email, shipping_pincode, redeem_points, prescription_id } = body;

    const validation = await validateCheckoutPayload({
      items,
      promoCode: promo_code,
      userId: session?.user?.id || null,
      customerEmail: customer_email || session?.user?.email || null,
      redeemPoints: redeem_points || 0,
      prescriptionId: prescription_id || null,
    });

    if (!validation.valid) {
      return Response.json(
        { error: validation.error, requiresPrescription: Boolean(validation.requiresPrescription) },
        { status: validation.status || 400 }
      );
    }

    let deliveryCharge = validation.subtotal >= 500 ? 0 : 40;
    if (shipping_pincode) {
      const serv = await checkServiceability(String(shipping_pincode), validation.subtotal);
      if (!serv.serviceable) {
        return Response.json({ error: serv.reason || "Address is not serviceable." }, { status: 400 });
      }
      deliveryCharge = serv.deliveryCharge;
    }

    const finalAmount = Math.max(
      1,
      Math.round(
        validation.subtotal +
          deliveryCharge -
          (validation.offerDiscount || 0) -
          (validation.pointsDiscount || 0)
      )
    );

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
