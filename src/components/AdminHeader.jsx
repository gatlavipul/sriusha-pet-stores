import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  FolderTree,
  LogOut,
  Menu,
  X,
  Settings,
  Bell,
  BarChart3,
  MapPin,
} from "lucide-react";
import { useState, useEffect } from "react";
import useAuth from "@/utils/useAuth";

export default function AdminHeader() {
  const { signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30s polling for operational alerts
    return () => clearInterval(interval);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch("/api/admin/notifications?limit=1&unread_only=true");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Quiet fail if not admin or server restarting
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white shadow-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="/admin" className="flex items-center gap-2">
              <img
                src="https://ucarecdn.com/1ba9ff02-d14c-447c-b424-734247393bdd/-/format/auto/"
                alt="Sri Usha"
                className="h-9 w-auto"
              />
              <div className="hidden sm:block">
                <span className="text-sm font-bold text-[#27AE60]">Sri Usha</span>
                <span className="ml-1 text-xs text-[#6B7280]">Admin</span>
              </div>
            </a>
            <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
              <a
                href="/admin"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-700 hover:bg-[#E8F8F0] hover:text-[#27AE60] transition-colors"
              >
                <LayoutDashboard size={15} />
                <span>Overview</span>
              </a>
              <a
                href="/admin/analytics"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-700 hover:bg-[#E8F8F0] hover:text-[#27AE60] transition-colors"
              >
                <BarChart3 size={15} />
                <span>Analytics</span>
              </a>
              <a
                href="/admin/orders"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-700 hover:bg-[#E8F8F0] hover:text-[#27AE60] transition-colors"
              >
                <ShoppingBag size={15} />
                <span>Orders</span>
              </a>
              <a
                href="/admin/products"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-700 hover:bg-[#E8F8F0] hover:text-[#27AE60] transition-colors"
              >
                <Package size={15} />
                <span>Products</span>
              </a>
              <a
                href="/admin/serviceability"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-700 hover:bg-[#E8F8F0] hover:text-[#27AE60] transition-colors"
              >
                <MapPin size={15} />
                <span>Delivery Zones</span>
              </a>
              <a
                href="/admin/users"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-700 hover:bg-[#E8F8F0] hover:text-[#27AE60] transition-colors"
              >
                <Users size={15} />
                <span>Staff &amp; Users</span>
              </a>
              <a
                href="/admin/categories"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-700 hover:bg-[#E8F8F0] hover:text-[#27AE60] transition-colors"
              >
                <FolderTree size={15} />
                <span>Categories</span>
              </a>
              <a
                href="/admin/settings"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-700 hover:bg-[#E8F8F0] hover:text-[#27AE60] transition-colors"
              >
                <Settings size={15} />
                <span>Settings</span>
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell with live unread badge */}
            <a
              href="/admin/notifications"
              className="relative p-2 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              title="Admin Operational Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white shadow-xs animate-pulse">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </a>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-block rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              View Storefront
            </a>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 transition-colors"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>

            <button
              className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E5E7EB] bg-white">
          <div className="px-4 py-3 space-y-1 text-sm font-semibold">
            <a
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-800 hover:bg-[#E8F8F0]"
            >
              <LayoutDashboard size={16} />
              <span>Overview</span>
            </a>
            <a
              href="/admin/analytics"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-800 hover:bg-[#E8F8F0]"
            >
              <BarChart3 size={16} />
              <span>Business Analytics</span>
            </a>
            <a
              href="/admin/notifications"
              className="flex items-center justify-between rounded-lg px-3 py-2 text-gray-800 hover:bg-[#E8F8F0]"
            >
              <div className="flex items-center gap-2">
                <Bell size={16} />
                <span>Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount} unread
                </span>
              )}
            </a>
            <a
              href="/admin/orders"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-800 hover:bg-[#E8F8F0]"
            >
              <ShoppingBag size={16} />
              <span>Orders Management</span>
            </a>
            <a
              href="/admin/products"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-800 hover:bg-[#E8F8F0]"
            >
              <Package size={16} />
              <span>Products</span>
            </a>
            <a
              href="/admin/serviceability"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-800 hover:bg-[#E8F8F0]"
            >
              <MapPin size={16} />
              <span>Delivery Serviceability Zones</span>
            </a>
            <a
              href="/admin/users"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-800 hover:bg-[#E8F8F0]"
            >
              <Users size={16} />
              <span>Staff &amp; Role Access</span>
            </a>
            <a
              href="/admin/categories"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-800 hover:bg-[#E8F8F0]"
            >
              <FolderTree size={16} />
              <span>Categories</span>
            </a>
            <a
              href="/admin/settings"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-800 hover:bg-[#E8F8F0]"
            >
              <Settings size={16} />
              <span>Store Settings</span>
            </a>
            <div className="border-t border-[#E5E7EB] pt-2 mt-2">
              <a
                href="/"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-50"
              >
                View Storefront
              </a>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-red-600 hover:bg-red-50 text-left"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
