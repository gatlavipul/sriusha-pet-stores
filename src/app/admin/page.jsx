import { useState, useEffect } from "react";
import AdminHeader from "@/components/AdminHeader";
import {
  useAdminAccess,
  AdminAccessRestricted,
  AdminAuthChecking,
} from "@/components/AdminAccessGuard";
import {
  IndianRupee,
  ShoppingBag,
  Clock,
  Package,
  AlertTriangle,
  Users,
  Truck,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  BarChart3,
  Bell,
  RefreshCw,
} from "lucide-react";

const STATUS_BADGE_MAP = {
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  out_for_delivery: "bg-indigo-50 text-indigo-700 border-indigo-200",
  delivery_failed: "bg-rose-50 text-rose-700 border-rose-200",
  ready_for_delivery: "bg-purple-50 text-purple-700 border-purple-200",
  assigned: "bg-cyan-50 text-cyan-700 border-cyan-200",
  packing: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

function formatCurrency(val) {
  return `₹${Number(val || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export default function AdminDashboard() {
  const {
    status: adminStatus,
    role: adminRole,
    email: adminEmail,
  } = useAdminAccess("/admin");

  const [stats, setStats] = useState(null);
  const [pipelineCounts, setPipelineCounts] = useState(null);
  const [todayStats, setTodayStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || null);
        setPipelineCounts(data.pipelineCounts || null);
        setTodayStats(data.todayStats || null);
        setRecentOrders(data.recentOrders || []);
      }
    } catch (error) {
      console.error("Failed to fetch admin stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (adminStatus === "authorized") {
      fetchStats(false);
    }
  }, [adminStatus]);

  if (adminStatus === "checking" || adminStatus === "unauthenticated") {
    return <AdminAuthChecking />;
  }

  if (adminStatus === "forbidden") {
    return <AdminAccessRestricted role={adminRole} email={adminEmail} />;
  }

  const statCards = [
    {
      label: "Total Revenue",
      value: formatCurrency(stats?.totalRevenue || 0),
      sub: "Verified paid & delivered COD",
      href: "/admin/analytics",
      icon: IndianRupee,
      accent: "bg-emerald-50 text-emerald-600 border-emerald-100",
    },
    {
      label: "Total Orders",
      value: stats?.totalOrders ?? 0,
      sub: "Manage all customer orders",
      href: "/admin/orders",
      icon: ShoppingBag,
      accent: "bg-blue-50 text-blue-600 border-blue-100",
    },
    {
      label: "Pending Orders",
      value: stats?.pendingOrders ?? 0,
      sub: "Orders awaiting fulfillment",
      href: "/admin/orders?status=placed",
      icon: Clock,
      accent: "bg-amber-50 text-amber-600 border-amber-100",
    },
    {
      label: "Total Customers",
      value: stats?.totalCustomers ?? 0,
      sub: "Registered customer accounts",
      href: "/admin/users?role=customer",
      icon: Users,
      accent: "bg-purple-50 text-purple-600 border-purple-100",
    },
    {
      label: "Active Products",
      value: stats?.totalProducts ?? 0,
      sub: "Manage store inventory",
      href: "/admin/products",
      icon: Package,
      accent: "bg-cyan-50 text-cyan-600 border-cyan-100",
    },
    {
      label: "Low Stock Alerts",
      value: stats?.lowStockProducts ?? 0,
      sub: "5 or fewer units left",
      href: "/admin/products?low_stock=true",
      icon: AlertTriangle,
      accent:
        (stats?.lowStockProducts ?? 0) > 0
          ? "bg-orange-50 text-orange-600 border-orange-200"
          : "bg-gray-50 text-gray-600 border-gray-100",
    },
    {
      label: "Delivery Exceptions",
      value: stats?.deliveryExceptions ?? 0,
      sub: "Failed attempts needing action",
      href: "/admin/orders?status=delivery_failed",
      icon: Truck,
      accent:
        (stats?.deliveryExceptions ?? 0) > 0
          ? "bg-rose-50 text-rose-600 border-rose-200"
          : "bg-gray-50 text-gray-600 border-gray-100",
    },
    {
      label: "Delivery Team",
      value: "Fleet Portal",
      sub: "Manage driver accounts & access",
      href: "/admin/delivery-team",
      icon: Truck,
      accent: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
    {
      label: "Unread Alerts",
      value: stats?.unreadNotifications ?? 0,
      sub: "Store & order notifications",
      href: "/admin/notifications",
      icon: Bell,
      accent: "bg-indigo-50 text-indigo-600 border-indigo-100",
    },
  ];

  const pipelineStages = [
    { key: "placed", label: "Placed", count: pipelineCounts?.placed ?? 0, href: "/admin/orders?status=placed" },
    { key: "confirmed", label: "Confirmed", count: pipelineCounts?.confirmed ?? 0, href: "/admin/orders?status=confirmed" },
    { key: "packing", label: "Packing", count: pipelineCounts?.packing ?? 0, href: "/admin/orders?status=packing" },
    { key: "ready_for_delivery", label: "Ready", count: pipelineCounts?.ready_for_delivery ?? 0, href: "/admin/orders?status=ready_for_delivery" },
    { key: "out_for_delivery", label: "Out for Delivery", count: pipelineCounts?.out_for_delivery ?? 0, href: "/admin/orders?status=out_for_delivery" },
    { key: "delivered", label: "Delivered", count: pipelineCounts?.delivered ?? 0, href: "/admin/orders?status=delivered" },
    { key: "delivery_failed", label: "Failed", count: pipelineCounts?.delivery_failed ?? 0, href: "/admin/orders?status=delivery_failed", danger: true },
  ];

  const attention = todayStats?.attention || {};
  const inProgress = todayStats?.inProgress || {};
  const completedToday = todayStats?.completedToday || {};

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <AdminHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-900">
              Sri Usha Operations Dashboard
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Live Neon PostgreSQL store metrics, fulfillment workflow, and customer order operations
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs disabled:opacity-60"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Refreshing..." : "Refresh Live Data"}</span>
            </button>
            <a
              href="/admin/analytics"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0066CC] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0052A3]"
            >
              <BarChart3 size={14} />
              <span>Full Analytics</span>
            </a>
          </div>
        </div>

        {/* Clickable KPI Cards */}
        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <a
                  key={card.label}
                  href={card.href}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs transition-all hover:border-[#0066CC]/40 hover:shadow-md flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        {card.label}
                      </p>
                      <p className="mt-2 text-2xl font-black text-gray-900 tabular-nums">
                        {loading ? "—" : card.value}
                      </p>
                    </div>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${card.accent}`}
                    >
                      <Icon size={18} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-gray-500">
                    <span>{card.sub}</span>
                    <ArrowRight
                      size={13}
                      className="text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#0066CC]"
                    />
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* Today at Sri Usha */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-gray-900">
              Today at Sri Usha
            </h2>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Real-Time Operations Center
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Requires Attention */}
            <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-2 text-sm font-extrabold text-rose-800">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  Requires Attention
                </span>
                <AlertTriangle size={16} className="text-rose-500" />
              </div>

              <div className="space-y-2.5 text-xs">
                <a
                  href="/admin/orders?status=delivery_failed"
                  className="flex items-center justify-between rounded-xl bg-rose-50/70 px-3.5 py-2.5 font-semibold text-rose-900 hover:bg-rose-100/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Truck size={14} /> Failed Deliveries
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-rose-700 border border-rose-200">
                    {attention.failedDeliveriesCount ?? 0}
                  </span>
                </a>

                <a
                  href="/admin/products?low_stock=true"
                  className="flex items-center justify-between rounded-xl bg-amber-50/70 px-3.5 py-2.5 font-semibold text-amber-900 hover:bg-amber-100/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Package size={14} /> Low Stock Products (&le;5)
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-amber-700 border border-amber-200">
                    {attention.lowStockCount ?? 0}
                  </span>
                </a>

                <a
                  href="/admin/orders"
                  className="flex items-center justify-between rounded-xl bg-gray-50 px-3.5 py-2.5 font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard size={14} /> Pending / Failed Online Payments
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-gray-800 border border-gray-200">
                    {attention.paymentIssuesCount ?? 0}
                  </span>
                </a>

                <a
                  href="/admin/prescriptions"
                  className="flex items-center justify-between rounded-xl bg-purple-50/70 px-3.5 py-2.5 font-semibold text-purple-900 hover:bg-purple-100/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    Pending Prescriptions
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-purple-700 border border-purple-200">
                    {attention.pendingPrescriptionsCount ?? 0}
                  </span>
                </a>

                <a
                  href="/admin/reviews"
                  className="flex items-center justify-between rounded-xl bg-blue-50/70 px-3.5 py-2.5 font-semibold text-blue-900 hover:bg-blue-100/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    Reviews Pending Moderation
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-blue-700 border border-blue-200">
                    {attention.pendingReviewsCount ?? 0}
                  </span>
                </a>

                <a
                  href="/admin/operations"
                  className="flex items-center justify-between rounded-xl bg-indigo-50/70 px-3.5 py-2.5 font-semibold text-indigo-900 hover:bg-indigo-100/70 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    Customer Support Requests
                  </span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-indigo-700 border border-indigo-200">
                    {attention.openSupportCount ?? 0}
                  </span>
                </a>

                {attention.lowStockItems?.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-[11px] font-bold text-gray-500 mb-1.5">
                      Lowest Stock Items:
                    </p>
                    <ul className="space-y-1">
                      {attention.lowStockItems.slice(0, 3).map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between text-[11px] text-gray-700"
                        >
                          <span className="truncate pr-2">{item.name}</span>
                          <span className="font-bold text-rose-600 shrink-0">
                            {item.stock_quantity} left
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* In Progress */}
            <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-2 text-sm font-extrabold text-amber-800">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  In Progress
                </span>
                <Clock size={16} className="text-amber-500" />
              </div>

              <div className="space-y-2.5 text-xs">
                <a
                  href="/admin/orders?status=placed"
                  className="flex items-center justify-between rounded-xl bg-blue-50/70 px-3.5 py-2.5 font-semibold text-blue-900 hover:bg-blue-100/70 transition-colors"
                >
                  <span>Placed &amp; Confirmed</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-blue-700 border border-blue-200">
                    {inProgress.placedAndConfirmed ?? 0}
                  </span>
                </a>

                <a
                  href="/admin/orders?status=packing"
                  className="flex items-center justify-between rounded-xl bg-amber-50/70 px-3.5 py-2.5 font-semibold text-amber-900 hover:bg-amber-100/70 transition-colors"
                >
                  <span>Packing in Store</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-amber-700 border border-amber-200">
                    {inProgress.packing ?? 0}
                  </span>
                </a>

                <a
                  href="/admin/orders?status=ready_for_delivery"
                  className="flex items-center justify-between rounded-xl bg-purple-50/70 px-3.5 py-2.5 font-semibold text-purple-900 hover:bg-purple-100/70 transition-colors"
                >
                  <span>Ready for Pickup / Dispatch</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-purple-700 border border-purple-200">
                    {inProgress.readyForDelivery ?? 0}
                  </span>
                </a>

                <a
                  href="/admin/orders?status=out_for_delivery"
                  className="flex items-center justify-between rounded-xl bg-indigo-50/70 px-3.5 py-2.5 font-semibold text-indigo-900 hover:bg-indigo-100/70 transition-colors"
                >
                  <span>Out for Delivery</span>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-black text-indigo-700 border border-indigo-200">
                    {inProgress.outForDelivery ?? 0}
                  </span>
                </a>
              </div>
            </div>

            {/* Completed Today */}
            <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-2 text-sm font-extrabold text-emerald-800">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Completed Today
                </span>
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>

              <div className="space-y-3">
                <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                    Verified Revenue Today
                  </p>
                  <p className="mt-1 text-2xl font-black text-emerald-900 tabular-nums">
                    {formatCurrency(completedToday.revenueToday || 0)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href="/admin/orders?status=delivered"
                    className="rounded-xl border border-gray-200 bg-gray-50 p-3 hover:border-emerald-300 transition-colors"
                  >
                    <p className="text-[11px] font-bold text-gray-500">
                      Delivered Today
                    </p>
                    <p className="mt-1 text-xl font-black text-gray-900 tabular-nums">
                      {completedToday.deliveredToday ?? 0}
                    </p>
                  </a>

                  <a
                    href="/admin/orders"
                    className="rounded-xl border border-gray-200 bg-gray-50 p-3 hover:border-blue-300 transition-colors"
                  >
                    <p className="text-[11px] font-bold text-gray-500">
                      Placed Today
                    </p>
                    <p className="mt-1 text-xl font-black text-gray-900 tabular-nums">
                      {completedToday.ordersPlacedToday ?? 0}
                    </p>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Order Operations Pipeline */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">
                Order Operations Workflow
              </h2>
              <p className="text-xs text-gray-500">
                Click any stage to filter and process orders in that state
              </p>
            </div>
            <a
              href="/admin/orders"
              className="text-xs font-bold text-[#0066CC] hover:underline inline-flex items-center gap-1"
            >
              Open Full Order Console <ArrowRight size={13} />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {pipelineStages.map((stage) => (
              <a
                key={stage.key}
                href={stage.href}
                className={`rounded-xl border p-3 text-center transition-all hover:shadow-sm ${
                  stage.danger && stage.count > 0
                    ? "border-rose-200 bg-rose-50/70 hover:border-rose-300"
                    : "border-gray-200 bg-[#F8F9FA] hover:border-[#0066CC]/40 hover:bg-white"
                }`}
              >
                <p className="text-xl font-black text-gray-900 tabular-nums">
                  {stage.count}
                </p>
                <p
                  className={`mt-1 text-[11px] font-bold ${
                    stage.danger && stage.count > 0
                      ? "text-rose-700"
                      : "text-gray-600"
                  }`}
                >
                  {stage.label}
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* Recent Orders Table */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">
                Recent Orders
              </h2>
              <p className="text-xs text-gray-500">
                Latest customer orders from Neon PostgreSQL
              </p>
            </div>
            <a
              href="/admin/orders"
              className="text-xs font-bold text-[#0066CC] hover:underline"
            >
              View All Orders →
            </a>
          </div>

          {recentOrders.length === 0 ? (
            <div className="p-10 text-center text-xs font-semibold text-gray-500">
              {loading ? "Loading recent orders..." : "No orders placed yet."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Order</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Items</th>
                    <th className="px-6 py-3">Total</th>
                    <th className="px-6 py-3">Payment</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/70">
                      <td className="px-6 py-3.5 font-extrabold text-gray-900">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-bold text-gray-900">
                          {order.customer_name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {order.customer_email}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-gray-700">
                        {order.item_count} item(s)
                      </td>
                      <td className="px-6 py-3.5 font-black text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-gray-700">
                          {order.payment_method} • {order.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                            STATUS_BADGE_MAP[order.status] ||
                            "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {(order.status || "placed").replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <a
                          href="/admin/orders"
                          className="font-bold text-[#0066CC] hover:underline"
                        >
                          Manage
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
