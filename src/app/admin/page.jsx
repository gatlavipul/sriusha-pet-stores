import { useState, useEffect } from "react";
import AdminHeader from "@/components/AdminHeader";
import {
  Package,
  ShoppingBag,
  IndianRupee,
  Clock,
  TrendingUp,
  AlertCircle,
  Users,
  AlertTriangle,
  ArrowRight,
  Bell,
  BarChart3,
  MapPin,
  Truck,
} from "lucide-react";
import useUser from "@/utils/useUser";

export default function AdminDashboard() {
  const { data: user, loading: userLoading } = useUser();
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState("checking");

  useEffect(() => {
    if (userLoading) {
      setAuthStatus("checking");
    } else if (!user) {
      setAuthStatus("unauthenticated");
      if (typeof window !== "undefined") {
        window.location.href = "/account/signin?callbackUrl=/admin";
      }
    } else {
      setAuthStatus("authenticated");
      checkAdminAccess();
    }
  }, [user, userLoading]);

  const checkAdminAccess = async () => {
    try {
      const response = await fetch("/api/admin/check-role");
      const data = await response.json();

      if (!data.isAdmin) {
        setAuthStatus("unauthorized");
        setLoading(false);
        return;
      }

      fetchStats();
    } catch (error) {
      console.error("Error checking admin access:", error);
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      setStats(data.stats);
      setRecentOrders(data.recentOrders || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (userLoading || authStatus === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-[#6B7280]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            Checking admin privileges...
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === "unauthenticated" || authStatus === "unauthorized") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-4">
        <div className="max-w-md w-full rounded-2xl bg-white border border-gray-200 p-8 text-center shadow-xs">
          <AlertCircle size={40} className="mx-auto text-red-500 mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Administrator Access Required</h2>
          <p className="text-xs text-gray-500 mb-6">
            You must be signed in with an authorized Sri Usha administrator account to view this portal.
          </p>
          <a
            href="/account/signin?callbackUrl=/admin"
            className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8]"
          >
            Sign In with Admin Account
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <AdminHeader />
        <div className="mx-auto max-w-7xl px-4 py-16 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mx-auto mb-3" />
          <p className="text-xs text-gray-500 font-medium">Loading store analytics...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Revenue",
      value: `₹${parseFloat(stats?.totalRevenue || 0).toLocaleString("en-IN")}`,
      sub: "Verified paid & delivered orders",
      icon: IndianRupee,
      iconBg: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Total Orders",
      value: stats?.totalOrders || 0,
      sub: `${stats?.pendingOrders || 0} active / in-progress`,
      icon: ShoppingBag,
      iconBg: "bg-blue-50 text-[#2563EB]",
    },
    {
      label: "Low Stock Alert",
      value: stats?.lowStockProducts || 0,
      sub: "5 or fewer units remaining",
      icon: AlertTriangle,
      iconBg: stats?.lowStockProducts > 0 ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-600",
      alert: stats?.lowStockProducts > 0,
      link: "/admin/products?low_stock=true",
    },
    {
      label: "Delivery Exceptions",
      value: stats?.deliveryExceptions || 0,
      sub: stats?.deliveryExceptions > 0 ? "Failed runs needing dispatch review" : "All dispatches on track",
      icon: Truck,
      iconBg: stats?.deliveryExceptions > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700",
      alert: stats?.deliveryExceptions > 0,
      link: "/admin/orders?status=delivery_failed",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <AdminHeader />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
              Admin Overview &amp; Operations
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Sri Usha Vet &amp; Pet Stores • Uppal, Hyderabad Operation Portal
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/admin/analytics"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <BarChart3 size={14} className="text-[#2563EB]" />
              Analytics
            </a>
            <a
              href="/admin/serviceability"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <MapPin size={14} className="text-[#EA580C]" />
              Delivery Zones
            </a>
            <a
              href="/admin/notifications"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs relative"
            >
              <Bell size={14} className="text-purple-600" />
              Notifications
              {stats?.unreadNotifications > 0 && (
                <span className="ml-1 rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-extrabold text-white">
                  {stats.unreadNotifications}
                </span>
              )}
            </a>
            <a
              href="/admin/products/new"
              className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-colors"
            >
              + Add Product
            </a>
          </div>
        </div>

        {/* Operational Attention Alerts */}
        {stats?.deliveryExceptions > 0 && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-extrabold text-red-950">
                    Action Required: {stats.deliveryExceptions} Delivery Exception{stats.deliveryExceptions > 1 ? "s" : ""}
                  </h3>
                  <p className="text-xs text-red-800 mt-0.5">
                    Delivery runs failed due to customer unavailability or wrong address. Please review and reassign.
                  </p>
                </div>
              </div>
              <a
                href="/admin/orders?status=delivery_failed"
                className="shrink-0 rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors self-start sm:self-center"
              >
                Review Failed Runs →
              </a>
            </div>
          </div>
        )}

        {/* Stat Cards Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-2xl border bg-white p-5 shadow-xs transition-shadow hover:shadow-md ${
                card.alert ? "border-amber-300 bg-amber-50/30" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900">
                    {card.value}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500">{card.sub}</p>
                </div>
                <div className={`rounded-xl p-3 ${card.iconBg}`}>
                  <card.icon size={22} />
                </div>
              </div>

              {card.link && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <a
                    href={card.link}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:underline"
                  >
                    <span>View low stock items</span>
                    <ArrowRight size={12} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recent Orders Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-[#2563EB]" />
              <h2 className="text-base font-bold text-gray-900">
                Recent Customer Orders
              </h2>
            </div>
            <a
              href="/admin/orders"
              className="text-xs font-bold text-[#2563EB] hover:underline"
            >
              View All Orders →
            </a>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              No orders placed yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/50">
                  <tr>
                    <th className="py-3 px-3 font-bold text-gray-500 uppercase tracking-wider">
                      Order No.
                    </th>
                    <th className="py-3 px-3 font-bold text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="py-3 px-3 font-bold text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="py-3 px-3 font-bold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-3 font-bold text-gray-500 uppercase tracking-wider text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="py-3 px-3 font-extrabold text-gray-900">
                        <a href={`/admin/orders`} className="hover:text-[#2563EB]">
                          {order.order_number}
                        </a>
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        <div className="font-semibold">{order.customer_name}</div>
                        <div className="text-[10px] text-gray-400">{order.customer_email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold uppercase text-gray-700">
                          {order.payment_method}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-1">
                          ({order.payment_status})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            order.status === "delivered"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : order.status === "shipped"
                              ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                              : order.status === "cancelled"
                              ? "bg-red-50 text-red-800 border border-red-200"
                              : "bg-blue-50 text-blue-800 border border-blue-200"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-gray-900">
                        ₹{parseFloat(order.total_amount).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
