import { useState, useEffect } from "react";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAccess, AdminAccessRestricted, AdminAuthChecking } from "@/components/AdminAccessGuard";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  ShoppingBag,
  Package,
  CreditCard,
  Truck,
  ArrowRight,
  Filter,
  Check,
  RefreshCw,
} from "lucide-react";

export default function AdminNotificationsPage() {
  const { status: adminStatus, role: adminRole, email: adminEmail } = useAdminAccess("/admin/notifications");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingId, setMarkingId] = useState(null);

  useEffect(() => {
    if (adminStatus === "authorized") {
      fetchNotifications();
    }
  }, [adminStatus, filterType, unreadOnly]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (unreadOnly) params.set("unread_only", "true");

      const res = await fetch(`/api/admin/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    setMarkingId(id);
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMarkingId(null);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "delivery_failed":
        return <AlertTriangle size={18} className="text-rose-600" />;
      case "low_stock":
        return <Package size={18} className="text-amber-600" />;
      case "payment_issue":
        return <CreditCard size={18} className="text-red-600" />;
      case "new_order":
      case "order_confirmed":
        return <ShoppingBag size={18} className="text-blue-600" />;
      case "out_for_delivery":
      case "order_delivered":
        return <Truck size={18} className="text-emerald-600" />;
      default:
        return <Bell size={18} className="text-gray-600" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case "delivery_failed":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "low_stock":
        return "bg-amber-50 text-amber-800 border-amber-200";
      case "payment_issue":
        return "bg-red-50 text-red-800 border-red-200";
      case "new_order":
        return "bg-blue-50 text-blue-800 border-blue-200";
      case "order_delivered":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  if (adminStatus === "checking" || adminStatus === "unauthenticated") {
    return <AdminAuthChecking />;
  }

  if (adminStatus === "forbidden") {
    return <AdminAccessRestricted role={adminRole} email={adminEmail} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <AdminHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Operations &amp; Notification Center
              </h1>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-black text-white shadow-xs">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Real-time operational alerts for orders, inventory, dispatches, and delivery exceptions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchNotifications}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
              >
                <Check size={14} />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex flex-wrap gap-1.5 text-xs font-bold">
            {[
              { key: "all", label: "All Alerts" },
              { key: "new_order", label: "New Orders" },
              { key: "delivery_failed", label: "Delivery Exceptions" },
              { key: "low_stock", label: "Low Stock" },
              { key: "payment_issue", label: "Payment Issues" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterType(tab.key)}
                className={`rounded-xl px-3 py-1.5 transition-all ${
                  filterType === tab.key
                    ? "bg-gray-900 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer pr-2">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="h-4 w-4 rounded text-indigo-600"
            />
            <span>Unread Only</span>
          </label>
        </div>

        {/* Notification List */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto mb-3" />
            <p className="text-xs text-gray-500 font-semibold">Loading operations log...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <Bell size={40} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-sm font-bold text-gray-900">No notifications found</h2>
            <p className="text-xs text-gray-400 mt-1">
              {unreadOnly
                ? "All operational notifications in this filter are caught up."
                : "New order alerts, delivery exceptions, and stock warnings will appear here."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-2xl border p-4 shadow-xs transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                  !n.is_read
                    ? "border-indigo-200 bg-white ring-2 ring-indigo-500/10"
                    : "border-gray-200 bg-white/70 opacity-80"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                    {getTypeIcon(n.type)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-gray-900">{n.title}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getTypeBadge(
                          n.type
                        )}`}
                      >
                        {n.type.replace(/_/g, " ")}
                      </span>
                      {!n.is_read && (
                        <span className="h-2 w-2 rounded-full bg-rose-600" title="Unread" />
                      )}
                    </div>

                    <p className="mt-1 text-xs text-gray-600 leading-relaxed">{n.message}</p>

                    <div className="mt-2 text-[11px] text-gray-400 font-medium">
                      {new Date(n.created_at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {n.link_url && (
                    <a
                      href={n.link_url}
                      className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-indigo-600 hover:text-indigo-600 shadow-2xs"
                    >
                      <span>View Target</span>
                      <ArrowRight size={13} />
                    </a>
                  )}

                  {!n.is_read && (
                    <button
                      type="button"
                      disabled={markingId === n.id}
                      onClick={() => markAsRead(n.id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Check size={13} />
                      <span className="hidden sm:inline">Mark Read</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

