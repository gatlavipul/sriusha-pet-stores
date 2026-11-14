import { useState } from "react";
import Header from "@/components/Header";
import useCart from "@/utils/useCart";
import {
  Trash2,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Tag,
  Truck,
  Sparkles,
  MapPin,
  CheckCircle2,
} from "lucide-react";

export default function CartPage() {
  const {
    items,
    loading,
    totalCount,
    subtotal,
    deliveryZone,
    isFreeShipping,
    amountForFreeShipping,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const [couponCode, setCouponCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState(null);

  // Rule 5: Fix coupon crash by using items.map instead of cart.map
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
          items: items.map((i) => ({
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

  // Rule 7: Delivery fee & threshold from delivery_serviceability_zones only
  const hasZone = deliveryZone?.checked && deliveryZone.deliveryCharge !== null;
  const deliveryCharge = hasZone ? (isFreeShipping || subtotal === 0 ? 0 : deliveryZone.deliveryCharge) : 0;
  const grandTotal = Math.max(0, subtotal - appliedDiscount + deliveryCharge);

  const freeShippingProgress =
    hasZone && deliveryZone.freeDeliveryThreshold
      ? Math.min(100, Math.round((subtotal / deliveryZone.freeDeliveryThreshold) * 100))
      : 0;

  // Rule 2 & Savings summary calculation: Total MRP - Selling Price Subtotal
  const totalMrp = items.reduce((sum, item) => {
    const cmp = item.compare_price ? parseFloat(item.compare_price) : 0;
    const prc = parseFloat(item.price || 0);
    return sum + (cmp > prc ? cmp : prc) * (item.quantity || 1);
  }, 0);
  const totalSavings = Math.max(0, totalMrp - subtotal + appliedDiscount);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4A0A0F] border-t-transparent mx-auto mb-4" />
          <p className="text-xs text-stone-500 font-medium">Loading your shopping cart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819]">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="mb-8 flex items-baseline justify-between border-b border-stone-200 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
              Shopping Cart
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-stone-500">
              Review your items and proceed to secure doorstep delivery checkout
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-semibold text-stone-400 hover:text-red-600 transition-colors"
            >
              Clear Cart
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-12 sm:p-16 text-center shadow-xs max-w-xl mx-auto my-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF7ED] text-[#F97316] mb-4">
              <ShoppingBag size={36} />
            </div>
            <h2 className="text-xl font-extrabold text-stone-900 mb-1">
              Your Cart is Empty
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mb-8 max-w-sm mx-auto">
              Looks like you haven&apos;t added any pet supplies yet. Explore our genuine veterinary food, treats, and healthcare items!
            </p>
            <a
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-6 py-3.5 text-xs font-bold text-white shadow-xs hover:bg-[#360509] transition-all"
            >
              <span>Browse Essentials</span>
              <ArrowRight size={16} />
            </a>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Left Items Column (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {/* Free Delivery Meter Banner (Rule 7: One source of truth from delivery zone) */}
              <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4 shadow-2xs">
                {hasZone ? (
                  <>
                    <div className="flex items-center justify-between text-xs font-bold text-stone-800 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Truck size={16} className="text-[#F97316]" />
                        {isFreeShipping ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold">
                            <Sparkles size={14} className="text-emerald-600" /> Congratulations! You unlocked FREE Delivery in {deliveryZone.areaName}!
                          </span>
                        ) : (
                          <span>
                            Add{" "}
                            <span className="text-[#F97316] font-bold">
                              ₹{amountForFreeShipping?.toFixed(0)}
                            </span>{" "}
                            more for FREE Delivery in {deliveryZone.areaName}!
                          </span>
                        )}
                      </div>
                      <span className="text-stone-500">{freeShippingProgress}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#FED7AA]/50">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isFreeShipping ? "bg-emerald-500" : "bg-[#F97316]"
                        }`}
                        style={{ width: `${freeShippingProgress}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#F97316]" />
                      <span>Enter pincode at checkout to view delivery fee and free delivery threshold for your area</span>
                    </div>
                    <a href="/checkout" className="text-xs font-bold text-[#F97316] hover:underline whitespace-nowrap">
                      Set Pincode
                    </a>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="rounded-3xl border border-gray-200 bg-white p-4 sm:p-6 shadow-xs divide-y divide-gray-100">
                {items.map((item) => {
                  const maxStock = item.stock_quantity ?? 99;
                  return (
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
                        {item.variant_name && (
                          <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600 mt-1">
                            Pack: {item.variant_name}
                          </span>
                        )}
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
                          title="Decrease quantity"
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
                          disabled={maxStock > 0 && item.quantity >= maxStock}
                          className="px-2.5 py-1 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-30"
                          title="Increase quantity"
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
                  );
                })}
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

                  {/* Rule 7: Show exact fee or prompt */}
                  <div className="flex justify-between text-gray-600">
                    <span>Delivery Charges</span>
                    {hasZone ? (
                      deliveryCharge === 0 ? (
                        <span className="font-bold text-emerald-600">FREE</span>
                      ) : (
                        <span className="font-bold text-gray-900">
                          ₹{deliveryCharge}
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] font-medium text-stone-500 italic">
                        Enter pincode to see delivery fee
                      </span>
                    )}
                  </div>

                  {/* Savings Summary Banner */}
                  {totalSavings > 0 && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 flex items-center justify-between text-xs font-bold text-emerald-800">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        Total Savings on this order
                      </span>
                      <span>₹{totalSavings.toFixed(0)}</span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-stone-100 flex justify-between text-sm font-extrabold text-stone-900">
                    <span>Grand Total</span>
                    <span className="text-lg text-[#4A0A0F]">
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
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                      />
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="Coupon code (e.g. USHA10)"
                        className="w-full rounded-xl border border-stone-300 py-2 pl-8 pr-3 text-xs uppercase outline-none focus:border-[#F97316]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-xl bg-[#241819] px-4 py-2 text-xs font-bold text-white hover:bg-black transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {couponMessage && (
                    <div
                      className={`mt-2 text-[11px] font-medium ${
                        couponMessage.type === "success"
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}
                    >
                      {couponMessage.text}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-stone-400">
                    Tip: Use <span className="font-bold text-stone-600">USHA10</span> for 10% off
                  </div>
                </form>

                {/* Proceed to Checkout Button */}
                <a
                  href="/checkout"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A0A0F] py-3.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#360509] transition-all"
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
