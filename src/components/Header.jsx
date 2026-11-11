import { useState, useEffect } from "react";
import {
  ShoppingCart,
  Menu,
  X,
  User,
  Search,
  Phone,
  MapPin,
  ShieldCheck,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Package,
  Heart,
  Truck,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDeliveryPartner, setIsDeliveryPartner] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [signInHref, setSignInHref] = useState("/account/signin");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname || "/";
      if (path.startsWith("/checkout") || path.startsWith("/cart")) {
        setSignInHref("/account/signin?callbackUrl=/checkout");
      } else {
        setSignInHref("/account/signin");
      }
    }
  }, []);

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

  const handleSignOut = async () => {
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
    await signOut({ callbackUrl: "/", redirect: true });
  };

  const handleOpenClerkProfile = () => {
    setUserDropdownOpen(false);
    if (typeof window !== "undefined" && typeof window.Clerk?.openUserProfile === "function") {
      window.Clerk.openUserProfile();
    } else {
      window.location.href = "/account";
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/products?search=${encodeURIComponent(
        searchQuery.trim()
      )}`;
    }
  };

  const navCategories = [
    { name: "All Products", href: "/products" },
    { name: "Dog Care", href: "/products?category=dog" },
    { name: "Cat Care", href: "/products?category=cat" },
    { name: "Birds", href: "/products?category=bird" },
    { name: "Pet Food", href: "/products?category=pet-food" },
    { name: "Grooming", href: "/products?category=grooming" },
    { name: "Healthcare", href: "/products?category=healthcare" },
  ];

  return (
    <>
      {/* Top Announcement Bar */}
      <div className="bg-[#0F172A] text-white text-xs py-2 px-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-[#F59E0B] font-medium">
              <span>🐾</span> Free Delivery on orders above ₹499
            </span>
            <span className="hidden md:inline text-gray-500">|</span>
            <span className="hidden md:inline-flex items-center gap-1 text-gray-300">
              <ShieldCheck size={13} className="text-emerald-400" /> 100% Genuine Vet Supplies
            </span>
          </div>
          <div className="flex items-center gap-4 text-gray-300 text-[11px]">
            <a
              href="tel:+919876543210"
              className="hover:text-white flex items-center gap-1 transition-colors"
            >
              <Phone size={12} className="text-[#F59E0B]" />
              <span>+91 98765 43210</span>
            </a>
            <span className="text-gray-600">•</span>
            <span className="flex items-center gap-1">
              <MapPin size={12} className="text-[#F59E0B]" /> Uppal, Hyderabad
            </span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-18 items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2 group">
                <img
                  src="https://ucarecdn.com/1ba9ff02-d14c-447c-b424-734247393bdd/-/format/auto/"
                  alt="Sri Usha Pet & Vet Stores"
                  className="h-10 sm:h-12 w-auto transition-transform group-hover:scale-105"
                />
                <div className="hidden sm:block">
                  <div className="text-base font-bold tracking-tight text-[#0F172A] leading-tight">
                    Sri Usha
                  </div>
                  <div className="text-[10px] font-semibold tracking-wider text-[#EA580C] uppercase">
                    Vet & Pet Stores
                  </div>
                </div>
              </a>
            </div>

            {/* Desktop Live Search Bar */}
            <div className="hidden md:flex flex-1 max-w-lg mx-4">
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pet food, veterinary medicines, treats, toys..."
                  className="w-full rounded-full border border-gray-300 bg-gray-50/70 py-2.5 pl-10 pr-24 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-[#2563EB] px-3.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#1D4ED8] transition-colors"
                >
                  Search
                </button>
              </form>
            </div>

            {/* Right Actions: Orders, Cart, Auth */}
            <div className="flex items-center gap-3 sm:gap-4">
              {isAdmin && (
                <a
                  href="/admin"
                  className="hidden lg:inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <LayoutDashboard size={14} />
                  <span>Admin Panel</span>
                </a>
              )}

              {/* Wishlist Link */}
              <a
                href="/wishlist"
                className="relative inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-rose-600 transition-colors"
                title="My Wishlist"
              >
                <Heart size={18} className={wishlistCount > 0 ? "text-rose-500 fill-rose-500" : "text-gray-600"} />
                <span className="hidden sm:inline">Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-xs">
                    {wishlistCount}
                  </span>
                )}
              </a>

              <a
                href="/orders"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-[#2563EB] transition-colors"
              >
                <Package size={16} />
                <span>Orders</span>
              </a>

              {/* Shopping Cart Button */}
              <a
                href="/cart"
                className="relative inline-flex items-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200/80 px-3.5 py-2 text-sm font-semibold text-gray-800 transition-colors"
                aria-label="View Shopping Cart"
              >
                <ShoppingCart size={19} className="text-[#1E293B]" />
                <span className="hidden sm:inline">Cart</span>
                {totalCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EA580C] px-1.5 text-[11px] font-bold text-white shadow-xs animate-in zoom-in">
                    {totalCount}
                  </span>
                )}
              </a>

              {/* User Account */}
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-1.5 pr-3 text-xs font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-100 transition-colors"
                  >
                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name || "User"}
                        className="h-6 w-6 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-[11px] font-bold text-white">
                        {(user.name || user.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <span className="max-w-[100px] truncate text-left">
                      {user.name || user.email?.split("@")[0]}
                    </span>
                    <ChevronDown size={14} className="text-gray-400" />
                  </button>

                  {userDropdownOpen && (
                    <div
                      className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl z-50 text-xs"
                      onMouseLeave={() => setUserDropdownOpen(false)}
                    >
                      <div className="px-3 py-2.5 border-b border-gray-100">
                        <p className="font-bold text-gray-900 truncate">
                          {user.name || "Customer"}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>

                      {isAdmin && (
                        <a
                          href="/admin"
                          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-purple-700 hover:bg-purple-50 transition-colors font-bold"
                        >
                          <LayoutDashboard size={14} />
                          <span>Admin Dashboard</span>
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
                        className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <User size={14} />
                        <span>My Account</span>
                      </a>

                      <a
                        href="/orders"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Package size={14} />
                        <span>My Orders</span>
                      </a>

                      <a
                        href="/wishlist"
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Heart size={14} className="text-rose-500" />
                        <span>Wishlist ({wishlistCount})</span>
                      </a>

                      {typeof window !== "undefined" && window.Clerk?.user && (
                        <button
                          type="button"
                          onClick={handleOpenClerkProfile}
                          className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <ShieldCheck size={14} className="text-[#2563EB]" />
                          <span>Manage Security Profile</span>
                        </button>
                      )}

                      <div className="my-1 border-t border-gray-100" />

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={14} />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <a
                  href={signInHref}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-all whitespace-nowrap"
                >
                  <User size={14} />
                  <span>Sign In / Join Us</span>
                </a>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {/* Desktop Categories Bar */}
          <nav className="hidden md:flex items-center gap-1 py-2.5 border-t border-gray-100 overflow-x-auto no-scrollbar">
            {navCategories.map((cat) => (
              <a
                key={cat.name}
                href={cat.href}
                className="rounded-full px-3.5 py-1 text-xs font-medium text-gray-700 hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-colors whitespace-nowrap"
              >
                {cat.name}
              </a>
            ))}
          </nav>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white p-4 md:hidden shadow-xl animate-in slide-in-from-top-2">
            <form onSubmit={handleSearchSubmit} className="relative mb-4">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food, medicines, toys..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#2563EB]"
              />
            </form>

            <div className="font-semibold text-xs text-gray-400 uppercase tracking-wider mb-2">
              Categories
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {navCategories.map((cat) => (
                <a
                  key={cat.name}
                  href={cat.href}
                  className="rounded-lg border border-gray-200 bg-gray-50/50 p-2.5 text-xs font-medium text-gray-800 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {cat.name}
                </a>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              {isAdmin && (
                <a
                  href="/admin"
                  className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-xs font-bold text-purple-800"
                >
                  <LayoutDashboard size={14} />
                  <span>Admin Panel</span>
                </a>
              )}
              {isDeliveryPartner && (
                <a
                  href="/delivery"
                  className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800"
                >
                  <Truck size={14} />
                  <span>Delivery Portal</span>
                </a>
              )}
              {user && (
                <a
                  href="/account"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  <User size={14} />
                  <span>My Account</span>
                </a>
              )}
              <a
                href="/wishlist"
                className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  <Heart size={14} className="text-rose-500" />
                  <span>My Wishlist</span>
                </div>
                {wishlistCount > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {wishlistCount}
                  </span>
                )}
              </a>
              <a
                href="/orders"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                <Package size={14} />
                <span>My Orders</span>
              </a>
              {user ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              ) : (
                <div className="pt-2">
                  <a
                    href={signInHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-2.5 text-center text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8]"
                  >
                    <User size={14} />
                    <span>Sign In / Join Us</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
