import { useState, useEffect } from "react";
import Header from "@/components/Header";
import useUser from "@/utils/useUser";
import useCart from "@/utils/useCart";
import {
  ShieldCheck,
  Truck,
  CreditCard,
  Banknote,
  CheckCircle2,
  Lock,
  ArrowRight,
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  AlertCircle,
  Tag,
  Check,
  BellOff,
  Sparkles,
} from "lucide-react";

const CHECKOUT_STEPS = [
  { id: 1, label: "Address", icon: MapPin },
  { id: 2, label: "Delivery Time", icon: Clock },
  { id: 3, label: "Payment (COD)", icon: Banknote },
  { id: 4, label: "Review", icon: CheckCircle2 },
];

export default function CheckoutPage() {
  const { data: user, loading: userLoading } = useUser();
  const { items, subtotal, clearCart } = useCart();

  const [currentStep, setCurrentStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Delivery Serviceability State (Rule 7: single source of truth from DB)
  const [serviceability, setServiceability] = useState({
    checked: false,
    serviceable: true,
    message: "",
    deliveryCharge: null,
    freeDeliveryThreshold: null,
    estimatedDeliveryTime: "Same-day in 2-4 hours",
    areaName: "",
  });
  const [checkingPincode, setCheckingPincode] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "Hyderabad",
    pincode: "500039",
    deliverySlot: "express",
    gentleDelivery: false,
    deliveryInstructions: "",
    paymentMethod: "cod", // Strictly COD only
  });

  // Offer Code
  const [offerCode, setOfferCode] = useState("");
  const [offerDiscount, setOfferDiscount] = useState(0);
  const [offerFeedback, setOfferFeedback] = useState(null);

  // Populate user data when signed in
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.name || "",
        email: prev.email || user.email || "",
        phone: prev.phone || user.phone || "",
        address: prev.address || user.shipping_address || "",
        pincode: prev.pincode || (user.shipping_pincode ? String(user.shipping_pincode) : "500039"),
      }));
    }
  }, [user]);

  // Verify delivery serviceability on pincode or subtotal change from server DB
  useEffect(() => {
    const cleanPin = (formData.pincode || "").trim().replace(/\s+/g, "");
    if (cleanPin.length === 6) {
      setCheckingPincode(true);
      fetch(`/api/serviceability?pincode=${cleanPin}&subtotal=${subtotal}`)
        .then((r) => r.json())
        .then((d) => {
          setServiceability({
            checked: true,
            serviceable: Boolean(d.serviceable),
            message: d.message || d.reason || "",
            deliveryCharge: typeof d.deliveryCharge === "number" ? d.deliveryCharge : 30,
            freeDeliveryThreshold: typeof d.freeDeliveryThreshold === "number" ? d.freeDeliveryThreshold : 300,
            estimatedDeliveryTime: d.estimatedDeliveryTime || "Same-day in 2-4 hours",
            areaName: d.areaName || "Hyderabad",
          });
        })
        .catch(() => {
          setServiceability({
            checked: true,
            serviceable: true,
            deliveryCharge: 30,
            freeDeliveryThreshold: 300,
            estimatedDeliveryTime: "Same-day in 2-4 hours",
            areaName: "Hyderabad",
          });
        })
        .finally(() => setCheckingPincode(false));
    } else {
      setServiceability({
        checked: false,
        serviceable: false,
        message: "Please enter a valid 6-digit Hyderabad pincode.",
        deliveryCharge: null,
        freeDeliveryThreshold: null,
        estimatedDeliveryTime: "",
        areaName: "",
      });
    }
  }, [formData.pincode, subtotal]);

  // Delivery fee calculation based on DB zone
  const isFreeDelivery =
    serviceability.freeDeliveryThreshold !== null &&
    subtotal >= serviceability.freeDeliveryThreshold;

  const deliveryCharge = isFreeDelivery
    ? 0
    : typeof serviceability.deliveryCharge === "number"
    ? serviceability.deliveryCharge
    : 0;

  const finalTotal = Math.max(0, Math.round(subtotal - offerDiscount + deliveryCharge));

  // Validate coupon
  const handleValidateOffer = async () => {
    if (!offerCode.trim()) return;
    setOfferFeedback(null);
    try {
      const res = await fetch("/api/offers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: offerCode.trim().toUpperCase(),
          items: items.map((i) => ({
            product_id: i.product_id || i.id,
            variant_id: i.variant_id || null,
            quantity: i.quantity || 1,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setOfferDiscount(0);
        setOfferFeedback({ type: "error", text: data.error || "Invalid offer code" });
        return;
      }
      setOfferDiscount(Number(data.discountAmount || 0));
      setOfferFeedback({
        type: "success",
        text: `${data.offer?.code} applied: -₹${Number(data.discountAmount || 0).toFixed(0)}`,
      });
    } catch {
      setOfferFeedback({ type: "error", text: "Unable to validate offer code." });
    }
  };

  // Step Navigation Validators
  const handleNextFromAddress = () => {
    setError(null);
    if (!formData.name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!formData.email.trim() || !formData.email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!formData.phone.trim() || formData.phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!formData.address.trim()) {
      setError("Please enter your complete street and door address.");
      return;
    }
    if (formData.pincode.trim().length !== 6) {
      setError("Please enter a 6-digit Hyderabad pincode.");
      return;
    }
    if (serviceability.checked && !serviceability.serviceable) {
      setError(serviceability.message || "Doorstep delivery is currently not available for this pincode.");
      return;
    }
    setCurrentStep(2);
  };

  const handleNextFromDeliveryTime = () => {
    setError(null);
    setCurrentStep(3);
  };

  const handleNextFromPayment = () => {
    setError(null);
    setCurrentStep(4);
  };

  // Final Order Submission (Strictly COD)
  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      setError("Your cart is empty. Please add items before checking out.");
      return;
    }

    if (serviceability.checked && !serviceability.serviceable) {
      setError(serviceability.message || "Doorstep delivery is currently not available for this pincode.");
      return;
    }

    setProcessing(true);
    setError(null);

    const orderDataPayload = {
      customer_name: formData.name.trim(),
      customer_email: formData.email.trim(),
      customer_phone: formData.phone.trim(),
      shipping_address: formData.address.trim(),
      shipping_city: formData.city.trim(),
      shipping_pincode: formData.pincode.trim(),
      payment_method: "cod",
      delivery_slot: formData.deliverySlot,
      gentle_delivery: formData.gentleDelivery,
      delivery_instructions: formData.deliveryInstructions.trim() || null,
      offer_code: offerDiscount > 0 ? offerCode.trim().toUpperCase() : null,
      items: items.map((i) => ({
        product_id: i.product_id || i.id,
        variant_id: i.variant_id || null,
        variant_name: i.variant_name || null,
        name: i.name,
        price: i.price,
        image_url: i.image_url,
        quantity: i.quantity || 1,
      })),
    };

    try {
      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderDataPayload),
      });

      const data = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(data.error || "Failed to place COD order");
      }

      await clearCart();
      window.location.href = `/orders/${data.order.id}?confirmed=true`;
    } catch (err) {
      console.error("Order placement error:", err);
      setError(err.message || "An unexpected error occurred while placing your order.");
      setProcessing(false);
    }
  };

  if (!userLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFFDF9]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <Package size={48} className="mx-auto text-stone-300 mb-3" />
          <h2 className="text-xl font-bold text-stone-900 mb-1">Your cart is empty</h2>
          <p className="text-xs text-stone-500 mb-6">
            Please add some pet supplies to your cart before proceeding to checkout.
          </p>
          <a
            href="/products"
            className="rounded-xl bg-[#4A0A0F] px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#360509]"
          >
            Browse Essentials
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819]">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="mb-6 border-b border-stone-200 pb-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
            Checkout &amp; Delivery
          </h1>
          <p className="mt-1 text-xs text-stone-500 flex items-center gap-1.5">
            <Lock size={13} className="text-emerald-600" />
            <span>Direct from Uppal Store • Verified Stock Inventory</span>
          </p>
        </div>

        {/* 4-Step Stepper Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {CHECKOUT_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isDone = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <div key={step.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    <button
                      type="button"
                      disabled={step.id > currentStep}
                      onClick={() => setCurrentStep(step.id)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold transition-all ${
                        isDone
                          ? "bg-emerald-600 text-white"
                          : isCurrent
                          ? "bg-[#4A0A0F] text-white ring-4 ring-[#4A0A0F]/20"
                          : "bg-stone-200 text-stone-500"
                      }`}
                    >
                      {isDone ? <Check size={16} strokeWidth={2.5} /> : <Icon size={16} />}
                    </button>
                    <span
                      className={`mt-1.5 text-[11px] font-bold tracking-tight whitespace-nowrap ${
                        isCurrent
                          ? "text-[#4A0A0F]"
                          : isDone
                          ? "text-emerald-700"
                          : "text-stone-400"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < CHECKOUT_STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 transition-colors ${
                        currentStep > step.id ? "bg-emerald-600" : "bg-stone-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-xs font-bold text-red-700 flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Main Wizard Form Column (7 cols) */}
          <div className="lg:col-span-7">
            {/* STEP 1: ADDRESS */}
            {currentStep === 1 && (
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <MapPin size={20} className="text-[#4A0A0F]" />
                  <h2 className="text-base font-bold text-stone-900">
                    Step 1: Contact &amp; Delivery Address (Hyderabad)
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316]"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Email Address (for order receipt) *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Mobile Number (for delivery rider) *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="10-digit phone number"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      House / Flat / Street Address *
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Flat/House No., Building Name, Street, Landmark"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316]"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        disabled
                        value="Hyderabad"
                        className="w-full rounded-xl border border-stone-200 bg-stone-100 px-4 py-2.5 text-xs sm:text-sm text-stone-600 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Pincode (Hyderabad) *
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 500039"
                        value={formData.pincode}
                        onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316]"
                      />
                    </div>
                  </div>

                  {/* Pincode Serviceability Live Badge */}
                  {checkingPincode ? (
                    <div className="text-[11px] text-stone-500 font-medium">
                      Checking serviceability zone in Uppal database...
                    </div>
                  ) : serviceability.checked ? (
                    serviceability.serviceable ? (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 size={16} className="text-emerald-600" />
                          <span>Serviceable: {serviceability.areaName}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-emerald-700">
                          {isFreeDelivery
                            ? "FREE Delivery Unlocked!"
                            : `Delivery Fee: ₹${deliveryCharge} (Free above ₹${serviceability.freeDeliveryThreshold})`}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-bold flex items-center gap-1.5">
                        <AlertCircle size={16} />
                        <span>{serviceability.message || "Pincode is currently outside our delivery zone."}</span>
                      </div>
                    )
                  ) : null}
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextFromAddress}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#360509] transition-all"
                  >
                    <span>Proceed to Delivery Time</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: DELIVERY TIME */}
            {currentStep === 2 && (
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <Clock size={20} className="text-[#4A0A0F]" />
                  <h2 className="text-base font-bold text-stone-900">
                    Step 2: Choose Delivery Time &amp; Preferences
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-2">
                      Delivery Window for {serviceability.areaName || "Your Area"}:
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label
                        className={`rounded-2xl border p-4 cursor-pointer flex flex-col justify-between transition-all ${
                          formData.deliverySlot === "express"
                            ? "border-[#4A0A0F] bg-[#FFF7ED] ring-1 ring-[#4A0A0F]"
                            : "border-stone-200 hover:border-stone-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-stone-900">
                            Express Dispatch
                          </span>
                          <input
                            type="radio"
                            name="slot"
                            checked={formData.deliverySlot === "express"}
                            onChange={() => setFormData({ ...formData, deliverySlot: "express" })}
                            className="accent-[#4A0A0F]"
                          />
                        </div>
                        <p className="text-[11px] text-stone-500">
                          {serviceability.estimatedDeliveryTime || "Same-day in 2-4 hours"} direct from Uppal Store.
                        </p>
                      </label>

                      <label
                        className={`rounded-2xl border p-4 cursor-pointer flex flex-col justify-between transition-all ${
                          formData.deliverySlot === "scheduled"
                            ? "border-[#4A0A0F] bg-[#FFF7ED] ring-1 ring-[#4A0A0F]"
                            : "border-stone-200 hover:border-stone-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-stone-900">
                            Evening Slot (6:00 PM - 9:00 PM)
                          </span>
                          <input
                            type="radio"
                            name="slot"
                            checked={formData.deliverySlot === "scheduled"}
                            onChange={() => setFormData({ ...formData, deliverySlot: "scheduled" })}
                            className="accent-[#4A0A0F]"
                          />
                        </div>
                        <p className="text-[11px] text-stone-500">
                          Convenient evening delivery when you are home with your pets.
                        </p>
                      </label>
                    </div>
                  </div>

                  {/* Gentle Delivery Toggle */}
                  <div className="rounded-2xl bg-amber-50/70 border border-amber-200 p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.gentleDelivery}
                        onChange={(e) =>
                          setFormData({ ...formData, gentleDelivery: e.target.checked })
                        }
                        className="mt-1 h-4 w-4 rounded accent-[#4A0A0F]"
                      />
                      <div>
                        <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                          <BellOff size={14} className="text-amber-700" />
                          <span>Gentle Delivery (For anxious dogs or sleeping pets)</span>
                        </div>
                        <p className="text-[11px] text-amber-800/80 mt-0.5">
                          Delivery partner will call before arriving and avoid ringing doorbell repeatedly.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Delivery Instructions or Landmark (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Leave with security / Near Apollo Pharmacy"
                      value={formData.deliveryInstructions}
                      onChange={(e) =>
                        setFormData({ ...formData, deliveryInstructions: e.target.value })
                      }
                      className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Address</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromDeliveryTime}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#360509] transition-all"
                  >
                    <span>Proceed to Payment</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT (COD ONLY) */}
            {currentStep === 3 && (
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <Banknote size={20} className="text-[#4A0A0F]" />
                  <h2 className="text-base font-bold text-stone-900">
                    Step 3: Payment Method (Cash on Delivery)
                  </h2>
                </div>

                <div className="space-y-3">
                  {/* COD (Active) */}
                  <label className="rounded-2xl border-2 border-[#4A0A0F] bg-[#FFF7ED] p-4 cursor-pointer flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4A0A0F] text-white">
                        <Banknote size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#4A0A0F] flex items-center gap-1.5">
                          <span>Cash on Delivery (COD)</span>
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.2 text-[10px] font-extrabold text-emerald-800">
                            Active
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 mt-0.5">
                          Pay cash or UPI to delivery rider upon receiving your package.
                        </p>
                      </div>
                    </div>
                    <input
                      type="radio"
                      name="payment"
                      checked={true}
                      readOnly
                      className="accent-[#4A0A0F]"
                    />
                  </label>

                  {/* Online / UPI (Disabled: Coming soon) */}
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 opacity-60 flex items-center justify-between cursor-not-allowed">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-200 text-stone-500">
                        <CreditCard size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-600 flex items-center gap-1.5">
                          <span>UPI &amp; Online Cards</span>
                          <span className="rounded-md bg-stone-200 px-1.5 py-0.2 text-[10px] font-bold text-stone-600">
                            Coming soon
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Razorpay gateway integration in testing. Currently please choose Cash on Delivery.
                        </p>
                      </div>
                    </div>
                    <input type="radio" disabled className="accent-stone-400" />
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Delivery Time</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromPayment}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#360509] transition-all"
                  >
                    <span>Proceed to Review</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRM */}
            {currentStep === 4 && (
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <CheckCircle2 size={20} className="text-[#4A0A0F]" />
                  <h2 className="text-base font-bold text-stone-900">
                    Step 4: Final Order Review
                  </h2>
                </div>

                {/* Summary Details */}
                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-2xl bg-stone-50 p-3.5 border border-stone-200">
                    <span className="font-bold text-stone-900 block mb-1">
                      Deliver to:
                    </span>
                    <p className="text-stone-700 font-semibold">{formData.name}</p>
                    <p className="text-stone-600">{formData.address}</p>
                    <p className="text-stone-600 font-medium">
                      Hyderabad - {formData.pincode}
                    </p>
                    <p className="text-stone-600 mt-1">Phone: {formData.phone}</p>
                  </div>

                  <div className="rounded-2xl bg-stone-50 p-3.5 border border-stone-200">
                    <span className="font-bold text-stone-900 block mb-1">
                      Timing &amp; Payment:
                    </span>
                    <p className="text-stone-700 font-semibold">
                      {formData.deliverySlot === "express"
                        ? "Express Delivery"
                        : "Evening Delivery (6:00 PM - 9:00 PM)"}
                    </p>
                    <p className="text-stone-600">
                      Payment: <span className="font-bold text-[#4A0A0F]">Cash on Delivery</span>
                    </p>
                    {formData.gentleDelivery && (
                      <p className="text-amber-800 font-semibold mt-1">
                        • Gentle Delivery (call before doorbell)
                      </p>
                    )}
                  </div>
                </div>

                {/* Items in order */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Cart Items ({items.length})
                  </h4>
                  <div className="rounded-2xl border border-stone-200 divide-y divide-stone-100 max-h-56 overflow-y-auto">
                    {items.map((i) => (
                      <div key={i.id} className="p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={i.image_url}
                            alt={i.name}
                            className="h-10 w-10 object-contain rounded-lg border border-stone-100 bg-stone-50 p-0.5"
                          />
                          <div>
                            <div className="font-bold text-stone-900">{i.name}</div>
                            {i.variant_name && (
                              <div className="text-[10px] text-stone-500">
                                Variant: {i.variant_name}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-stone-900">
                            ₹{(parseFloat(i.price) * i.quantity).toFixed(0)}
                          </div>
                          <div className="text-[10px] text-stone-500">
                            {i.quantity} × ₹{i.price}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Payment</span>
                  </button>

                  <button
                    type="button"
                    disabled={processing}
                    onClick={handlePlaceOrder}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-8 py-3.5 text-sm font-black text-white shadow-md hover:bg-[#360509] transition-all disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Confirming with Store...</span>
                      </>
                    ) : (
                      <>
                        <span>Place Cash on Delivery Order (₹{finalTotal})</span>
                        <Check size={18} strokeWidth={2.5} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Order Pricing Summary (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs space-y-5 lg:sticky lg:top-24">
              <h3 className="text-base font-bold text-stone-900">
                Order Total ({items.length} items)
              </h3>

              {/* Price Calculation (Rule 7: One source of truth) */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Items Subtotal</span>
                  <span className="font-bold text-stone-900">₹{subtotal.toFixed(0)}</span>
                </div>

                {offerDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Offer Code ({offerCode})</span>
                    <span>-₹{offerDiscount}</span>
                  </div>
                )}

                <div className="flex justify-between text-stone-600">
                  <span>Delivery to {serviceability.areaName || "Hyderabad"}</span>
                  {isFreeDelivery ? (
                    <span className="font-bold text-emerald-600">FREE</span>
                  ) : (
                    <span className="font-bold text-stone-900">₹{deliveryCharge}</span>
                  )}
                </div>

                <div className="pt-3 border-t border-stone-100 flex justify-between text-base font-extrabold text-stone-900">
                  <span>Grand Total (COD)</span>
                  <span className="text-xl text-[#4A0A0F]">₹{finalTotal.toFixed(0)}</span>
                </div>
              </div>

              {/* Offer coupon field */}
              <div className="pt-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Coupon code (e.g. USHA10)"
                      value={offerCode}
                      onChange={(e) => setOfferCode(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 py-2 pl-8 pr-2 text-xs uppercase outline-none focus:border-[#F97316]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleValidateOffer}
                    className="rounded-xl bg-[#241819] px-3.5 py-2 text-xs font-bold text-white hover:bg-black"
                  >
                    Apply
                  </button>
                </div>
                {offerFeedback && (
                  <div
                    className={`mt-1.5 text-[11px] font-medium ${
                      offerFeedback.type === "success" ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {offerFeedback.text}
                  </div>
                )}
              </div>

              {/* Trust Box */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/80 p-3.5 space-y-2 text-[11px] text-stone-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Verified Uppal Store Inventory</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-[#F97316]" />
                  <span>Real-Time Atomic Stock Reservation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
