import { useState, useEffect, useRef } from "react";
import {
  ShoppingCart,
  Search,
  MapPin,
  ChevronDown,
  User,
  Heart,
  Package,
  LayoutDashboard,
  Truck,
  LogOut,
  X,
  ArrowRight,
  ShieldCheck,
  Phone,
} from "lucide-react";
import useUser from "@/utils/useUser";
import useAuth from "@/utils/useAuth";
import useCart from "@/utils/useCart";
import { useWishlist } from "@/utils/useWishlist";

export default function Header() {
  const { data: user } = useUser();
  const { signOut } = useAuth();
  const { totalCount } = useCart();
  const { count: wishlistCount } = useWishlist();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isDeliveryPartner, setIsDeliveryPartner] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Delivery Location State
  const [deliveryPincode, setDeliveryPincode] = useState("500039");
  const [pincodeDraft, setPincodeDraft] = useState("500039");
  const [locationInfo, setLocationInfo] = useState({
    areaName: "Uppal",
    serviceable: true,
    estimatedDeliveryTime: "30-60 mins",
    freeDeliveryThreshold: 499,
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [pincodeError, setPincodeError] = useState("");

  const searchInputRef = useRef(null);

  // Check pincode against live serviceability API
  const checkPincode = async (pin) => {
    const clean = String(pin || "").trim();
    if (clean.length !== 6 || !/^\d{6}$/.test(clean)) {
      setPincodeError("Please enter a valid 6-digit pincode");
      return;
    }
    setPincodeError("");
    setIsCheckingPincode(true);
    try {
      const res = await fetch(`/api/serviceability?pincode=${clean}&subtotal=500`);
      const data = await res.json();
      setDeliveryPincode(clean);
      setLocationInfo({
        areaName: data.areaName || clean,
        serviceable: Boolean(data.serviceable),
        estimatedDeliveryTime: data.estimatedDeliveryTime || (data.serviceable ? "30-60 mins" : "Not serviceable"),
        freeDeliveryThreshold: data.freeDeliveryThreshold || 499,
      });
      if (typeof window !== "undefined") {
        localStorage.setItem("usha_delivery_pincode", clean);
      }
      setShowLocationModal(false);
    } catch {
      setPincodeError("Could not verify serviceability right now");
    } finally {
      setIsCheckingPincode(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPin = localStorage.getItem("usha_delivery_pincode") || "500039";
      setPincodeDraft(savedPin);
      checkPincode(savedPin);
    }
  }, []);

  // Live product search autocomplete
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.products || []);
        }
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Check user role
  useEffect(() => {
    if (user) {
      fetch("/api/admin/check-role")
        .then((res) => res.json())
        .then((data) => {
          setIsAdmin(Boolean(data?.isAdmin));
          setIsDeliveryPartner(Boolean(data?.isDeliveryPartner));
        })
        .catch(() => {
          setIsAdmin(false);
          setIsDeliveryPartner(false);
        });
    } else {
      setIsAdmin(false);
      setIsDeliveryPartner(false);
    }
  }, [user]);

  // Focus input when mobile search opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleSignOut = async () => {
    setUserDropdownOpen(false);
    await signOut({ callbackUrl: "/", redirect: true });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchOpen(false);
      setShowSuggestions(false);
      window.location.href = `/products?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <>
      {/* 1. ONE SLIM DELIVERY NOTIFICATION BAR (No stacked clutter) */}
      <div className="bg-[#0F172A] text-white text-[11px] py-1.5 px-3 border-b border-slate-800">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-2 truncate">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">
              ⚡ Free express delivery on orders over ₹{locationInfo.freeDeliveryThreshold} in {locationInfo.areaName || "Hyderabad"} ({locationInfo.estimatedDeliveryTime})
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-3 shrink-0 text-slate-300">
            <a
              href="tel:+919876543210"
              className="hover:text-white flex items-center gap-1 transition-colors"
            >
              <Phone size={11} className="text-amber-400" />
              <span>+91 98765 43210</span>
            </a>
            <span>•</span>
            <span className="text-slate-400">100% Genuine Vet Supplies</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER (About 56px on mobile, wide layout on desktop) */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/90 shadow-2xs">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-4">
            {/* Logo and Brand (Single clean line, no vertical wrap) */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <a href="/" className="flex items-center gap-2 group whitespace-nowrap">
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-[#2563EB] flex items-center justify-center text-white text-base shadow-xs group-hover:scale-105 transition-transform">
                  🐾
                </div>
                <div className="flex flex-col justify-center leading-none">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm sm:text-base font-black tracking-tight text-[#0F172A] whitespace-nowrap">
                      Sri Usha
                    </span>
                    <span className="rounded-md bg-amber-100 px-1 py-0.5 text-[9px] font-black uppercase text-amber-900 tracking-wider">
                      ⚡ 30-60m
                    </span>
                  </div>
                  <span className="hidden sm:inline-block text-[10px] font-bold tracking-wider text-[#EA580C] uppercase mt-0.5">
                    Vet &amp; Pet Stores
                  </span>
                </div>
              </a>

              {/* Delivery Location Selector Pill */}
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-gray-100 hover:bg-gray-200/80 px-2 sm:px-2.5 py-1 text-[11px] font-bold text-gray-800 transition-colors shrink-0"
                title="Change Delivery Location"
              >
                <MapPin size={12} className="text-[#EA580C] shrink-0" />
                <span className="truncate max-w-[85px] sm:max-w-[130px]">
                  {locationInfo.areaName} ({deliveryPincode})
                </span>
                <ChevronDown size={12} className="text-gray-400 shrink-0" />
              </button>
            </div>

            {/* Desktop Search Bar (1024px+) */}
            <div className="hidden lg:flex flex-1 max-w-md mx-4">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  placeholder="Search pet food, medicines, toys..."
                  className="w-full rounded-full border border-gray-200 bg-gray-50/80 py-2 pl-9 pr-20 text-xs text-gray-900 placeholder-gray-400 focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-[#2563EB] px-3 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-colors"
                >
                  Search
                </button>
                {/* Autocomplete Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-11 z-50 rounded-2xl border border-gray-200 bg-white py-1.5 shadow-xl">
                    {suggestions.map((item) => (
                      <a
                        key={item.id}
                        href={`/products/${item.slug}`}
                        className="flex items-center justify-between px-3.5 py-1.5 text-xs hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-7 w-7 rounded-lg object-contain bg-gray-50 p-0.5 shrink-0"
                          />
                          <span className="font-semibold text-gray-800 truncate">{item.name}</span>
                        </div>
                        <span className="font-bold text-[#2563EB] ml-2 shrink-0">
                          ₹{parseFloat(item.sale_price || item.price).toFixed(0)}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </form>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-1.5 sm:gap-3">
              {/* Mobile Search Toggle Icon */}
              <button
                type="button"
                onClick={() => setSearchOpen(!searchOpen)}
                className="lg:hidden p-2 text-gray-700 hover:text-blue-600 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Open Search"
              >
                <Search size={19} />
              </button>

              {/* Desktop Department Links */}
              <div className="hidden lg:flex items-center gap-4 text-xs font-semibold text-gray-600">
                <a href="/products?category=dog" className="hover:text-blue-600 transition-colors">
                  🐶 Dogs
                </a>
                <a href="/products?category=cat" className="hover:text-blue-600 transition-colors">
                  🐱 Cats
                </a>
                <a href="/products?category=healthcare" className="hover:text-blue-600 transition-colors">
                  💊 Vet Health
                </a>
              </div>

              {/* Desktop Wishlist & Orders */}
              <a
                href="/wishlist"
                className="hidden sm:inline-flex relative p-2 text-gray-700 hover:text-rose-600 rounded-full hover:bg-gray-100 transition-colors"
                title="Wishlist"
              >
                <Heart size={19} className={wishlistCount > 0 ? "text-rose-500 fill-rose-500" : ""} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-xs">
                    {wishlistCount}
                  </span>
                )}
              </a>

              <a
                href="/orders"
                className="hidden sm:inline-flex p-2 text-gray-700 hover:text-blue-600 rounded-full hover:bg-gray-100 transition-colors"
                title="Orders"
              >
                <Package size={19} />
              </a>

              {/* Cart Button with Real Item Badge */}
              <a
                href="/cart"
                className="relative inline-flex items-center gap-1.5 rounded-xl bg-gray-100 hover:bg-gray-200/80 px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-bold text-gray-900 transition-colors"
                aria-label="View Cart"
              >
                <ShoppingCart size={17} className="text-gray-800" />
                <span className="hidden sm:inline">Cart</span>
                {totalCount > 0 && (
                  <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#EA580C] px-1 text-[10px] font-black text-white shadow-xs">
                    {totalCount}
                  </span>
                )}
              </a>

              {/* User Account / Profile Menu */}
              {user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-1 rounded-full p-1 border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name || "User"}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-[10px] font-black text-white">
                        {(user.name || user.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <ChevronDown size={11} className="text-gray-400 mr-0.5" />
                  </button>

                  {userDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-52 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl z-50 text-xs"
                      onMouseLeave={() => setUserDropdownOpen(false)}
                    >
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="font-extrabold text-gray-900 truncate">
                          {user.name || "Customer"}
                        </p>
                        <p className="text-[10px] text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>

                      {isAdmin && (
                        <a
                          href="/admin"
                          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-purple-700 hover:bg-purple-50 transition-colors font-bold"
                        >
                          <LayoutDashboard size={14} />
                          <span>Admin Operations</span>
                        </a>
                      )}

                      {isDeliveryPartner && (
                        <a
                          href="/delivery"
                          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-indigo-700 hover:bg-indigo-50 transition-colors font-bold"
                        >
                          <Truck size={14} />
                          <span>Delivery Portal</span>
                        </a>
                      )}

                      <a
                        href="/account"
                        className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <User size={14} />
                        <span>My Account</span>
                      </a>

                      <a
                        href="/pets"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <span className="text-sm">🐾</span>
                        <span>My Pets (Care Hub)</span>
                      </a>

                      <a
                        href="/orders"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <Package size={14} />
                        <span>Order History</span>
                      </a>

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="mt-1 w-full flex items-center gap-2 rounded-xl px-3 py-2 text-rose-600 hover:bg-rose-50 transition-colors font-semibold border-t border-gray-100"
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <a
                  href="/account/signin"
                  className="rounded-full bg-[#2563EB] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1D4ED8] shadow-2xs transition-colors shrink-0"
                >
                  Sign In
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 3. MOBILE SEARCH BAR DRAWER (Shown when search icon clicked on mobile) */}
        {searchOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white p-3 shadow-md animate-in slide-in-from-top-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Search dog food, medicines, treats..."
                className="w-full rounded-xl border border-gray-300 bg-gray-50 py-2.5 pl-10 pr-20 text-xs text-gray-900 focus:bg-white focus:border-[#2563EB] focus:outline-none"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-bold text-white"
                >
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-2 rounded-xl border border-gray-200 bg-white py-1 shadow-lg max-h-56 overflow-y-auto">
                  {suggestions.map((item) => (
                    <a
                      key={item.id}
                      href={`/products/${item.slug}`}
                      className="flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50"
                      onClick={() => setSearchOpen(false)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-7 w-7 rounded-lg object-contain bg-gray-50 shrink-0"
                        />
                        <span className="font-semibold text-gray-800 truncate">{item.name}</span>
                      </div>
                      <span className="font-bold text-[#2563EB] ml-2 shrink-0">
                        ₹{parseFloat(item.sale_price || item.price).toFixed(0)}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </form>
          </div>
        )}
      </header>

      {/* 4. HYPERLOCAL DELIVERY LOCATION MODAL (Pincode & Serviceability check) */}
      {showLocationModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs animate-in fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-[#EA580C]">
                  <MapPin size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">Delivery Location</h3>
                  <p className="text-xs text-gray-500">Fast 30-60 min local delivery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-blue-50/70 border border-blue-100 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900">Current Area</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                  {locationInfo.serviceable ? "Serviceable" : "Unavailable"}
                </span>
              </div>
              <p className="text-sm font-black text-gray-900 mt-1">
                {locationInfo.areaName} ({deliveryPincode})
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                ⚡ Estimated delivery: {locationInfo.estimatedDeliveryTime}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                checkPincode(pincodeDraft);
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Enter Hyderabad Pincode
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={pincodeDraft}
                    onChange={(e) => setPincodeDraft(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 500039"
                    className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold text-gray-900 focus:border-[#2563EB] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isCheckingPincode || pincodeDraft.length !== 6}
                    className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-all shadow-xs"
                  >
                    {isCheckingPincode ? "Checking..." : "Verify"}
                  </button>
                </div>
                {pincodeError && (
                  <p className="text-xs font-semibold text-rose-600 mt-1.5">{pincodeError}</p>
                )}
              </div>

              {/* Quick Pincode Shortcuts */}
              <div>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Popular Delivery Zones
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { pin: "500039", label: "Uppal" },
                    { pin: "500013", label: "Ramanthapur" },
                    { pin: "500007", label: "Habsiguda" },
                    { pin: "500068", label: "Nagole" },
                    { pin: "500034", label: "Banjara Hills" },
                  ].map((zone) => (
                    <button
                      key={zone.pin}
                      type="button"
                      onClick={() => {
                        setPincodeDraft(zone.pin);
                        checkPincode(zone.pin);
                      }}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                    >
                      {zone.label} ({zone.pin})
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
