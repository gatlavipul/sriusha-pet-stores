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
  Package,
  Check,
  X,
  BellOff,
} from "lucide-react";

export default function CheckoutPage() {
  const { data: user, loading: userLoading } = useUser();
  const { items, subtotal, isFreeShipping, clearCart } = useCart();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [saveAddressToBook, setSaveAddressToBook] = useState(false);

  // Offer, Loyalty & Prescription State
  const [offerCode, setOfferCode] = useState("");
  const [offerDiscount, setOfferDiscount] = useState(0);
  const [offerFeedback, setOfferFeedback] = useState(null);
  const [rewardsInfo, setRewardsInfo] = useState(null);
  const [useRewards, setUseRewards] = useState(false);
  const [prescriptionId, setPrescriptionId] = useState(null);
  const [rxFileName, setRxFileName] = useState("");
  const [uploadingRx, setUploadingRx] = useState(false);
  const [gentleDelivery, setGentleDelivery] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCode = sessionStorage.getItem("usha_applied_offer");
      if (savedCode) setOfferCode(savedCode);
    }
    fetch("/api/rewards")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.config?.enabled) setRewardsInfo(d);
      })
      .catch(() => {});
  }, []);

  // Delivery Serviceability State
  const [serviceability, setServiceability] = useState({
    checked: false,
    serviceable: true,
    message: "",
    deliveryCharge: 40,
    estimatedDeliveryTime: "Same-day in 2-4 hours",
  });
  const [checkingPincode, setCheckingPincode] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "Hyderabad",
    pincode: "500039",
    paymentMethod: "cod", // default to COD for instant testing, supports razorpay
    notes: "",
  });

  // Verify delivery serviceability on pincode or subtotal change
  useEffect(() => {
    const cleanPin = (formData.pincode || "").trim().replace(/\s+/g, "");
    if (cleanPin.length === 6) {
      setCheckingPincode(true);
      fetch(`/api/serviceability?pincode=${cleanPin}&subtotal=${subtotal}`)
        .then((r) => r.json())
        .then((d) => {
          setServiceability({
            checked: true,
            serviceable: d.serviceable,
            message: d.message || d.reason,
            deliveryCharge: d.deliveryCharge ?? (subtotal >= 500 ? 0 : 40),
            estimatedDeliveryTime: d.estimatedDeliveryTime || "Same-day in 2-4 hours",
            areaName: d.areaName,
          });
        })
        .catch(() => {
          setServiceability({
            checked: true,
            serviceable: true,
            deliveryCharge: subtotal >= 500 ? 0 : 40,
            estimatedDeliveryTime: "Same-day in 2-4 hours",
          });
        })
        .finally(() => setCheckingPincode(false));
    } else {
      setServiceability({
        checked: false,
        serviceable: false,
        message: "Enter a valid 6-digit Hyderabad pincode (e.g. 500039)",
      });
    }
  }, [formData.pincode, subtotal]);

  // Prefill with logged in user data and fetch saved addresses if present
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.name || "",
        email: prev.email || user.email || "",
      }));

      fetch("/api/addresses")
        .then((r) => r.json())
        .then((d) => {
          if (d.addresses && d.addresses.length > 0) {
            setSavedAddresses(d.addresses);
            const def = d.addresses.find((a) => a.is_default) || d.addresses[0];
            if (def) {
              setFormData((prev) => ({
                ...prev,
                name: def.name || prev.name,
                phone: def.phone || prev.phone,
                address: def.address_line || prev.address,
                city: def.city || prev.city,
                pincode: def.pincode || prev.pincode,
              }));
            }
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // Load Razorpay script
  useEffect(() => {
    if (typeof window !== "undefined" && !document.getElementById("razorpay-js")) {
      const script = document.createElement("script");
      script.id = "razorpay-js";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const deliveryCharge = isFreeShipping || subtotal === 0 
    ? 0 
    : serviceability.checked 
    ? serviceability.deliveryCharge 
    : subtotal >= 500 ? 0 : 40;
  const requiresRx = items.some((i) => Boolean(i.requires_prescription));
  const maxRedeemPoints =
    useRewards && rewardsInfo
      ? Math.min(
          rewardsInfo.balance || 0,
          Math.floor(Math.max(0, subtotal - offerDiscount) / (rewardsInfo.config?.pointValueInr || 1))
        )
      : 0;
  const loyaltyDiscount =
    useRewards && rewardsInfo && maxRedeemPoints >= (rewardsInfo.config?.minRedeem || 0)
      ? Math.round(maxRedeemPoints * (rewardsInfo.config?.pointValueInr || 1))
      : 0;
  const total = Math.max(0, subtotal - offerDiscount - loyaltyDiscount + deliveryCharge);

  const handleValidateOffer = async () => {
    if (!offerCode.trim()) return;
    setOfferFeedback(null);
    try {
      const res = await fetch("/api/offers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: offerCode.trim(),
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

  const handleUploadRx = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRx(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const rxItem = items.find((i) => i.requires_prescription);
      if (rxItem) fd.append("product_id", String(rxItem.product_id || rxItem.id));
      const res = await fetch("/api/prescriptions", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload prescription");
      setPrescriptionId(data.prescription?.id || null);
      setRxFileName(file.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingRx(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      setError("Your cart is empty. Please add items before checking out.");
      return;
    }
    if (requiresRx && !prescriptionId) {
      setError("Your cart includes a prescription medicine. Please upload a valid veterinary prescription first.");
      return;
    }

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.address.trim()) {
      setError("Please fill in all required delivery contact and address details.");
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
      delivery_charge: deliveryCharge,
      payment_method: formData.paymentMethod,
      total_amount: total,
      offer_code: offerDiscount > 0 ? offerCode.trim().toUpperCase() : null,
      redeem_points: loyaltyDiscount > 0 ? maxRedeemPoints : 0,
      prescription_id: prescriptionId || null,
      gentle_delivery: gentleDelivery,
      delivery_instructions: deliveryInstructions.trim() || null,
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
      // 1. CASH ON DELIVERY (COD)
      if (formData.paymentMethod === "cod") {
        const orderRes = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...orderDataPayload,
            payment_status: "pending",
          }),
        });

        if (!orderRes.ok) {
          const err = await orderRes.json();
          throw new Error(err.error || "Failed to place COD order");
        }

        const data = await orderRes.json();
        await clearCart();
        window.location.href = `/orders/${data.order.id}?confirmed=true`;
        return;
      }

      // 2. RAZORPAY ONLINE PAYMENT
      const paymentRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: orderDataPayload.items,
          shipping_pincode: formData.pincode.trim(),
          offer_code: orderDataPayload.offer_code,
          redeem_points: orderDataPayload.redeem_points,
          prescription_id: orderDataPayload.prescription_id,
        }),
      });

      if (!paymentRes.ok) {
        const errData = await paymentRes.json();
        throw new Error(errData.error || "Failed to initiate online payment");
      }

      const { orderId, amount, currency, key } = await paymentRes.json();

      if (!key) {
        throw new Error("Online payment gateway key is not available. Please choose Cash on Delivery.");
      }

      const options = {
        key: key,
        amount: amount,
        currency: currency || "INR",
        name: "Sri Usha Pet Stores",
        description: "Pet Food & Veterinary Supplies",
        image: "https://ucarecdn.com/1ba9ff02-d14c-447c-b424-734247393bdd/-/format/auto/",
        order_id: orderId,
        handler: async function (response) {
          try {
            // Cryptographic server-side HMAC signature verification
            const verifyRes = await fetch("/api/checkout/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                ...orderDataPayload,
              }),
            });

            if (!verifyRes.ok) {
              const errData = await verifyRes.json();
              throw new Error(errData.error || "Failed to verify payment on server");
            }

            const verifyData = await verifyRes.json();
            await clearCart();
            window.location.href = `/orders/${verifyData.order.id}?confirmed=true`;
          } catch (err) {
            console.error("Order verification error:", err);
            setError("Payment received, but verification encountered an issue: " + err.message + ". Please contact support with reference: " + response.razorpay_payment_id);
            setProcessing(false);
          }
        },
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone,
        },
        theme: { color: "#4A0A0F" },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            setError("Payment popup closed. You can retry or choose Cash on Delivery.");
          },
        },
      };

      if (typeof window !== "undefined" && window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (failResp) {
          setError("Payment failed: " + (failResp.error?.description || "Transaction declined by bank."));
          setProcessing(false);
        });
        rzp.open();
      } else {
        throw new Error("Razorpay SDK not loaded. Please try Cash on Delivery or reload.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "An unexpected error occurred while placing your order.");
      setProcessing(false);
    }
  };

  if (!userLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Your cart is empty</h2>
          <p className="text-xs text-gray-500 mb-6">
            Please add some pet supplies to your cart before proceeding to checkout.
          </p>
          <a
            href="/products"
            className="rounded-xl bg-[#4A0A0F] px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#360509]"
          >
            Browse Products
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819]">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Title */}
        <div className="mb-8 border-b border-stone-200 pb-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900">
            Checkout &amp; Delivery
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-500 flex items-center gap-1.5">
            <Lock size={13} className="text-emerald-600" />
            <span>256-bit SSL Encrypted &amp; Secure Checkout</span>
          </p>
        </div>

        {!user && (
          <div className="mb-6 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4 text-xs text-[#4A0A0F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="font-bold">Checking out as Guest?</span> You can complete your order directly below, or sign in to track in your personal account.
            </div>
            <a
              href="/account/signin?callbackUrl=/checkout"
              className="rounded-lg bg-white border border-[#FED7AA] px-3.5 py-1.5 font-bold text-[#F97316] shadow-2xs hover:bg-[#FAF7F2] whitespace-nowrap"
            >
              Sign In Now
            </a>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Left Form Column (7 cols) */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Customer Contact */}
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4A0A0F] text-xs font-bold text-white">
                    1
                  </div>
                  <h2 className="text-base font-bold text-stone-900">
                    Contact Information
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
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 transition-all"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Email Address (for invoice) *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Phone Number (for delivery) *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="10-digit mobile number"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Shipping Address */}
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4A0A0F] text-xs font-bold text-white">
                    2
                  </div>
                  <h2 className="text-base font-bold text-stone-900">
                    Delivery Address (Hyderabad)
                  </h2>
                </div>

                {/* Saved addresses selector */}
                {savedAddresses.length > 0 && (
                  <div className="mb-4 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] p-3.5">
                    <div className="text-xs font-bold text-[#4A0A0F] mb-2">
                      Saved Addresses in Your Account:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {savedAddresses.map((addr) => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              name: addr.name || prev.name,
                              phone: addr.phone || prev.phone,
                              address: addr.address_line,
                              city: addr.city,
                              pincode: addr.pincode,
                            }));
                          }}
                          className={`rounded-xl border p-2.5 text-left text-xs transition-all ${
                            formData.address === addr.address_line
                              ? "border-[#4A0A0F] bg-white text-[#4A0A0F] shadow-xs"
                              : "border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                          }`}
                        >
                          <div className="font-bold flex items-center justify-between">
                            <span>{addr.name}</span>
                            {addr.is_default && (
                              <span className="text-[10px] bg-[#FED7AA] text-[#4A0A0F] px-1.5 py-0.5 rounded">Default</span>
                            )}
                          </div>
                          <div className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{addr.address_line}</div>
                          <div className="text-[10px] text-stone-400">{addr.city} - {addr.pincode}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Street Address &amp; House / Flat No. *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="e.g. Flat 302, Sri Sai Nilayam, Beside Main Road, Uppal"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 transition-all"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        City *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) =>
                          setFormData({ ...formData, city: e.target.value })
                        }
                        className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#F97316]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Pincode *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.pincode}
                        onChange={(e) =>
                          setFormData({ ...formData, pincode: e.target.value })
                        }
                        className={`w-full rounded-xl border bg-white px-4 py-2.5 text-xs sm:text-sm outline-none transition-all ${
                          serviceability.checked
                            ? serviceability.serviceable
                              ? "border-emerald-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                              : "border-red-400 focus:border-red-600 focus:ring-2 focus:ring-red-500/20"
                            : "border-stone-300 focus:border-[#F97316]"
                        }`}
                      />
                      {checkingPincode && (
                        <p className="mt-1.5 text-[11px] font-semibold text-stone-400 animate-pulse">
                          Checking Hyderabad doorstep delivery coverage...
                        </p>
                      )}
                      {!checkingPincode && serviceability.checked && serviceability.serviceable && (
                        <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-[11px] font-semibold text-emerald-800">
                          <Check size={14} className="text-emerald-600 shrink-0" strokeWidth={2.5} />
                          <span><strong className="font-bold">Serviceable:</strong> {serviceability.message}</span>
                        </div>
                      )}
                      {!checkingPincode && serviceability.checked && !serviceability.serviceable && (
                        <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 p-2 text-[11px] font-semibold text-red-700">
                          <X size={14} className="text-red-600 shrink-0" strokeWidth={2.5} />
                          <span><strong className="font-bold">Delivery Unavailable:</strong> {serviceability.message}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gentle Delivery Mode (Pet-friendly quiet drop) */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2.5">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={gentleDelivery}
                        onChange={(e) => setGentleDelivery(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-amber-400 text-[#F97316] focus:ring-[#F97316]"
                      />
                      <div>
                        <span className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
                          <BellOff size={14} className="text-[#F97316]" strokeWidth={1.75} />
                          <span>Gentle Delivery Mode (Don&apos;t ring the bell, call instead)</span>
                        </span>
                        <span className="block text-[11px] text-amber-800/90 mt-0.5">
                          Ideal for reactive dogs, sleeping pets, or anxious cats — rider will call on arrival instead of ringing the doorbell.
                        </span>
                      </div>
                    </label>
                    <input
                      type="text"
                      value={deliveryInstructions}
                      onChange={(e) => setDeliveryInstructions(e.target.value)}
                      maxLength={250}
                      placeholder="Optional gate/pet instructions (e.g. Leave with security, call 98xxx)"
                      className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#F97316]"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Payment Method */}
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4A0A0F] text-xs font-bold text-white">
                    3
                  </div>
                  <h2 className="text-base font-bold text-stone-900">
                    Payment Method
                  </h2>
                </div>

                <div className="space-y-3">
                  {/* Cash on Delivery */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all ${
                      formData.paymentMethod === "cod"
                        ? "border-[#4A0A0F] bg-[#FFF7ED] shadow-xs"
                        : "border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={formData.paymentMethod === "cod"}
                      onChange={(e) =>
                        setFormData({ ...formData, paymentMethod: e.target.value })
                      }
                      className="mt-1 h-4 w-4 text-[#4A0A0F] focus:ring-[#4A0A0F]"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Banknote size={17} className="text-[#F97316]" />
                        <span className="text-sm font-bold text-stone-900">
                          Cash on Delivery (COD)
                        </span>
                        <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Pay with cash or UPI directly when your pet supplies are delivered at your doorstep.
                      </p>
                    </div>
                  </label>

                  {/* Razorpay Online - Visibly Disabled with 'Coming soon' */}
                  <div
                    className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4 opacity-60 cursor-not-allowed"
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="razorpay"
                      disabled
                      checked={false}
                      className="mt-1 h-4 w-4 text-stone-400 cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CreditCard size={17} className="text-stone-400" />
                        <span className="text-sm font-bold text-stone-600">
                          Online Payment (UPI, Cards &amp; Netbanking)
                        </span>
                        <span className="rounded bg-amber-100 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                          Coming soon
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Online payment gateway is being configured. Cash on Delivery is currently available for all Hyderabad orders.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Offer Code, Loyalty Points & Prescription Upload */}
              <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-xs space-y-4">
                <h2 className="text-base font-extrabold text-stone-900">
                  Discounts, Rewards &amp; Prescriptions
                </h2>

                {/* Offer Code */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">
                    Promo / Festival Offer Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={offerCode}
                      onChange={(e) => setOfferCode(e.target.value.toUpperCase())}
                      placeholder="Enter offer code"
                      className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold uppercase outline-none focus:border-[#F97316]"
                    />
                    <button
                      type="button"
                      onClick={handleValidateOffer}
                      className="rounded-xl bg-[#241819] px-4 py-2 text-xs font-bold text-white hover:bg-black transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {offerFeedback && (
                    <p
                      className={`text-xs font-semibold ${
                        offerFeedback.type === "success" ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {offerFeedback.text}
                    </p>
                  )}
                </div>

                {/* Loyalty Points */}
                {rewardsInfo && rewardsInfo.balance > 0 && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <p className="font-bold text-emerald-900">
                        Sri Usha Rewards: {rewardsInfo.balance} pts available
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Min {rewardsInfo.config?.minRedeem} pts to redeem (1 pt = ₹
                        {rewardsInfo.config?.pointValueInr})
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-emerald-900 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={rewardsInfo.balance < (rewardsInfo.config?.minRedeem || 0)}
                        checked={useRewards}
                        onChange={(e) => setUseRewards(e.target.checked)}
                      />
                      <span>Redeem</span>
                    </label>
                  </div>
                )}

                {/* Prescription Upload */}
                {requiresRx && (
                  <div className="rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4 space-y-2">
                    <p className="text-xs font-extrabold text-[#4A0A0F]">
                      Veterinary Prescription Required (Rx)
                    </p>
                    <p className="text-[11px] text-stone-600">
                      One or more items in your order require a valid vet prescription (JPG, PNG, WEBP, or PDF, max 5MB).
                    </p>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      onChange={handleUploadRx}
                      disabled={uploadingRx}
                      className="block w-full text-xs text-stone-900 file:mr-3 file:rounded-lg file:border-0 file:bg-[#4A0A0F] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-[#360509]"
                    />
                    {uploadingRx && (
                      <p className="text-xs font-semibold text-stone-600">Uploading securely...</p>
                    )}
                    {prescriptionId && (
                      <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <Check size={14} className="text-emerald-600" strokeWidth={2.5} />
                        <span>Prescription uploaded ({rxFileName}) — Pending Staff Review</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={processing || (serviceability.checked && !serviceability.serviceable)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4A0A0F] py-4 text-sm font-bold text-white shadow-md hover:bg-[#360509] hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Processing Order...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Place Cash on Delivery Order • ₹{total.toFixed(0)}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Order Summary (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xs space-y-5 lg:sticky lg:top-24">
              <h3 className="text-base font-bold text-gray-900">
                Order Review ({items.length} items)
              </h3>

              {/* Mini Item List */}
              <div className="max-h-64 overflow-y-auto space-y-3 border-b border-gray-100 pb-4 pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-1">
                      <img
                        src={
                          item.image_url ||
                          "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=200&q=80"
                        }
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-gray-900 line-clamp-1">
                        {item.name}
                      </div>
                      <div className="text-gray-500">
                        Qty: {item.quantity} × ₹{item.price}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-gray-900">
                      ₹{(parseFloat(item.price) * item.quantity).toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Calculation */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Items Subtotal</span>
                  <span className="font-bold text-gray-900">₹{subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery to Hyderabad</span>
                  {deliveryCharge === 0 ? (
                    <span className="font-bold text-emerald-600">FREE</span>
                  ) : (
                    <span className="font-bold text-gray-900">₹{deliveryCharge}</span>
                  )}
                </div>
                <div className="pt-3 border-t border-stone-100 flex justify-between text-base font-extrabold text-stone-900">
                  <span>Total Amount</span>
                  <span className="text-[#4A0A0F]">₹{total.toFixed(0)}</span>
                </div>
              </div>

              {/* Trust Box */}
              <div className="rounded-2xl border border-stone-100 bg-stone-50/80 p-3.5 space-y-2 text-[11px] text-stone-600">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>100% Authentic Vet Pharmacy &amp; Diet</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-[#F97316]" />
                  <span>Same-Day Local Dispatch from Uppal Store</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
