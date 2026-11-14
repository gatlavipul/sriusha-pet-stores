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
  PawPrint,
  Dog,
  Cat,
  Stethoscope,
  Sparkles,
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
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentPath, setCurrentPath] = useState("");

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

  // Scroll detection for subtle shadow
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track current URL for active state underline
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname + window.location.search);
    }
  }, []);

  // External event to trigger location modal from page banner
  useEffect(() => {
    const handleOpenModal = () => setShowLocationModal(true);
    window.addEventListener("open-location-modal", handleOpenModal);
    return () => window.removeEventListener("open-location-modal", handleOpenModal);
  }, []);

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
        localStorage.setItem("usha_delivery_info", JSON.stringify({
          pincode: clean,
          areaName: data.areaName || clean,
          serviceable: Boolean(data.serviceable),
          estimatedDeliveryTime: data.estimatedDeliveryTime || (data.serviceable ? "30-60 mins" : "Not serviceable"),
          freeDeliveryThreshold: data.freeDeliveryThreshold || 499,
        }));
        window.dispatchEvent(new CustomEvent("delivery-info-updated"));
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

  const isDogsActive = currentPath.includes("category=dog");
  const isCatsActive = currentPath.includes("category=cat");
  const isVetActive = currentPath.includes("category=healthcare");
  const isWishlistPage = currentPath.startsWith("/wishlist");

  return (
    <>
      {/* MAIN STICKY HEADER (56px Mobile, 64px Desktop, Matching Warm Cream/White Background) */}
      <header
        className={`sticky top-0 z-50 bg-[#FFFDF9] border-b border-stone-200/80 transition-shadow duration-200 ${
          isScrolled ? "shadow-xs" : "shadow-none"
        }`}
      >
        <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-8">
          <div className="flex h-14 lg:h-16 items-center justify-between gap-2 lg:gap-3 xl:gap-4">
            {/* 1. Brand Logo & Name */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <a
                href="/"
                className="flex items-center gap-2 group whitespace-nowrap"
                aria-label="Sri Usha Pet Store Home"
              >
                <img
                  src="/brand/logo-mark.webp"
                  onError={(e) => {
                    e.currentTarget.src = "/brand/logo-mark.png";
                  }}
                  alt="Sri Usha Pet Store"
                  width={38}
                  height={38}
                  className="h-[38px] w-[38px] lg:h-11 lg:w-11 object-contain shrink-0 group-hover:scale-105 transition-transform"
                />
                <div className="flex flex-col justify-center leading-none">
                  <span className="text-base lg:text-lg font-black tracking-tight text-[#4A0A0F] whitespace-nowrap">
                    Sri Usha
                  </span>
                  <span className="text-[10px] font-extrabold tracking-wider text-[#F97316] uppercase mt-0.5">
                    Pet Store
                  </span>
                </div>
              </a>

              {/* Delivery Location Selector Pill */}
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#FAF7F2] hover:bg-[#F3EDE2] border border-[#EADBCC] px-2 sm:px-2.5 py-1 text-[11px] font-bold text-[#4A0A0F] transition-colors shrink-0"
                title="Change Delivery Location"
                aria-label={`Delivery location: ${locationInfo.areaName} ${deliveryPincode}`}
              >
                <MapPin size={12} strokeWidth={1.75} className="text-[#F97316] shrink-0" />
                <span className="truncate max-w-[76px] sm:max-w-[100px] lg:max-w-[120px]">
                  {locationInfo.areaName} ({deliveryPincode})
                </span>
                <ChevronDown size={11} strokeWidth={1.75} className="text-stone-400 shrink-0" />
              </button>
            </div>

            {/* 2. Desktop Wide Search Bar (Remaining Width) */}
            <div className="hidden lg:flex flex-1 max-w-sm xl:max-w-md mx-2">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <Search
                  size={16}
                  strokeWidth={1.75}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
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
                  className="w-full rounded-full border border-[#EADBCC] bg-[#FAF7F2] py-2 pl-9 pr-20 text-xs text-[#241819] placeholder-stone-400 focus:border-[#F97316] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/20 transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-[#F97316] px-3 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-[#EA580C] transition-colors"
                >
                  Search
                </button>

                {/* Autocomplete Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-11 z-50 rounded-2xl border border-[#EADBCC] bg-white py-1.5 shadow-xl">
                    {suggestions.map((item) => (
                      <a
                        key={item.id}
                        href={`/products/${item.slug}`}
                        className="flex items-center justify-between px-3.5 py-1.5 text-xs hover:bg-[#FFF7ED]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-7 w-7 rounded-lg object-contain bg-stone-50 p-0.5 shrink-0"
                          />
                          <span className="font-semibold text-stone-800 truncate">{item.name}</span>
                        </div>
                        <span className="font-bold text-[#F97316] ml-2 shrink-0">
                          ₹{parseFloat(item.sale_price || item.price).toFixed(0)}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </form>
            </div>

            {/* 3. Desktop Category Links (Dogs, Cats, Vet Health - No wrap at 1024px) */}
            <nav className="hidden xl:flex items-center gap-4 text-xs font-semibold text-stone-700 shrink-0">
              <a
                href="/products?category=dog"
                className={`flex items-center gap-1 py-1 transition-colors relative hover:text-[#F97316] ${
                  isDogsActive ? "text-[#F97316] font-bold border-b-2 border-[#F97316]" : ""
                }`}
              >
                <Dog size={14} strokeWidth={1.75} className="text-[#F97316]" />
                <span>Dogs</span>
              </a>
              <a
                href="/products?category=cat"
                className={`flex items-center gap-1 py-1 transition-colors relative hover:text-[#F97316] ${
                  isCatsActive ? "text-[#F97316] font-bold border-b-2 border-[#F97316]" : ""
                }`}
              >
                <Cat size={14} strokeWidth={1.75} className="text-[#F97316]" />
                <span>Cats</span>
              </a>
              <a
                href="/products?category=healthcare"
                className={`flex items-center gap-1 py-1 transition-colors relative hover:text-[#F97316] ${
                  isVetActive ? "text-[#F97316] font-bold border-b-2 border-[#F97316]" : ""
                }`}
              >
                <Stethoscope size={14} strokeWidth={1.75} className="text-[#F97316]" />
                <span>Vet Health</span>
              </a>
            </nav>

            {/* Categories dropdown for tight 1024px desktop widths */}
            <div className="hidden lg:flex xl:hidden relative shrink-0">
              <button
                type="button"
                onClick={() => setCategoriesDropdownOpen(!categoriesDropdownOpen)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-stone-700 hover:text-[#F97316] hover:bg-[#FAF7F2] border border-[#EADBCC]"
              >
                <span>Categories</span>
                <ChevronDown size={11} strokeWidth={1.75} />
              </button>
              {categoriesDropdownOpen && (
                <div
                  className="absolute left-0 mt-2 w-44 rounded-2xl border border-[#EADBCC] bg-white p-1.5 shadow-xl z-50 text-xs"
                  onMouseLeave={() => setCategoriesDropdownOpen(false)}
                >
                  <a
                    href="/products?category=dog"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-700 hover:bg-[#FFF7ED]"
                  >
                    <Dog size={14} strokeWidth={1.75} className="text-[#F97316]" />
                    <span>Dogs</span>
                  </a>
                  <a
                    href="/products?category=cat"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-700 hover:bg-[#FFF7ED]"
                  >
                    <Cat size={14} strokeWidth={1.75} className="text-[#F97316]" />
                    <span>Cats</span>
                  </a>
                  <a
                    href="/products?category=healthcare"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-700 hover:bg-[#FFF7ED]"
                  >
                    <Stethoscope size={14} strokeWidth={1.75} className="text-[#F97316]" />
                    <span>Vet Health</span>
                  </a>
                </div>
              )}
            </div>

            {/* 4. Action Icons: Wishlist, Orders, Cart, Sign In / Avatar */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Mobile Search Toggle Icon */}
              <button
                type="button"
                onClick={() => setSearchOpen(!searchOpen)}
                className="lg:hidden p-2 text-stone-700 hover:text-[#F97316] rounded-full hover:bg-[#FAF7F2] transition-colors"
                aria-label="Search pet products"
              >
                <Search size={19} strokeWidth={1.75} />
              </button>

              {/* Desktop Wishlist (Outline by default, filled on /wishlist, badge when count > 0) */}
              <a
                href="/wishlist"
                className="hidden sm:inline-flex relative p-2 text-stone-700 hover:text-rose-600 rounded-full hover:bg-[#FAF7F2] transition-colors shrink-0"
                title="Wishlist"
                aria-label="Wishlist"
              >
                <Heart
                  size={19}
                  strokeWidth={1.75}
                  className={isWishlistPage ? "text-rose-500 fill-rose-500" : "text-stone-700"}
                />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-xs">
                    {wishlistCount}
                  </span>
                )}
              </a>

              {/* Desktop Orders Icon */}
              <a
                href="/orders"
                className="hidden sm:inline-flex p-2 text-stone-700 hover:text-[#4A0A0F] rounded-full hover:bg-[#FAF7F2] transition-colors shrink-0"
                title="My Orders"
                aria-label="My Orders"
              >
                <Package size={19} strokeWidth={1.75} />
              </a>

              {/* Cart Button with Real Item Badge */}
              <a
                href="/cart"
                className="relative inline-flex items-center gap-1.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F3EDE2] border border-[#EADBCC] px-2.5 py-1.5 sm:px-3 sm:py-1.5 text-xs font-bold text-[#4A0A0F] transition-colors shrink-0"
                aria-label={`View Cart, ${totalCount} items`}
              >
                <ShoppingCart size={18} strokeWidth={1.75} className="text-[#4A0A0F]" />
                <span className="hidden sm:inline">Cart</span>
                {totalCount > 0 && (
                  <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#F97316] px-1 text-[10px] font-black text-white shadow-xs">
                    {totalCount}
                  </span>
                )}
              </a>

              {/* User Account / Profile Menu (Desktop & Tablet) */}
              <div className="hidden sm:block">
                {user ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                      className="flex items-center gap-1 rounded-full p-1 border border-[#EADBCC] hover:border-[#F97316] transition-colors"
                      aria-label="User account menu"
                    >
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name || "User"}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4A0A0F] text-[10px] font-black text-white">
                          {(user.name || user.email || "U")[0].toUpperCase()}
                        </div>
                      )}
                      <ChevronDown size={11} strokeWidth={1.75} className="text-stone-400 mr-0.5" />
                    </button>

                    {userDropdownOpen && (
                      <div
                        className="absolute right-0 mt-2 w-52 rounded-2xl border border-[#EADBCC] bg-white p-1.5 shadow-xl z-50 text-xs"
                        onMouseLeave={() => setUserDropdownOpen(false)}
                      >
                        <div className="px-3 py-2 border-b border-stone-100">
                          <p className="font-extrabold text-[#4A0A0F] truncate">
                            {user.name || "Customer"}
                          </p>
                          <p className="text-[10px] text-stone-500 truncate">
                            {user.email}
                          </p>
                        </div>

                        {isAdmin && (
                          <a
                            href="/admin"
                            className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-[#4A0A0F] bg-rose-50 hover:bg-rose-100 transition-colors font-bold"
                          >
                            <LayoutDashboard size={14} strokeWidth={1.75} />
                            <span>Admin Operations</span>
                          </a>
                        )}

                        {isDeliveryPartner && (
                          <a
                            href="/delivery"
                            className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-amber-900 bg-amber-50 hover:bg-amber-100 transition-colors font-bold"
                          >
                            <Truck size={14} strokeWidth={1.75} />
                            <span>Delivery Portal</span>
                          </a>
                        )}

                        <a
                          href="/account"
                          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-stone-700 hover:bg-stone-50 transition-colors font-medium"
                        >
                          <User size={14} strokeWidth={1.75} />
                          <span>My Account</span>
                        </a>

                        <a
                          href="/pets"
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-700 hover:bg-stone-50 transition-colors font-medium"
                        >
                          <PawPrint size={14} strokeWidth={1.75} className="text-[#F97316]" />
                          <span>My Pets (Care Hub)</span>
                        </a>

                        <a
                          href="/orders"
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-stone-700 hover:bg-stone-50 transition-colors font-medium"
                        >
                          <Package size={14} strokeWidth={1.75} />
                          <span>Order History</span>
                        </a>

                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="mt-1 w-full flex items-center gap-2 rounded-xl px-3 py-2 text-rose-600 hover:bg-rose-50 transition-colors font-semibold border-t border-stone-100"
                          aria-label="Sign out of account"
                        >
                          <LogOut size={14} strokeWidth={1.75} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <a
                    href="/account/signin"
                    className="rounded-full border border-[#4A0A0F] text-[#4A0A0F] hover:bg-[#4A0A0F] hover:text-white px-3.5 py-1.5 text-xs font-bold transition-colors shrink-0"
                  >
                    Sign In
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE SEARCH BAR DRAWER (Opened on mobile when search icon is clicked) */}
        {searchOpen && (
          <div className="lg:hidden border-t border-[#EADBCC] bg-[#FFFDF9] p-3 shadow-md animate-in slide-in-from-top-2">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search
                size={16}
                strokeWidth={1.75}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
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
                className="w-full rounded-xl border border-[#EADBCC] bg-[#FAF7F2] py-2.5 pl-10 pr-20 text-xs text-[#241819] focus:bg-white focus:border-[#F97316] focus:outline-none"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="submit"
                  className="rounded-lg bg-[#F97316] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#EA580C]"
                >
                  Go
                </button>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-600"
                  aria-label="Close search"
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>

              {/* Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="mt-2 rounded-xl border border-[#EADBCC] bg-white py-1 shadow-lg max-h-56 overflow-y-auto">
                  {suggestions.map((item) => (
                    <a
                      key={item.id}
                      href={`/products/${item.slug}`}
                      className="flex items-center justify-between px-3 py-2 text-xs hover:bg-[#FFF7ED]"
                      onClick={() => setSearchOpen(false)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-7 w-7 rounded-lg object-contain bg-stone-50 shrink-0"
                        />
                        <span className="font-semibold text-stone-800 truncate">{item.name}</span>
                      </div>
                      <span className="font-bold text-[#F97316] ml-2 shrink-0">
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

      {/* HYPERLOCAL DELIVERY LOCATION MODAL (Pincode & Serviceability check) */}
      {showLocationModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs animate-in fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-stone-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316]">
                  <MapPin size={20} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#4A0A0F]">Delivery Location</h3>
                  <p className="text-xs text-stone-500">Fast 30-60 min local delivery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationModal(false)}
                className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                aria-label="Close location modal"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-[#FAF7F2] border border-[#EADBCC] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4A0A0F]">Current Area</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    locationInfo.serviceable
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {locationInfo.serviceable ? "Serviceable" : "Unavailable"}
                </span>
              </div>
              <p className="text-sm font-black text-[#241819] mt-1">
                {locationInfo.areaName} ({deliveryPincode})
              </p>
              <p className="text-xs text-stone-600 mt-0.5">
                Estimated delivery: {locationInfo.estimatedDeliveryTime}
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
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Enter Hyderabad Pincode
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={pincodeDraft}
                    onChange={(e) => setPincodeDraft(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 500039"
                    className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm font-bold text-stone-900 focus:border-[#F97316] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isCheckingPincode || pincodeDraft.length !== 6}
                    className="rounded-xl bg-[#F97316] px-4 py-2 text-xs font-bold text-white hover:bg-[#EA580C] disabled:opacity-50 transition-all shadow-xs"
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
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">
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
                      className="rounded-lg border border-[#EADBCC] bg-[#FAF7F2] px-2.5 py-1 text-xs font-semibold text-[#4A0A0F] hover:border-[#F97316] hover:bg-[#FFF7ED] transition-colors"
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
