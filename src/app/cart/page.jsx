import { useState } from "react";
import Header from "@/components/Header";
import useCart from "@/utils/useCart";
import {
  Trash2,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Tag,
  Check,
  Truck,
  Sparkles,
} from "lucide-react";

export default function CartPage() {
  const {
    items,
    loading,
    totalCount,
    subtotal,
    isFreeShipping,
    amountForFreeShipping,
    FREE_SHIPPING_THRESHOLD,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const [couponCode, setCouponCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState(null);

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    try {
      const res = await fetch("/api/offers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          items: cart.map((i) => ({
            product_id: i.product_id || i.id,
            variant_id: i.variant_id || null,
            quantity: i.quantity || 1,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setAppliedDiscount(0);
        if (typeof window !== "undefined") sessionStorage.removeItem("usha_applied_offer");
        setCouponMessage({
          type: "error",
          text: data.error || "Offer code is invalid or not applicable.",
        });
        return;
      }

      setAppliedDiscount(Number(data.discountAmount || 0));
      if (typeof window !== "undefined") {
        sessionStorage.setItem("usha_applied_offer", data.offer?.code || code);
      }
      setCouponMessage({
        type: "success",
        text: `${data.offer?.code}: ₹${Number(data.discountAmount || 0).toFixed(0)} saved!`,
      });
    } catch {
      setCouponMessage({
        type: "error",
        text: "Could not validate offer code right now.",
      });
    }
  };

  const deliveryCharge = isFreeShipping || subtotal === 0 ? 0 : 40;
  const grandTotal = Math.max(0, subtotal - appliedDiscount + deliveryCharge);
  const freeShippingProgress = Math.min(
    100,
    Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mx-auto mb-4" />
          <p className="text-xs text-gray-500 font-medium">Loading your shopping cart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#0F172A]">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="mb-8 flex items-baseline justify-between border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              Shopping Cart
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Review your items and proceed to secure checkout
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-semibold text-gray-400 hover:text-red-600 transition-colors"
            >
              Clear Cart
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 sm:p-16 text-center shadow-xs max-w-xl mx-auto my-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-[#2563EB] mb-4">
              <ShoppingBag size={36} />
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">
              Your Cart is Empty
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mb-8 max-w-sm mx-auto">
              Looks like you haven&apos;t added any pet supplies yet. Explore our genuine veterinary food, treats, and healthcare items!
            </p>
            <a
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-6 py-3.5 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-all"
            >
              <span>Start Shopping Now</span>
              <ArrowRight size={16} />
            </a>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Items Column (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Free Delivery Meter Banner */}
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 p-4 shadow-2xs">
                <div className="flex items-center justify-between text-xs font-bold text-gray-800 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Truck size={16} className="text-[#2563EB]" />
                    {isFreeShipping ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold">
                        <Sparkles size={14} className="text-emerald-600" /> Congratulations! You unlocked FREE Delivery!
                      </span>
                    ) : (
                      <span>
                        Add{" "}
                        <span className="text-[#F97316] font-bold">
                          ₹{amountForFreeShipping.toFixed(0)}
                        </span>{" "}
                        more for FREE Delivery!
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500">{freeShippingProgress}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                  <div
                    className={`h-full transition-all duration-300 ${isFreeShipping ? "bg-emerald-500" : "bg-[#2563EB]"
                      }`}
                    style={{ width: `${freeShippingProgress}%` }}
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="rounded-3xl border border-gray-200 bg-white p-4 sm:p-6 shadow-xs divide-y divide-gray-100">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-center gap-4"
                  >
                    {/* Item Image */}
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50 p-2">
                      <img
                        src={
                          item.image_url ||
                          "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=300&q=80"
                        }
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-sm font-bold text-gray-900 leading-snug">
                        {item.name}
                      </h3>
                      <div className="text-xs text-gray-500 mt-1">
                        Price: ₹{item.price} each
                      </div>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 shadow-2xs">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, (item.quantity || 1) - 1)
                        }
                        className="px-2.5 py-1 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-gray-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, (item.quantity || 1) + 1)
                        }
                        className="px-2.5 py-1 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        +
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="w-24 text-right">
                      <div className="text-sm font-bold text-gray-900">
                        ₹{(parseFloat(item.price) * item.quantity).toFixed(0)}
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Summary Column (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Order Summary Card */}
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xs space-y-5">
                <h3 className="text-base font-bold text-gray-900">
                  Order Summary
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({totalCount} items)</span>
                    <span className="font-bold text-gray-900">
                      ₹{subtotal.toFixed(0)}
                    </span>
                  </div>

                  {appliedDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Promo Discount</span>
                      <span>-₹{appliedDiscount}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Charges</span>
                    {deliveryCharge === 0 ? (
                      <span className="font-bold text-emerald-600">FREE</span>
                    ) : (
                      <span className="font-bold text-gray-900">
                        ₹{deliveryCharge}
                      </span>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex justify-between text-sm font-extrabold text-gray-900">
                    <span>Grand Total</span>
                    <span className="text-lg text-[#2563EB]">
                      ₹{grandTotal.toFixed(0)}
                    </span>
                  </div>
                </div>

                {/* Promo Code Input */}
                <form onSubmit={handleApplyCoupon} className="pt-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Coupon code (e.g. USHA10)"
                        className="w-full rounded-xl border border-gray-300 py-2 pl-8 pr-3 text-xs uppercase outline-none focus:border-[#2563EB]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-black transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {couponMessage && (
                    <div
                      className={`mt-2 text-[11px] font-medium ${couponMessage.type === "success"
                          ? "text-emerald-700"
                          : "text-red-600"
                        }`}
                    >
                      {couponMessage.text}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-gray-400">
                    Tip: Use <span className="font-bold text-gray-600">USHA10</span> for 10% off
                  </div>
                </form>

                {/* Proceed to Checkout Button */}
                <a
                  href="/checkout"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-all"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight size={16} />
                </a>

                {/* Trust guarantees */}
                <div className="pt-3 border-t border-gray-100 space-y-2 text-[11px] text-gray-500">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>Safe &amp; Secure Payment Processing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-[#EA580C]" />
                    <span>Cash on Delivery (COD) Available</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
