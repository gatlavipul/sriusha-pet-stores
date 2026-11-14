import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import { useUser as useClerkUser } from "@clerk/clerk-react";
import useCart from "@/utils/useCart";
import { authFetch } from "@/utils/apiClient";
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
  Home,
  Briefcase,
  Building2,
  Plus,
  RotateCcw,
  Pencil,
} from "lucide-react";

const CHECKOUT_STEPS = [
  { id: 1, label: "Address", icon: MapPin },
  { id: 2, label: "Delivery Time", icon: Clock },
  { id: 3, label: "Payment (COD)", icon: Banknote },
  { id: 4, label: "Review", icon: CheckCircle2 },
];

export default function CheckoutPage() {
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useClerkUser();
  const { items, subtotal, clearCart } = useCart();

  const [currentStep, setCurrentStep] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Saved Addresses State (Amazon-style)
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isEnteringNewAddress, setIsEnteringNewAddress] = useState(false);
  const [saveAddressForNextTime, setSaveAddressForNextTime] = useState(true);

  // New Address Form State
  const [newAddressForm, setNewAddressForm] = useState({
    name: "",
    email: "",
    phone: "",
    house_no: "",
    street_area: "",
    landmark: "",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500039",
    label: "Home",
  });

  // Delivery Serviceability State (single source of truth from DB)
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

  // Checkout Options
  const [checkoutOptions, setCheckoutOptions] = useState({
    deliverySlot: "express",
    gentleDelivery: false,
    deliveryInstructions: "",
    paymentMethod: "cod", // Strictly COD
  });

  // Offer Code
  const [offerCode, setOfferCode] = useState("");
  const [offerDiscount, setOfferDiscount] = useState(0);
  const [offerFeedback, setOfferFeedback] = useState(null);

  // Fetch Saved Addresses
  const fetchSavedAddresses = useCallback(async () => {
    try {
      setLoadingAddresses(true);
      const res = await authFetch("/api/addresses");
      if (res.ok) {
        const data = await res.json();
        const list = data.addresses || [];
        setSavedAddresses(list);

        if (list.length > 0) {
          const defaultAddr = list.find((a) => a.is_default) || list[0];
          setSelectedAddressId(defaultAddr.id);
          setIsEnteringNewAddress(false);
        } else {
          setIsEnteringNewAddress(true);
        }
      } else {
        setIsEnteringNewAddress(true);
      }
    } catch (err) {
      console.warn("[Checkout] Failed to load addresses:", err);
      setIsEnteringNewAddress(true);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    if (clerkLoaded && isSignedIn) {
      fetchSavedAddresses();
    } else if (clerkLoaded && !isSignedIn) {
      setIsEnteringNewAddress(true);
      setLoadingAddresses(false);
    }
  }, [clerkLoaded, isSignedIn, fetchSavedAddresses]);

  // Pre-populate user contact in form if available
  useEffect(() => {
    if (clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress || "";
      const name = clerkUser.fullName || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
      const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber?.replace(/\D/g, "").slice(-10) || "";

      setNewAddressForm((prev) => ({
        ...prev,
        name: prev.name || name || "",
        email: prev.email || email || "",
        phone: prev.phone || phone || "",
      }));
    }
  }, [clerkUser]);

  // Active address resolution
  const activeAddress = selectedAddressId
    ? savedAddresses.find((a) => a.id === selectedAddressId)
    : null;

  const currentPincode = isEnteringNewAddress
    ? newAddressForm.pincode
    : activeAddress?.pincode || "500039";

  // Verify delivery serviceability on pincode or subtotal change from server DB
  useEffect(() => {
    const cleanPin = (currentPincode || "").trim().replace(/\D/g, "");
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
            freeDeliveryThreshold:
              typeof d.freeDeliveryThreshold === "number" ? d.freeDeliveryThreshold : 300,
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
  }, [currentPincode, subtotal]);

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
      const res = await authFetch("/api/offers/validate", {
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

  // Step 1: Address Validation & Navigation
  const handleNextFromAddress = () => {
    setError(null);

    if (!isEnteringNewAddress) {
      if (!selectedAddressId || !activeAddress) {
        setError("Please select a delivery address to proceed.");
        return;
      }
    } else {
      const cleanPhone = (newAddressForm.phone || "").trim().replace(/\D/g, "");
      const cleanPin = (newAddressForm.pincode || "").trim().replace(/\D/g, "");

      if (!newAddressForm.name.trim() || newAddressForm.name.trim().length < 2) {
        setError("Please enter the recipient's full name.");
        return;
      }
      if (!newAddressForm.email.trim() || !newAddressForm.email.includes("@")) {
        setError("Please enter a valid email address for your order receipt.");
        return;
      }
      if (cleanPhone.length !== 10) {
        setError("Please enter a valid 10-digit mobile number.");
        return;
      }
      if (!newAddressForm.house_no.trim()) {
        setError("House / Flat / Building number is required.");
        return;
      }
      if (!newAddressForm.street_area.trim()) {
        setError("Street / Area / Colony is required.");
        return;
      }
      if (cleanPin.length !== 6) {
        setError("Please enter a valid 6-digit Hyderabad pincode.");
        return;
      }
    }

    if (serviceability.checked && !serviceability.serviceable) {
      setError(
        serviceability.message || "Doorstep delivery is currently not available for this pincode."
      );
      return;
    }

    setCurrentStep(2);
  };

  // Step Navigation
  const handleNextFromDeliveryTime = () => {
    setError(null);
    setCurrentStep(3);
  };

  const handleNextFromPayment = () => {
    setError(null);
    setCurrentStep(4);
  };

  // Final Order Submission
  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      setError("Your cart is empty. Please add items before checking out.");
      return;
    }

    // Block placing order if no address is selected or entered
    if (!isEnteringNewAddress && (!selectedAddressId || !activeAddress)) {
      setError("Please select a delivery address before placing your order.");
      setCurrentStep(1);
      return;
    }

    if (serviceability.checked && !serviceability.serviceable) {
      setError(
        serviceability.message || "Doorstep delivery is currently not available for this pincode."
      );
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // 1. Resolve Snapshot Address values
      let customerName = "";
      let customerPhone = "";
      let customerEmail = "";
      let shippingAddress = "";
      let shippingCity = "Hyderabad";
      let shippingPincode = "";

      if (!isEnteringNewAddress && activeAddress) {
        customerName = activeAddress.name;
        customerPhone = activeAddress.phone;
        customerEmail = clerkUser?.primaryEmailAddress?.emailAddress || newAddressForm.email;
        shippingAddress = [
          activeAddress.house_no,
          activeAddress.street_area,
          activeAddress.landmark ? `Near ${activeAddress.landmark}` : null,
        ]
          .filter(Boolean)
          .join(", ") || activeAddress.address_line;
        shippingCity = activeAddress.city || "Hyderabad";
        shippingPincode = activeAddress.pincode;
      } else {
        customerName = newAddressForm.name.trim();
        customerPhone = newAddressForm.phone.trim().replace(/\D/g, "");
        customerEmail = newAddressForm.email.trim();
        shippingAddress = [
          newAddressForm.house_no.trim(),
          newAddressForm.street_area.trim(),
          newAddressForm.landmark.trim() ? `Near ${newAddressForm.landmark.trim()}` : null,
        ]
          .filter(Boolean)
          .join(", ");
        shippingCity = newAddressForm.city || "Hyderabad";
        shippingPincode = newAddressForm.pincode.trim().replace(/\D/g, "");

        // If user requested to save address for next time, persist it now
        if (saveAddressForNextTime && isSignedIn) {
          try {
            await authFetch("/api/addresses", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: customerName,
                phone: customerPhone,
                house_no: newAddressForm.house_no.trim(),
                street_area: newAddressForm.street_area.trim(),
                landmark: newAddressForm.landmark.trim() || null,
                city: shippingCity,
                state: "Telangana",
                pincode: shippingPincode,
                label: newAddressForm.label || "Home",
                is_default: savedAddresses.length === 0,
              }),
            });
          } catch (addrErr) {
            console.warn("[Checkout] Failed to save address for next time:", addrErr);
          }
        }
      }

      // 2. Build Atomic Order Payload with Address Snapshot
      const orderDataPayload = {
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        shipping_address: shippingAddress,
        shipping_city: shippingCity,
        shipping_pincode: shippingPincode,
        payment_method: "cod",
        delivery_slot: checkoutOptions.deliverySlot,
        gentle_delivery: checkoutOptions.gentleDelivery,
        delivery_instructions: checkoutOptions.deliveryInstructions.trim() || null,
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

      const orderRes = await authFetch("/api/orders", {
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
      console.error("[Checkout] Order placement error:", err);
      setError(err.message || "An unexpected error occurred while placing your order.");
      setProcessing(false);
    }
  };

  if (items.length === 0) {
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
            className="inline-flex items-center justify-center rounded-2xl bg-[#4A0A0F] px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#360509] min-h-[44px]"
          >
            Browse Essentials
          </a>
        </div>
      </div>
    );
  }

  // Selected address label / display helper
  const selectedAddressDisplay = isEnteringNewAddress
    ? {
        name: newAddressForm.name,
        phone: newAddressForm.phone,
        address: [newAddressForm.house_no, newAddressForm.street_area, newAddressForm.landmark]
          .filter(Boolean)
          .join(", "),
        city: newAddressForm.city,
        pincode: newAddressForm.pincode,
        label: newAddressForm.label,
      }
    : activeAddress
    ? {
        name: activeAddress.name,
        phone: activeAddress.phone,
        address: activeAddress.house_no
          ? `${activeAddress.house_no}, ${activeAddress.street_area}`
          : activeAddress.address_line,
        city: activeAddress.city,
        pincode: activeAddress.pincode,
        label: activeAddress.label || "Home",
      }
    : null;

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819] pb-24 overflow-x-hidden">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="mb-6 border-b border-stone-200 pb-4">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">
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
                      className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl border-2 transition-all ${
                        isDone
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : isCurrent
                          ? "bg-[#4A0A0F] border-[#4A0A0F] text-white shadow-md ring-4 ring-[#4A0A0F]/15"
                          : "bg-white border-stone-200 text-stone-400"
                      }`}
                    >
                      {isDone ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
                    </button>
                    <span
                      className={`mt-1.5 text-[10px] sm:text-xs font-bold text-center ${
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
                      className={`h-0.5 flex-1 mx-1.5 transition-colors ${
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
          <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-xs font-bold text-red-700 flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Main Wizard Form Column (7 cols) */}
          <div className="lg:col-span-7">
            {/* STEP 1: ADDRESS SELECTION (Amazon-style) */}
            {currentStep === 1 && (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={20} className="text-[#4A0A0F]" />
                    <h2 className="text-base font-bold text-stone-900">
                      Step 1: Select Delivery Address (Hyderabad)
                    </h2>
                  </div>
                </div>

                {/* Case A: Show Saved Addresses Cards (like Amazon) */}
                {savedAddresses.length > 0 && !isEnteringNewAddress && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-stone-600">
                        Choose a delivery address from your account:
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsEnteringNewAddress(true)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#F97316] hover:underline min-h-[44px] px-2"
                      >
                        <Plus size={14} />
                        <span>Add new address</span>
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {savedAddresses.map((addr) => {
                        const isSelected = selectedAddressId === addr.id;
                        const label = addr.label || "Home";

                        return (
                          <div
                            key={addr.id}
                            onClick={() => setSelectedAddressId(addr.id)}
                            className={`rounded-2xl border p-4 cursor-pointer flex flex-col justify-between transition-all ${
                              isSelected
                                ? "border-[#4A0A0F] bg-[#FFF7ED]/70 ring-2 ring-[#4A0A0F]/20 shadow-xs"
                                : "border-stone-200 bg-white hover:border-stone-300"
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-2">
                                <span className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-0.5 text-[10px] font-black uppercase text-stone-700">
                                  {label === "Home" ? (
                                    <Home size={11} />
                                  ) : label === "Work" ? (
                                    <Briefcase size={11} />
                                  ) : (
                                    <Building2 size={11} />
                                  )}
                                  <span>{label}</span>
                                </span>

                                <div className="flex items-center gap-1.5">
                                  {addr.is_default && (
                                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-800">
                                      Default
                                    </span>
                                  )}
                                  <input
                                    type="radio"
                                    name="selected_address"
                                    checked={isSelected}
                                    onChange={() => setSelectedAddressId(addr.id)}
                                    className="accent-[#4A0A0F] h-4 w-4"
                                  />
                                </div>
                              </div>

                              <h4 className="text-xs font-black text-stone-900">
                                {addr.name}
                              </h4>
                              <p className="text-[11px] text-stone-600 mt-0.5 line-clamp-2 leading-relaxed">
                                {addr.house_no ? `${addr.house_no}, ` : ""}
                                {addr.street_area || addr.address_line}
                              </p>
                              {addr.landmark && (
                                <p className="text-[10px] text-stone-500 italic mt-0.5">
                                  Near {addr.landmark}
                                </p>
                              )}
                              <p className="text-[11px] font-bold text-stone-800 mt-1">
                                Hyderabad - {addr.pincode}
                              </p>
                              <p className="text-[11px] text-stone-500 mt-1">
                                Phone: {addr.phone}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Case B: Add New Address Form (or if user has no saved addresses) */}
                {isEnteringNewAddress && (
                  <div className="space-y-4">
                    {savedAddresses.length > 0 && (
                      <div className="flex justify-between items-center pb-2 border-b border-stone-100">
                        <button
                          type="button"
                          onClick={() => setIsEnteringNewAddress(false)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 min-h-[44px]"
                        >
                          <ArrowLeft size={14} />
                          <span>Use a saved address instead</span>
                        </button>
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Ramesh Kumar"
                          value={newAddressForm.name}
                          onChange={(e) =>
                            setNewAddressForm({ ...newAddressForm, name: e.target.value })
                          }
                          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          Email (for order invoice) *
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="you@example.com"
                          value={newAddressForm.email}
                          onChange={(e) =>
                            setNewAddressForm({ ...newAddressForm, email: e.target.value })
                          }
                          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          10-digit Mobile Number *
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          required
                          placeholder="9876543210"
                          value={newAddressForm.phone}
                          onChange={(e) =>
                            setNewAddressForm({
                              ...newAddressForm,
                              phone: e.target.value.replace(/\D/g, ""),
                            })
                          }
                          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          Address Type
                        </label>
                        <div className="flex gap-2">
                          {["Home", "Work", "Other"].map((lbl) => (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => setNewAddressForm({ ...newAddressForm, label: lbl })}
                              className={`flex-1 rounded-xl py-2 text-xs font-bold border min-h-[44px] transition-colors ${
                                newAddressForm.label === lbl
                                  ? "bg-[#FFF7ED] border-[#4A0A0F] text-[#4A0A0F] ring-1 ring-[#4A0A0F]"
                                  : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"
                              }`}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Flat, House no., Building, Apartment *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Flat 302, Green Meadows"
                        value={newAddressForm.house_no}
                        onChange={(e) =>
                          setNewAddressForm({ ...newAddressForm, house_no: e.target.value })
                        }
                        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Area, Street, Sector, Colony *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Raghavendra Nagar, Uppal"
                        value={newAddressForm.street_area}
                        onChange={(e) =>
                          setNewAddressForm({ ...newAddressForm, street_area: e.target.value })
                        }
                        className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          Landmark (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Near Metro Pillar 84"
                          value={newAddressForm.landmark}
                          onChange={(e) =>
                            setNewAddressForm({ ...newAddressForm, landmark: e.target.value })
                          }
                          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          City
                        </label>
                        <input
                          type="text"
                          disabled
                          value="Hyderabad"
                          className="w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                          Pincode *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          placeholder="500039"
                          value={newAddressForm.pincode}
                          onChange={(e) =>
                            setNewAddressForm({
                              ...newAddressForm,
                              pincode: e.target.value.replace(/\D/g, ""),
                            })
                          }
                          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-mono outline-none focus:border-[#F97316]"
                        />
                      </div>
                    </div>

                    {/* "Save this address for next time" Checkbox */}
                    <div className="pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveAddressForNextTime}
                          onChange={(e) => setSaveAddressForNextTime(e.target.checked)}
                          className="h-4 w-4 rounded accent-[#4A0A0F]"
                        />
                        <span className="text-xs font-bold text-stone-800">
                          Save this address for next time
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Serviceability Badge */}
                {checkingPincode ? (
                  <div className="text-[11px] text-stone-500 font-medium">
                    Checking serviceability zone in Uppal database...
                  </div>
                ) : serviceability.checked ? (
                  serviceability.serviceable ? (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        <span>Serviceable: {serviceability.areaName || "Hyderabad"}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700">
                        {isFreeDelivery
                          ? "FREE Delivery Unlocked!"
                          : `Delivery Fee: ₹${deliveryCharge} (Free above ₹${serviceability.freeDeliveryThreshold})`}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700 font-bold flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{serviceability.message || "Pincode is currently outside our delivery zone."}</span>
                    </div>
                  )
                ) : null}

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextFromAddress}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#4A0A0F] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#360509] transition-all min-h-[44px]"
                  >
                    <span>Proceed to Delivery Time</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: DELIVERY TIME */}
            {currentStep === 2 && (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <Clock size={20} className="text-[#4A0A0F]" />
                  <h2 className="text-base font-bold text-stone-900">
                    Step 2: Choose Delivery Time &amp; Preferences
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-2">
                      Delivery Window for {serviceability.areaName || "Hyderabad"}:
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label
                        className={`rounded-2xl border p-4 cursor-pointer flex flex-col justify-between transition-all ${
                          checkoutOptions.deliverySlot === "express"
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
                            checked={checkoutOptions.deliverySlot === "express"}
                            onChange={() =>
                              setCheckoutOptions({ ...checkoutOptions, deliverySlot: "express" })
                            }
                            className="accent-[#4A0A0F]"
                          />
                        </div>
                        <p className="text-[11px] text-stone-500">
                          {serviceability.estimatedDeliveryTime || "Same-day in 2-4 hours"} direct from Uppal Store.
                        </p>
                      </label>

                      <label
                        className={`rounded-2xl border p-4 cursor-pointer flex flex-col justify-between transition-all ${
                          checkoutOptions.deliverySlot === "scheduled"
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
                            checked={checkoutOptions.deliverySlot === "scheduled"}
                            onChange={() =>
                              setCheckoutOptions({ ...checkoutOptions, deliverySlot: "scheduled" })
                            }
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
                        checked={checkoutOptions.gentleDelivery}
                        onChange={(e) =>
                          setCheckoutOptions({
                            ...checkoutOptions,
                            gentleDelivery: e.target.checked,
                          })
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
                      placeholder="e.g. Leave with security / Near Metro"
                      value={checkoutOptions.deliveryInstructions}
                      onChange={(e) =>
                        setCheckoutOptions({
                          ...checkoutOptions,
                          deliveryInstructions: e.target.value,
                        })
                      }
                      className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 min-h-[44px]"
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Address</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromDeliveryTime}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#4A0A0F] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#360509] transition-all min-h-[44px]"
                  >
                    <span>Proceed to Payment</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PAYMENT METHOD (COD) */}
            {currentStep === 3 && (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <Banknote size={20} className="text-[#4A0A0F]" />
                  <h2 className="text-base font-bold text-stone-900">
                    Step 3: Payment Method (Cash on Delivery)
                  </h2>
                </div>

                <div className="space-y-3">
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
                          Razorpay gateway integration in testing.
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
                    className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 min-h-[44px]"
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Delivery Time</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromPayment}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#4A0A0F] px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#360509] transition-all min-h-[44px]"
                  >
                    <span>Proceed to Review</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRM */}
            {currentStep === 4 && (
              <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
                <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                  <CheckCircle2 size={20} className="text-[#4A0A0F]" />
                  <h2 className="text-base font-bold text-stone-900">
                    Step 4: Final Order Review
                  </h2>
                </div>

                {/* Selected Address Display Card with "Change" button */}
                <div className="rounded-2xl bg-stone-50 p-4 border border-stone-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                      <MapPin size={14} className="text-[#4A0A0F]" />
                      <span>Delivery Address</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#F97316] hover:underline min-h-[36px] px-2"
                    >
                      <Pencil size={12} />
                      <span>Change</span>
                    </button>
                  </div>

                  {selectedAddressDisplay && (
                    <div className="text-xs space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-stone-900">
                          {selectedAddressDisplay.name}
                        </span>
                        {selectedAddressDisplay.label && (
                          <span className="rounded bg-stone-200 px-1.5 py-0.2 text-[10px] font-bold text-stone-700">
                            {selectedAddressDisplay.label}
                          </span>
                        )}
                      </div>
                      <p className="text-stone-700 font-medium">
                        {selectedAddressDisplay.address}
                      </p>
                      <p className="text-stone-600">
                        {selectedAddressDisplay.city || "Hyderabad"} -{" "}
                        <span className="font-mono font-bold">
                          {selectedAddressDisplay.pincode}
                        </span>
                      </p>
                      <p className="text-stone-600 font-medium pt-1">
                        Phone: {selectedAddressDisplay.phone}
                      </p>
                    </div>
                  )}
                </div>

                {/* Timing & Payment Details */}
                <div className="rounded-2xl bg-stone-50 p-4 border border-stone-200 text-xs space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 block mb-1">
                    Timing &amp; Payment
                  </span>
                  <p className="text-stone-800 font-semibold">
                    {checkoutOptions.deliverySlot === "express"
                      ? "Express Delivery (Same-day in 2-4 hours)"
                      : "Evening Delivery (6:00 PM - 9:00 PM)"}
                  </p>
                  <p className="text-stone-600">
                    Payment Method: <span className="font-bold text-[#4A0A0F]">Cash on Delivery</span>
                  </p>
                  {checkoutOptions.gentleDelivery && (
                    <p className="text-amber-800 font-semibold">
                      • Gentle Delivery Active (calls rider before ringing doorbell)
                    </p>
                  )}
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
                    className="inline-flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 min-h-[44px]"
                  >
                    <ArrowLeft size={15} />
                    <span>Back to Payment</span>
                  </button>

                  <button
                    type="button"
                    disabled={processing}
                    onClick={handlePlaceOrder}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#4A0A0F] px-8 py-3.5 text-sm font-black text-white shadow-md hover:bg-[#360509] transition-all disabled:opacity-50 min-h-[44px]"
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
            <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs space-y-5 lg:sticky lg:top-24">
              <h3 className="text-base font-bold text-stone-900">
                Order Total ({items.length} items)
              </h3>

              {/* Delivery Address Summary with "Change" button */}
              {selectedAddressDisplay && (
                <div className="rounded-2xl bg-[#FFFDF9] border border-amber-200/70 p-3.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-700 flex items-center gap-1">
                      <MapPin size={12} className="text-[#4A0A0F]" />
                      <span>Deliver to:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="text-[11px] font-bold text-[#F97316] hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <p className="font-black text-stone-900">
                    {selectedAddressDisplay.name}
                  </p>
                  <p className="text-stone-600 line-clamp-1">
                    {selectedAddressDisplay.address}
                  </p>
                  <p className="text-stone-500 text-[11px]">
                    {selectedAddressDisplay.city || "Hyderabad"} - {selectedAddressDisplay.pincode}
                  </p>
                </div>
              )}

              {/* Price Calculation */}
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
                      className="w-full rounded-2xl border border-stone-300 py-2.5 pl-8 pr-2 text-xs uppercase outline-none focus:border-[#F97316]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleValidateOffer}
                    className="rounded-2xl bg-[#241819] px-4 py-2 text-xs font-bold text-white hover:bg-black min-h-[44px]"
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
