import { useState, useEffect } from "react";
import AdminHeader from "@/components/AdminHeader";
import useUser from "@/utils/useUser";
import {
  BarChart3,
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Package,
  Calendar,
  CreditCard,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";

export default function AdminAnalyticsPage() {
  const { data: user, loading: userLoading } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");

  useEffect(() => {
    if (!userLoading && !user) {
      if (typeof window !== "undefined") {
        window.location.href = "/account/signin?callbackUrl=/admin/analytics";
      }
    } else if (!userLoading && user) {
      fetchAnalytics();
    }
  }, [user, userLoading, range]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/analytics?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <AdminHeader />
        <div className="py-20 text-center text-xs text-gray-500 font-semibold">
          Verifying administrator permissions...
        </div>
      </div>
    );
  }

  const overview = data?.overview || {};
  const paymentStats = data?.paymentStats || { cod: { count: 0, revenue: 0 }, online: { count: 0, revenue: 0 } };
  const statusCounts = data?.statusCounts || {};
  const topProducts = data?.topProducts || [];
  const lowStock = data?.lowStockProducts || [];
  const dailySales = data?.dailySales || [];

  const totalPaidRevenue = overview.totalRevenue || 0;
  const totalPaymentRevenue = paymentStats.cod.revenue + paymentStats.online.revenue;
  const onlinePct = totalPaymentRevenue > 0 ? Math.round((paymentStats.online.revenue / totalPaymentRevenue) * 100) : 0;
  const codPct = totalPaymentRevenue > 0 ? 100 - onlinePct : 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <AdminHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header & Range Filter */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Store Business Analytics &amp; Performance
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Verified sales metrics, payment channel distribution, and doorstep delivery success rates
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white rounded-xl border border-gray-200 p-1 shadow-2xs text-xs font-bold">
              {[
                { key: "today", label: "Today" },
                { key: "7d", label: "7 Days" },
                { key: "30d", label: "30 Days" },
                { key: "this_month", label: "This Month" },
                { key: "all", label: "All Time" },
              ].map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={`rounded-lg px-3 py-1.5 transition-all ${
                    range === r.key
                      ? "bg-gray-900 text-white shadow-2xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={fetchAnalytics}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-2xs"
              title="Refresh Analytics"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto mb-3" />
            <p className="text-xs text-gray-500 font-semibold">Computing business metrics on server...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top 4 KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Net Verified Revenue
                    </span>
                    <div className="text-2xl font-black text-gray-900 mt-1">
                      ₹{totalPaidRevenue.toLocaleString("en-IN")}
                    </div>
                    <p className="text-[11px] text-emerald-600 font-bold mt-1">
                      Excludes cancelled &amp; uncollected COD
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                    <IndianRupee size={22} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Paid Orders Count
                    </span>
                    <div className="text-2xl font-black text-gray-900 mt-1">
                      {overview.paidOrdersCount || 0}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Out of {overview.totalOrdersInRange || 0} total placed orders
                    </p>
                  </div>
                  <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                    <ShoppingBag size={22} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Average Order Value (AOV)
                    </span>
                    <div className="text-2xl font-black text-gray-900 mt-1">
                      ₹{(overview.averageOrderValue || 0).toLocaleString("en-IN")}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">Per completed order</p>
                  </div>
                  <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
                    <TrendingUp size={22} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      Delivery Success Rate
                    </span>
                    <div className="text-2xl font-black text-gray-900 mt-1">
                      {overview.deliverySuccessRate}%
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {overview.deliveredCount || 0} delivered vs {overview.failedCount || 0} exceptions
                    </p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                    <Truck size={22} />
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Grid: Payment Breakdown & Status Distribution */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Payment Methods */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4 font-bold text-gray-900">
                  <CreditCard size={18} className="text-indigo-600" />
                  <h2 className="text-sm">Payment Gateway Distribution</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                      <span>Online Prepaid (Razorpay / UPI)</span>
                      <span>₹{paymentStats.online.revenue.toLocaleString("en-IN")} ({onlinePct}%)</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 transition-all duration-500"
                        style={{ width: `${onlinePct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{paymentStats.online.count} verified transactions</p>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                      <span>Cash on Delivery (COD)</span>
                      <span>₹{paymentStats.cod.revenue.toLocaleString("en-IN")} ({codPct}%)</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-500"
                        style={{ width: `${codPct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{paymentStats.cod.count} delivered cash settlements</p>
                  </div>
                </div>
              </div>

              {/* Order Status Distribution */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2 mb-4 font-bold text-gray-900">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <h2 className="text-sm">Order Fulfillment Lifecycle Counts</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                  {[
                    { key: "placed", label: "Placed", count: statusCounts["placed"] || 0, bg: "bg-blue-50 text-blue-900" },
                    { key: "confirmed", label: "Confirmed", count: statusCounts["confirmed"] || 0, bg: "bg-cyan-50 text-cyan-900" },
                    { key: "packing", label: "Packing", count: statusCounts["packing"] || 0, bg: "bg-purple-50 text-purple-900" },
                    { key: "ready_for_delivery", label: "Ready", count: statusCounts["ready_for_delivery"] || 0, bg: "bg-indigo-50 text-indigo-900" },
                    { key: "assigned", label: "Driver Assigned", count: statusCounts["assigned"] || 0, bg: "bg-amber-50 text-amber-900" },
                    { key: "out_for_delivery", label: "Out for Delivery", count: statusCounts["out_for_delivery"] || 0, bg: "bg-orange-50 text-orange-900" },
                    { key: "delivered", label: "Delivered", count: statusCounts["delivered"] || 0, bg: "bg-emerald-50 text-emerald-900 font-extrabold" },
                    { key: "delivery_failed", label: "Exceptions", count: statusCounts["delivery_failed"] || 0, bg: "bg-rose-50 text-rose-900" },
                  ].map((s) => (
                    <div key={s.key} className={`rounded-xl p-2.5 ${s.bg}`}>
                      <div className="text-lg font-black">{s.count}</div>
                      <div className="text-[10px] font-bold uppercase mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Grid: Best Sellers & Low Stock Inventory */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Top Selling Products */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 font-bold text-gray-900">
                    <Package size={18} className="text-[#2563EB]" />
                    <h2 className="text-sm">Best-Selling Products ({range})</h2>
                  </div>
                  <a href="/admin/products" className="text-xs font-bold text-indigo-600 hover:underline">
                    View Catalog →
                  </a>
                </div>

                {topProducts.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">No product sales in this period.</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs border-b border-gray-100 pb-2.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.product_image || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=100&q=80"}
                            alt={p.product_name}
                            className="h-10 w-10 rounded-lg object-contain bg-gray-50 border p-1"
                          />
                          <div>
                            <div className="font-bold text-gray-900">{p.product_name}</div>
                            <div className="text-[10px] text-gray-400">Sold: {p.total_sold} units</div>
                          </div>
                        </div>
                        <div className="text-right font-extrabold text-gray-900">
                          ₹{p.total_revenue.toLocaleString("en-IN")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Low Stock Alerts */}
              <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <AlertTriangle size={18} className="text-amber-600" />
                    <h2 className="text-sm">Low-Stock Inventory Warnings</h2>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    ≤ 5 Units Left
                  </span>
                </div>

                {lowStock.length === 0 ? (
                  <p className="text-xs text-gray-400 py-6 text-center">All inventory is adequately stocked.</p>
                ) : (
                  <div className="space-y-3">
                    {lowStock.map((prod) => (
                      <div key={prod.id} className="flex items-center justify-between text-xs border-b border-gray-100 pb-2.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <img
                            src={prod.image_url || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=100&q=80"}
                            alt={prod.name}
                            className="h-10 w-10 rounded-lg object-contain bg-gray-50 border p-1"
                          />
                          <div>
                            <div className="font-bold text-gray-900">{prod.name}</div>
                            <div className="text-[10px] text-gray-400">Price: ₹{parseFloat(prod.price).toFixed(0)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-lg px-2 py-0.5 text-xs font-black ${
                              prod.stock_quantity === 0
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {prod.stock_quantity === 0 ? "Out of Stock" : `${prod.stock_quantity} left`}
                          </span>
                          <a
                            href={`/admin/products?id=${prod.id}`}
                            className="p-1 text-gray-400 hover:text-indigo-600"
                            title="Restock Product"
                          >
                            <ArrowUpRight size={14} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

