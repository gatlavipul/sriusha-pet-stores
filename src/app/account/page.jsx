import { useState, useEffect, useCallback, useRef } from "react";
import Header from "@/components/Header";
import { useUser as useClerkUser, useClerk } from "@clerk/clerk-react";
import useCart from "@/utils/useCart";
import { useWishlist } from "@/utils/useWishlist";
import { authFetch } from "@/utils/apiClient";
import PetOnboardingFlow, { getPetEmoji } from "@/components/PetOnboardingFlow";
import {
  User,
  Package,
  MapPin,
  Heart,
  LogOut,
  Shield,
  Truck,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  PawPrint,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  Sparkles,
  Gift,
  RotateCcw,
  Home,
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  Phone,
  Mail,
  X,
} from "lucide-react";

const STATUS_BADGE = {
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  out_for_delivery: "bg-orange-50 text-[#EA580C] border-orange-200",
  delivery_failed: "bg-rose-50 text-rose-700 border-rose-200",
  ready_for_delivery: "bg-amber-50 text-amber-800 border-amber-200",
  assigned: "bg-[#FFF7ED] text-[#F97316] border-[#FED7AA]",
  packing: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-[#FEFCE8] text-[#D97706] border-[#FEF08A]",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

// Skeleton Placeholder for Account Screen
function AccountSkeleton() {
  return (
    <div className="min-h-screen bg-[#FFFDF9] pb-24">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-5 animate-pulse">
        {/* Profile Card Skeleton */}
        <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-stone-200 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 rounded-lg bg-stone-200" />
            <div className="h-3.5 w-52 rounded-lg bg-stone-100" />
            <div className="h-3.5 w-32 rounded-lg bg-stone-100" />
          </div>
        </div>

        {/* Tab Buttons Skeleton */}
        <div className="flex gap-2 overflow-x-hidden pb-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 w-28 rounded-2xl bg-stone-200 shrink-0" />
          ))}
        </div>

        {/* Content Skeleton Cards */}
        <div className="space-y-3">
          <div className="h-28 rounded-3xl bg-white border border-stone-200 p-4" />
          <div className="h-28 rounded-3xl bg-white border border-stone-200 p-4" />
        </div>
      </main>
    </div>
  );
}

export default function CustomerAccountPage() {
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useClerkUser();
  const { signOut } = useClerk();
  const { addToCart } = useCart();
  const { toggleWishlist } = useWishlist();

  // Primary Data States
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [pets, setPets] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);

  // Loading, Timeout & Error States
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const timeoutRef = useRef(null);

  // Active Tab: orders | addresses | pets | wishlist
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (["orders", "addresses", "pets", "wishlist"].includes(tab)) {
        return tab;
      }
    }
    return "orders";
  });

  // Toast Feedback State
  const [toast, setToast] = useState(null);
  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Profile Edit Modal State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Address Modal State (Add / Edit)
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    name: "",
    phone: "",
    house_no: "",
    street_area: "",
    landmark: "",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "",
    label: "Home",
    is_default: false,
  });

  // Pet Modal State
  const [showPetModal, setShowPetModal] = useState(false);
  const [editingPet, setEditingPet] = useState(null);
  const [savingPet, setSavingPet] = useState(false);
  const [petForm, setPetForm] = useState({
    name: "",
    type: "dog",
    breed: "",
    age: "",
    food_preference: "",
  });

  // Guard: Redirect signed-out visitors to signin
  useEffect(() => {
    if (clerkLoaded && !isSignedIn) {
      if (typeof window !== "undefined") {
        window.location.href = "/account/signin?callbackUrl=/account";
      }
    }
  }, [clerkLoaded, isSignedIn]);

  // Main Data Fetcher
  const fetchAllAccountData = useCallback(async () => {
    setLoadingData(true);
    setLoadError(null);

    // 10-second timeout guarantee
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoadError("Account details took longer than 10 seconds to load.");
      setLoadingData(false);
      console.error("[Account] Request timed out after 10s");
    }, 10000);

    try {
      // 1. Fetch Profile
      const meRes = await authFetch("/api/account/me", { timeout: 9000 });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData?.user) {
          setProfile(meData.user);
          setEditName(meData.user.name || "");
          setEditPhone(meData.user.phone || "");
        }
      }

      // 2. Fetch Addresses
      const addrRes = await authFetch("/api/addresses", { timeout: 9000 });
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        setAddresses(addrData.addresses || []);
      }

      // 3. Fetch Orders
      const ordRes = await authFetch("/api/orders", { timeout: 9000 });
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(ordData.orders || []);
      }

      // 4. Fetch Pets
      const petsRes = await authFetch("/api/pets", { timeout: 9000 });
      if (petsRes.ok) {
        const petsData = await petsRes.json();
        setPets(petsData.pets || []);
      }

      // 5. Fetch Wishlist
      const wishRes = await authFetch("/api/wishlist", { timeout: 9000 });
      if (wishRes.ok) {
        const wishData = await wishRes.json();
        setWishlistItems(wishData.items || []);
      }

      clearTimeout(timeoutRef.current);
      setLoadingData(false);
    } catch (err) {
      clearTimeout(timeoutRef.current);
      console.error("[Account] Error fetching account data:", err);
      setLoadError(err.message || "Unable to connect to Sri Usha store servers.");
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (clerkLoaded && isSignedIn) {
      fetchAllAccountData();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [clerkLoaded, isSignedIn, fetchAllAccountData]);

  // Handle Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim() || editName.trim().length < 2) {
      notify("Please enter a valid full name (at least 2 letters).", "error");
      return;
    }
    const cleanPhone = editPhone.trim().replace(/\D/g, "");
    if (cleanPhone && cleanPhone.length !== 10) {
      notify("Please enter a valid 10-digit mobile number.", "error");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await authFetch("/api/account/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          phone: cleanPhone || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      setProfile(data.user);
      setShowEditProfileModal(false);
      notify("Profile details updated successfully.");
    } catch (err) {
      console.error("[Account] Profile update error:", err);
      notify(err.message || "Failed to update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // Open Add Address Modal
  const openAddAddressModal = () => {
    setEditingAddressId(null);
    setAddressForm({
      name: profile?.name || clerkUser?.fullName || "",
      phone: profile?.phone || "",
      house_no: "",
      street_area: "",
      landmark: "",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500039",
      label: "Home",
      is_default: addresses.length === 0,
    });
    setShowAddressModal(true);
  };

  // Open Edit Address Modal
  const openEditAddressModal = (addr) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      name: addr.name || "",
      phone: addr.phone || "",
      house_no: addr.house_no || "",
      street_area: addr.street_area || "",
      landmark: addr.landmark || "",
      city: addr.city || "Hyderabad",
      state: addr.state || "Telangana",
      pincode: addr.pincode || "",
      label: addr.label || "Home",
      is_default: Boolean(addr.is_default),
    });
    setShowAddressModal(true);
  };

  // Save Address (Create or Update)
  const handleSaveAddress = async (e) => {
    e.preventDefault();
    const cleanPhone = (addressForm.phone || "").trim().replace(/\D/g, "");
    const cleanPin = (addressForm.pincode || "").trim().replace(/\D/g, "");

    if (!addressForm.name.trim() || addressForm.name.trim().length < 2) {
      notify("Please enter recipient's full name.", "error");
      return;
    }
    if (cleanPhone.length !== 10) {
      notify("Please enter a valid 10-digit mobile number.", "error");
      return;
    }
    if (!addressForm.house_no.trim()) {
      notify("Flat / House / Building number is required.", "error");
      return;
    }
    if (!addressForm.street_area.trim()) {
      notify("Street / Area / Colony is required.", "error");
      return;
    }
    if (cleanPin.length !== 6) {
      notify("Please enter a valid 6-digit Hyderabad pincode.", "error");
      return;
    }

    setSavingAddress(true);
    try {
      const isEditing = Boolean(editingAddressId);
      const url = isEditing
        ? `/api/addresses/${editingAddressId}`
        : "/api/addresses";
      const method = isEditing ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addressForm,
          phone: cleanPhone,
          pincode: cleanPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save address");

      setShowAddressModal(false);
      // Refresh addresses list
      const addrRes = await authFetch("/api/addresses");
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        setAddresses(addrData.addresses || []);
      }
      notify(isEditing ? "Delivery address updated." : "New address saved successfully.");
    } catch (err) {
      console.error("[Account] Save address error:", err);
      notify(err.message || "Failed to save address", "error");
    } finally {
      setSavingAddress(false);
    }
  };

  // Set Address as Default
  const handleSetDefaultAddress = async (id) => {
    try {
      const res = await authFetch(`/api/addresses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set_default: true }),
      });
      if (!res.ok) throw new Error("Failed to set default address");
      setAddresses((prev) =>
        prev.map((a) => ({
          ...a,
          is_default: a.id === id,
        }))
      );
      notify("Default address updated.");
    } catch (err) {
      console.error("[Account] Set default error:", err);
      notify(err.message || "Failed to set default address", "error");
    }
  };

  // Delete Address
  const handleDeleteAddress = async (id) => {
    if (!confirm("Are you sure you want to remove this delivery address?")) return;
    try {
      const res = await authFetch(`/api/addresses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove address");
      // Refresh addresses list
      const addrRes = await authFetch("/api/addresses");
      if (addrRes.ok) {
        const addrData = await addrRes.json();
        setAddresses(addrData.addresses || []);
      }
      notify("Address removed.");
    } catch (err) {
      console.error("[Account] Delete address error:", err);
      notify(err.message || "Failed to remove address", "error");
    }
  };

  // Reorder Cart Handler
  const handleReorder = async (order) => {
    if (!order?.items || order.items.length === 0) return;
    for (const item of order.items) {
      await addToCart(
        {
          id: item.product_id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          variant_name: item.variant_name || null,
          name: item.product_name || item.name,
          price: Number(item.unit_price || item.price || 0),
          image_url: item.image_url,
          stock_quantity: 99,
        },
        Number(item.quantity || 1)
      );
    }
    window.location.href = "/cart";
  };

  // Sign Out Handler
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn("[Account] Clerk signOut:", e);
    }
    window.location.href = "/account/signin";
  };

  // 1. Initial Clerk loading state -> skeleton
  if (!clerkLoaded) {
    return <AccountSkeleton />;
  }

  // 2. Timeout or hard error -> "Couldn't load, tap to retry"
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FFFDF9]">
        <Header />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="rounded-3xl border border-red-200 bg-white p-7 shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-lg font-black text-[#4A0A0F]">
              Couldn&apos;t load account
            </h2>
            <p className="mt-2 text-xs text-stone-500 leading-relaxed">
              {loadError}
            </p>
            <button
              type="button"
              onClick={fetchAllAccountData}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4A0A0F] px-6 py-3.5 text-xs font-bold text-white shadow-md hover:bg-[#360509] min-h-[44px] transition-transform active:scale-98"
            >
              <RotateCcw size={16} />
              <span>Tap to retry</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 3. Loading DB data -> Skeleton
  if (loadingData) {
    return <AccountSkeleton />;
  }

  // Resolved user metadata
  const displayName = profile?.name || clerkUser?.fullName || clerkUser?.firstName || "Customer";
  const displayEmail = profile?.email || clerkUser?.primaryEmailAddress?.emailAddress || "";
  const displayPhone = profile?.phone || "";
  const userAvatar = profile?.image || clerkUser?.imageUrl || null;
  const userRole = profile?.role || "customer";

  const menuRows = [
    { id: "orders", label: "My Orders", icon: Package, count: orders.length },
    { id: "addresses", label: "Saved Addresses", icon: MapPin, count: addresses.length },
    { id: "pets", label: "My Pets", icon: PawPrint, count: pets.length },
    { id: "wishlist", label: "Wishlist", icon: Heart, count: wishlistItems.length },
  ];

  return (
    <div className="min-h-screen bg-[#FFFDF9] pb-24 overflow-x-hidden">
      <Header />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-6">
        {/* Toast Feedback */}
        {toast && (
          <div
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-50 rounded-2xl px-5 py-3 text-xs font-bold shadow-xl border flex items-center gap-2 animate-in fade-in duration-200 ${
              toast.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            <span>{toast.msg}</span>
          </div>
        )}

        {/* 1. Profile Card with Avatar, Name, Email, Editable Phone */}
        <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt={displayName}
                  className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover border-2 border-[#FED7AA] shadow-sm shrink-0"
                />
              ) : (
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-[#4A0A0F] text-2xl font-black text-white shadow-sm shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-stone-900 truncate">
                    {displayName}
                  </h1>
                  {userRole === "admin" && (
                    <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 uppercase tracking-wide">
                      Admin
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-500 mt-0.5 truncate flex items-center gap-1.5">
                  <Mail size={12} className="text-stone-400 shrink-0" />
                  <span>{displayEmail}</span>
                </p>

                <div className="mt-1 flex items-center gap-2 text-xs">
                  <Phone size={12} className="text-stone-400 shrink-0" />
                  {displayPhone ? (
                    <span className="font-semibold text-stone-700">
                      +91 {displayPhone}
                    </span>
                  ) : (
                    <span className="text-stone-400 italic">No phone added</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:self-center">
              <button
                type="button"
                onClick={() => {
                  setEditName(profile?.name || displayName);
                  setEditPhone(profile?.phone || "");
                  setShowEditProfileModal(true);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100 min-h-[44px] transition-colors"
              >
                <Pencil size={14} />
                <span>Edit Profile</span>
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 min-h-[44px] transition-colors"
                aria-label="Sign out"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </section>

        {/* 2. Menu Navigation Tabs (Mobile-Friendly Pill Bar) */}
        <nav aria-label="Account Tabs" className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {menuRows.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-extrabold whitespace-nowrap min-h-[44px] transition-all shrink-0 ${
                  isActive
                    ? "bg-[#4A0A0F] text-white shadow-sm ring-2 ring-[#4A0A0F]/20"
                    : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-stone-100 text-stone-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* 3. TAB CONTENT: SAVED ADDRESSES (Amazon-style) */}
        {activeTab === "addresses" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-stone-900">
                  Saved Addresses
                </h2>
                <p className="text-xs text-stone-500">
                  Manage delivery locations for quick 1-click checkout
                </p>
              </div>

              <button
                type="button"
                onClick={openAddAddressModal}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[#4A0A0F] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#360509] min-h-[44px] transition-transform active:scale-95"
              >
                <Plus size={16} />
                <span>Add Address</span>
              </button>
            </div>

            {/* Address Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Empty state: Amazon dashed card */}
              {addresses.length === 0 && (
                <button
                  type="button"
                  onClick={openAddAddressModal}
                  className="sm:col-span-2 rounded-3xl border-2 border-dashed border-stone-300 bg-white/60 p-8 text-center hover:border-[#F97316] hover:bg-[#FFF7ED]/30 transition-all min-h-[160px] flex flex-col items-center justify-center gap-2"
                >
                  <div className="h-12 w-12 rounded-2xl bg-amber-50 border border-amber-200 text-[#F97316] flex items-center justify-center">
                    <Plus size={24} />
                  </div>
                  <span className="text-sm font-bold text-stone-900">
                    Add your first delivery address
                  </span>
                  <span className="text-xs text-stone-500">
                    Save your Hyderabad home or office for fast same-day delivery
                  </span>
                </button>
              )}

              {addresses.map((addr) => {
                const isDefault = Boolean(addr.is_default);
                const label = addr.label || "Home";

                return (
                  <div
                    key={addr.id}
                    className={`rounded-3xl border bg-white p-5 shadow-xs flex flex-col justify-between transition-all ${
                      isDefault
                        ? "border-[#4A0A0F] ring-2 ring-[#4A0A0F]/15"
                        : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-xl bg-stone-100 px-2.5 py-1 text-[11px] font-black uppercase text-stone-700">
                            {label === "Home" ? (
                              <Home size={12} />
                            ) : label === "Work" ? (
                              <Briefcase size={12} />
                            ) : (
                              <Building2 size={12} />
                            )}
                            <span>{label}</span>
                          </span>

                          {isDefault && (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                              <Check size={11} strokeWidth={3} />
                              <span>Default</span>
                            </span>
                          )}
                        </div>

                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultAddress(addr.id)}
                            className="text-[11px] font-bold text-[#F97316] hover:underline min-h-[32px] px-2 flex items-center"
                          >
                            Set as default
                          </button>
                        )}
                      </div>

                      {/* Recipient Details */}
                      <h3 className="text-sm font-black text-stone-900">
                        {addr.name}
                      </h3>
                      <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                        {addr.house_no ? `${addr.house_no}, ` : ""}
                        {addr.street_area || addr.address_line}
                      </p>
                      {addr.landmark && (
                        <p className="text-xs text-stone-500 mt-0.5 italic">
                          Landmark: Near {addr.landmark}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-stone-700 mt-1">
                        {addr.city || "Hyderabad"}, {addr.state || "Telangana"} -{" "}
                        <span className="font-mono font-bold">{addr.pincode}</span>
                      </p>
                      <p className="text-xs text-stone-600 mt-2 font-medium flex items-center gap-1">
                        <Phone size={12} className="text-stone-400" />
                        <span>Phone: {addr.phone}</span>
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditAddressModal(addr)}
                        className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-100 min-h-[44px]"
                      >
                        <Pencil size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 min-h-[44px]"
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. TAB CONTENT: MY ORDERS */}
        {activeTab === "orders" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-stone-900">Order History</h2>
                <p className="text-xs text-stone-500">Track and reorder veterinary supplies</p>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center space-y-3">
                <Package size={36} className="mx-auto text-stone-300" />
                <h3 className="text-sm font-bold text-stone-900">No orders placed yet</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Your order history and live delivery tracking will appear here.
                </p>
                <a
                  href="/products"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#4A0A0F] px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#360509] min-h-[44px]"
                >
                  Start Shopping
                </a>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((ord) => {
                  const statusClass =
                    STATUS_BADGE[ord.status] || "bg-stone-50 text-stone-700 border-stone-200";

                  return (
                    <div
                      key={ord.id}
                      className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-extrabold text-stone-900">
                              {ord.order_number}
                            </span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${statusClass}`}
                            >
                              {(ord.status || "confirmed").replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-400 mt-0.5">
                            Placed on {new Date(ord.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                          </p>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-stone-900">
                            ₹{Number(ord.total_amount || 0).toFixed(0)}
                          </div>
                          <span className="text-[10px] font-bold text-stone-500 uppercase">
                            COD Order
                          </span>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-2">
                        {(ord.items || []).map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5">
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name || "Product"}
                                  className="h-10 w-10 object-contain rounded-xl border border-stone-100 bg-stone-50 p-0.5"
                                />
                              )}
                              <div>
                                <span className="font-bold text-stone-800">
                                  {item.product_name || item.name}
                                </span>
                                {item.variant_name && (
                                  <span className="ml-1 text-[11px] text-stone-500">
                                    ({item.variant_name})
                                  </span>
                                )}
                                <div className="text-[11px] text-stone-400">
                                  Qty: {item.quantity} × ₹{item.unit_price || item.price}
                                </div>
                              </div>
                            </div>
                            <span className="font-bold text-stone-900">
                              ₹{(Number(item.quantity || 1) * Number(item.unit_price || item.price || 0)).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-2 flex items-center justify-between border-t border-stone-100">
                        <a
                          href={`/orders/${ord.id}`}
                          className="text-xs font-bold text-[#F97316] hover:underline flex items-center gap-1 min-h-[44px]"
                        >
                          <span>Track Order</span>
                          <ChevronRight size={14} />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleReorder(ord)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-4 py-2 text-xs font-bold text-stone-800 hover:bg-stone-200 min-h-[44px]"
                        >
                          <RotateCcw size={13} />
                          <span>Reorder All</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 5. TAB CONTENT: MY PETS */}
        {activeTab === "pets" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-stone-900">My Pets</h2>
                <p className="text-xs text-stone-500">Pet profiles &amp; personalized diets</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingPet(null);
                  setPetForm({ name: "", type: "dog", breed: "", age: "", food_preference: "" });
                  setShowPetModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[#4A0A0F] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#360509] min-h-[44px]"
              >
                <Plus size={16} />
                <span>Add Pet</span>
              </button>
            </div>

            {pets.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center space-y-3">
                <PawPrint size={36} className="mx-auto text-stone-300" />
                <h3 className="text-sm font-bold text-stone-900">No pet profiles saved</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Add your dogs, cats or birds to receive personalized food recommendations and health reminders.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {pets.map((pet) => (
                  <div
                    key={pet.id}
                    className="rounded-3xl border border-stone-200 bg-white p-5 shadow-xs flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-2xl border border-amber-200">
                        {getPetEmoji(pet.type)}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-stone-900">
                          {pet.name}
                        </h4>
                        <p className="text-xs text-stone-500 capitalize">
                          {pet.type} {pet.breed ? `• ${pet.breed}` : ""} {pet.age ? `• ${pet.age}` : ""}
                        </p>
                        {pet.preferences?.food_preference && (
                          <p className="text-[11px] text-[#F97316] font-semibold mt-0.5">
                            Diet: {pet.preferences.food_preference}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 6. TAB CONTENT: WISHLIST */}
        {activeTab === "wishlist" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-stone-900">My Wishlist</h2>
                <p className="text-xs text-stone-500">Saved essentials for upcoming orders</p>
              </div>
            </div>

            {wishlistItems.length === 0 ? (
              <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center space-y-3">
                <Heart size={36} className="mx-auto text-stone-300" />
                <h3 className="text-sm font-bold text-stone-900">Your wishlist is empty</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Tap the heart icon on any product to save it here for later.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {wishlistItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-stone-200 bg-white p-3.5 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="h-28 w-full object-contain rounded-2xl mb-2"
                      />
                      <h4 className="text-xs font-bold text-stone-900 line-clamp-2">
                        {item.name}
                      </h4>
                      <p className="text-xs font-black text-[#4A0A0F] mt-1">
                        ₹{item.price}
                      </p>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          addToCart({
                            id: item.id,
                            name: item.name,
                            price: item.price,
                            image_url: item.image_url,
                            stock_quantity: item.stock_quantity || 99,
                          })
                        }
                        className="flex-1 rounded-xl bg-[#4A0A0F] py-2 text-[11px] font-bold text-white min-h-[44px]"
                      >
                        Add to Cart
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await toggleWishlist({ id: item.id });
                          setWishlistItems((prev) => prev.filter((w) => w.id !== item.id));
                        }}
                        className="rounded-xl border border-stone-200 p-2 text-stone-500 hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Remove from wishlist"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* MODAL 1: EDIT PROFILE */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-stone-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
              <h3 className="text-base font-black text-stone-900">Edit Profile</h3>
              <button
                type="button"
                onClick={() => setShowEditProfileModal(false)}
                className="h-9 w-9 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-3 text-xs sm:text-sm outline-none focus:border-[#F97316]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Mobile Number (10 digits)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="9876543210"
                    className="w-full rounded-2xl border border-stone-300 pl-12 pr-4 py-3 text-xs sm:text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={displayEmail}
                  className="w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 py-3 text-xs sm:text-sm text-stone-500 font-medium cursor-not-allowed"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Email is verified through Clerk account authentication.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4A0A0F] px-6 py-3 text-xs font-bold text-white hover:bg-[#360509] min-h-[44px] disabled:opacity-60"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT ADDRESS (Amazon-style) */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-stone-100 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
              <h3 className="text-base font-black text-stone-900">
                {editingAddressId ? "Edit Delivery Address" : "Add Delivery Address"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="h-9 w-9 rounded-full flex items-center justify-center text-stone-400 hover:text-stone-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAddress} className="space-y-3.5">
              {/* Full Name & Phone */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.name}
                    onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                    placeholder="Recipient's Name"
                    className="w-full rounded-2xl border border-stone-300 px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    10-digit Mobile Number *
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={addressForm.phone}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        phone: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    placeholder="9876543210"
                    className="w-full rounded-2xl border border-stone-300 px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              {/* Flat/House No */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Flat, House no., Building, Company, Apartment *
                </label>
                <input
                  type="text"
                  required
                  value={addressForm.house_no}
                  onChange={(e) => setAddressForm({ ...addressForm, house_no: e.target.value })}
                  placeholder="e.g. Flat 402, Sri Sai Nilayam"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                />
              </div>

              {/* Street/Area */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Area, Street, Sector, Village *
                </label>
                <input
                  type="text"
                  required
                  value={addressForm.street_area}
                  onChange={(e) => setAddressForm({ ...addressForm, street_area: e.target.value })}
                  placeholder="e.g. Raghavendra Nagar, Uppal"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                />
              </div>

              {/* Landmark */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={addressForm.landmark}
                  onChange={(e) => setAddressForm({ ...addressForm, landmark: e.target.value })}
                  placeholder="e.g. Near Metro Pillar 84 / Behind Apollo Pharmacy"
                  className="w-full rounded-2xl border border-stone-300 px-4 py-2.5 text-xs outline-none focus:border-[#F97316]"
                />
              </div>

              {/* City, State, Pincode */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">City</label>
                  <input
                    type="text"
                    disabled
                    value="Hyderabad"
                    className="w-full rounded-2xl border border-stone-200 bg-stone-100 px-3 py-2.5 text-xs font-bold text-stone-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">State</label>
                  <input
                    type="text"
                    disabled
                    value="Telangana"
                    className="w-full rounded-2xl border border-stone-200 bg-stone-100 px-3 py-2.5 text-xs font-bold text-stone-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Pincode *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={addressForm.pincode}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        pincode: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    placeholder="500039"
                    className="w-full rounded-2xl border border-stone-300 px-3 py-2.5 text-xs font-mono outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              {/* Address Label (Home / Work / Other) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Address Type / Label
                </label>
                <div className="flex gap-2">
                  {["Home", "Work", "Other"].map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setAddressForm({ ...addressForm, label: lbl })}
                      className={`flex-1 rounded-2xl py-2.5 text-xs font-bold border min-h-[44px] transition-colors ${
                        addressForm.label === lbl
                          ? "bg-[#FFF7ED] border-[#4A0A0F] text-[#4A0A0F] ring-1 ring-[#4A0A0F]"
                          : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Set as Default Checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addressForm.is_default || addresses.length === 0}
                    disabled={addresses.length === 0}
                    onChange={(e) =>
                      setAddressForm({ ...addressForm, is_default: e.target.checked })
                    }
                    className="h-4 w-4 rounded accent-[#4A0A0F]"
                  />
                  <span className="text-xs font-semibold text-stone-700">
                    Make this my default delivery address
                  </span>
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAddress}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4A0A0F] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#360509] min-h-[44px] disabled:opacity-60"
                >
                  {savingAddress ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingAddressId ? "Save Changes" : "Save Address"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
