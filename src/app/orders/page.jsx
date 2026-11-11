import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Package, Clock, ArrowRight, ArrowLeft, ChevronRight, ShoppingBag } from "lucide-react";
import useUser from "@/utils/useUser";

export default function OrdersPage() {
  const { data: user, loading: userLoading } = useUser();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") return "border-emerald-300 bg-emerald-50 text-emerald-800";
    if (s === "shipped") return "border-indigo-300 bg-indigo-50 text-indigo-800";
    if (s === "confirmed" || s === "processing") return "border-blue-300 bg-blue-50 text-blue-800";
    if (s === "cancelled") return "border-red-300 bg-red-50 text-red-800";
    return "border-amber-300 bg-amber-50 text-amber-800";
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mx-auto mb-4" />
          <p className="text-xs text-gray-500 font-medium">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#0F172A]">
      <Header />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-gray-200 pb-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            My Orders
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Track and view previous purchases from Sri Usha Pet Stores
          </p>
        </div>

        {!user ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-xs max-w-lg mx-auto">
            <Package size={48} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Please Sign In to View Your Orders
            </h2>
            <p className="text-xs text-gray-500 mb-6 max-w-sm mx-auto">
              Sign in to your Sri Usha account to access your full order history, receipts, and real-time delivery status.
            </p>
            <div className="flex justify-center gap-3">
              <a
                href="/account/signin?callbackUrl=/orders"
                className="rounded-xl bg-[#2563EB] px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8]"
              >
                Sign In
              </a>
              <a
                href="/products"
                className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Browse Products
              </a>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-xs max-w-lg mx-auto">
            <ShoppingBag size={48} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              No orders found yet
            </h2>
            <p className="text-xs text-gray-500 mb-6">
              You haven&apos;t placed any orders yet. Start shopping our genuine pet foods and veterinary care products.
            </p>
            <a
              href="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-6 py-3.5 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8]"
            >
              <span>Explore Products</span>
              <ArrowRight size={15} />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <a
                key={order.id}
                href={`/orders/${order.id}`}
                className="group block rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs hover:border-[#2563EB] hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="text-base font-extrabold text-gray-900 group-hover:text-[#2563EB] transition-colors">
                        Order #{order.id}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status || "Processing"}
                      </span>
                      <span className="rounded-full bg-gray-100 text-gray-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase">
                        {order.payment_method || "COD"}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <Clock size={12} />
                      <span>
                        {new Date(order.created_at || Date.now()).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span>•</span>
                      <span>Delivering to {order.shipping_city || "Hyderabad"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0">
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Total Amount</div>
                      <div className="text-base font-extrabold text-[#2563EB]">
                        ₹{parseFloat(order.total_amount).toFixed(0)}
                      </div>
                    </div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-50 group-hover:bg-[#EFF6FF] group-hover:text-[#2563EB] transition-colors">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
