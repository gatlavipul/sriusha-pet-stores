import { useState, useEffect, useCallback } from "react";
import useUser from "@/utils/useUser";
import useAuth from "@/utils/useAuth";
import {
  Truck,
  Phone,
  MapPin,
  CheckCircle,
  Package,
  Clock,
  LogOut,
  Navigation,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Check,
  Store,
} from "lucide-react";

export default function DeliveryPartnerPage() {
  const { data: user, loading: userLoading } = useUser();
  const { signOut } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [isAccessDisabled, setIsAccessDisabled] = useState(false);
  const [driverInfo, setDriverInfo] = useState(null);
  const [activeTab, setActiveTab] = useState("new"); // "new" | "picked_up" | "delivered"
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  // Deliver Confirmation Modal
  const [confirmDeliveredOrder, setConfirmDeliveredOrder] = useState(null);

  // Authenticate & verify role
  const checkAccessAndFetch = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const headers = {};
      if (typeof window !== "undefined" && window.Clerk?.session) {
        try {
          const token = await window.Clerk.session.getToken();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } catch {}
      }

      const accessRes = await fetch("/api/delivery/check-access", { headers });
      const accessData = await accessRes.json();

      if (!accessRes.ok || !accessData.allowed) {
        if (accessData.disabled) {
          setIsAccessDisabled(true);
          setAuthError("Access removed, contact admin");
          setAuthChecking(false);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        // If not logged in, redirect to login
        if (accessRes.status === 401) {
          if (typeof window !== "undefined") {
            window.location.href = "/account/signin?callbackUrl=/delivery";
          }
          return;
        }

        // If normal customer tries to access /delivery, redirect to Home
        if (accessRes.status === 403) {
          if (typeof window !== "undefined") {
            window.location.replace("/");
          }
          return;
        }

        setAuthError(accessData.error || "Access denied. Delivery partner role required.");
        setAuthChecking(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setDriverInfo(accessData.user || null);
      setAuthChecking(false);

      // Fetch assigned orders
      const ordersRes = await fetch("/api/delivery/orders", { headers });
      const ordersData = await ordersRes.json();
      if (ordersRes.ok) {
        setOrders(ordersData.orders || []);
      }
    } catch (err) {
      console.error("Delivery portal fetch error:", err);
      setAuthError("Failed to connect to delivery services. Please retry.");
    } finally {
      setAuthChecking(false);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        if (typeof window !== "undefined") {
          window.location.href = "/account/signin?callbackUrl=/delivery";
        }
      } else {
        checkAccessAndFetch();
      }
    }
  }, [user, userLoading, checkAccessAndFetch]);

  // Status transitions
  const handleMarkPickedUp = async (order) => {
    if (!confirm(`Mark Order #${order.order_number} as Picked Up? This will transition the order to Out for Delivery.`)) {
      return;
    }

    setUpdatingOrderId(order.id);
    try {
      const headers = { "Content-Type": "application/json" };
      if (typeof window !== "undefined" && window.Clerk?.session) {
        const token = await window.Clerk.session.getToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/delivery/orders/${order.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: "out_for_delivery" }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update order status");
        return;
      }

      // Switch to Picked Up tab and refresh
      setActiveTab("picked_up");
      await checkAccessAndFetch(true);
    } catch (err) {
      console.error(err);
      alert("Network error updating order to Picked Up");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleConfirmDeliverOrder = async () => {
    if (!confirmDeliveredOrder) return;
    const order = confirmDeliveredOrder;

    setUpdatingOrderId(order.id);
    try {
      const headers = { "Content-Type": "application/json" };
      if (typeof window !== "undefined" && window.Clerk?.session) {
        const token = await window.Clerk.session.getToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/delivery/orders/${order.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: "delivered" }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to mark order as delivered");
        return;
      }

      setConfirmDeliveredOrder(null);
      setActiveTab("delivered");
      await checkAccessAndFetch(true);
    } catch (err) {
      console.error(err);
      alert("Network error marking order as delivered");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // --- Filter orders by tab ---
  const newOrders = orders.filter((o) =>
    ["assigned", "ready_for_delivery", "packed", "confirmed", "placed"].includes(o.status)
  );
  const pickedUpOrders = orders.filter((o) => o.status === "out_for_delivery");
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  const displayedOrders =
    activeTab === "new"
      ? newOrders
      : activeTab === "picked_up"
      ? pickedUpOrders
      : deliveredOrders;

  // --- Disabled State Screen ---
  if (isAccessDisabled) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#241819] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 sm:p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertTriangle size={36} />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-[#4A0A0F]">
            Access removed, contact admin
          </h1>

          <p className="mt-3 text-xs sm:text-sm text-stone-600 leading-relaxed">
            Your delivery fleet account has been disabled or removed by the store administrator. You no longer have permission to access the delivery portal.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/account/signin" })}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A0A0F] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#360509] min-h-[44px]"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
            <a
              href="/"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 py-3 text-xs font-bold text-stone-700 hover:bg-stone-50 min-h-[44px]"
            >
              <Store size={15} />
              <span>Return to Storefront</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // --- Auth Checking or Loading ---
  if (userLoading || authChecking) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#F97316] border-t-transparent mb-3" />
        <p className="text-xs font-bold text-stone-600">Connecting to Delivery Dispatch...</p>
      </div>
    );
  }

  // --- Auth Error Screen ---
  if (authError) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 text-center shadow-lg">
          <AlertTriangle size={36} className="mx-auto text-amber-500 mb-3" />
          <h2 className="text-lg font-black text-[#4A0A0F]">Access Restricted</h2>
          <p className="mt-2 text-xs text-stone-600 mb-6">{authError}</p>
          <div className="flex flex-col gap-2.5">
            <a
              href="/account/signin?callbackUrl=/delivery"
              className="rounded-xl bg-[#4A0A0F] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#360509] min-h-[44px] flex items-center justify-center"
            >
              Sign In with Delivery Account
            </a>
            <a
              href="/"
              className="rounded-xl border border-stone-200 py-3 text-xs font-bold text-stone-700 hover:bg-stone-50 min-h-[44px] flex items-center justify-center"
            >
              Return to Storefront
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#241819] flex flex-col pb-12">
      {/* Dedicated Delivery Mobile Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#EADBCC] shadow-xs px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#4A0A0F] text-white flex items-center justify-center shrink-0">
              <Truck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black text-[#4A0A0F]">Sri Usha Delivery</span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.2 text-[9px] font-black text-emerald-800 border border-emerald-200 uppercase">
                  Active
                </span>
              </div>
              <p className="text-[11px] font-semibold text-stone-500 truncate max-w-[180px] sm:max-w-xs">
                {driverInfo?.name || driverInfo?.email || user?.name || "Driver"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => checkAccessAndFetch(true)}
              disabled={refreshing}
              className="h-10 w-10 flex items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition-colors shadow-2xs"
              title="Refresh assigned orders"
              aria-label="Refresh assigned orders"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-[#F97316]" : ""} />
            </button>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/account/signin" })}
              className="h-10 px-3 flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white text-rose-600 hover:bg-rose-50 text-xs font-bold transition-colors shadow-2xs"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto w-full px-3 sm:px-4 pt-4 flex-1">
        {/* Navigation Tabs (Mobile-First 3-Segment) */}
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-stone-200/70 p-1 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab("new")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all min-h-[44px] ${
              activeTab === "new"
                ? "bg-[#4A0A0F] text-white shadow-xs"
                : "text-stone-700 hover:text-stone-900"
            }`}
          >
            <span>New</span>
            {newOrders.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  activeTab === "new"
                    ? "bg-[#F97316] text-white"
                    : "bg-stone-300 text-stone-800"
                }`}
              >
                {newOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("picked_up")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all min-h-[44px] ${
              activeTab === "picked_up"
                ? "bg-[#4A0A0F] text-white shadow-xs"
                : "text-stone-700 hover:text-stone-900"
            }`}
          >
            <span>Picked Up</span>
            {pickedUpOrders.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  activeTab === "picked_up"
                    ? "bg-[#F97316] text-white"
                    : "bg-stone-300 text-stone-800"
                }`}
              >
                {pickedUpOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("delivered")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all min-h-[44px] ${
              activeTab === "delivered"
                ? "bg-[#4A0A0F] text-white shadow-xs"
                : "text-stone-700 hover:text-stone-900"
            }`}
          >
            <span>Delivered</span>
            {deliveredOrders.length > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                  activeTab === "delivered"
                    ? "bg-emerald-600 text-white"
                    : "bg-stone-300 text-stone-800"
                }`}
              >
                {deliveredOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* Orders Feed */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-2xl border border-[#EADBCC] bg-white p-4 shadow-xs animate-pulse">
                <div className="h-4 bg-stone-200 rounded-md w-1/3 mb-3" />
                <div className="h-6 bg-stone-200 rounded-md w-1/2 mb-3" />
                <div className="h-12 bg-stone-100 rounded-xl mb-3" />
                <div className="h-10 bg-stone-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : displayedOrders.length === 0 ? (
          <div className="rounded-3xl border border-[#EADBCC] bg-white p-8 text-center shadow-xs">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FAF7F2] text-stone-400">
              <Package size={28} />
            </div>
            <h3 className="text-base font-black text-[#4A0A0F]">
              {activeTab === "new" && "No New Orders Assigned"}
              {activeTab === "picked_up" && "No Orders in Transit"}
              {activeTab === "delivered" && "No Deliveries Completed Yet"}
            </h3>
            <p className="mt-1 text-xs text-stone-500 max-w-xs mx-auto">
              {activeTab === "new" && "When store administrators assign doorstep orders to your account, they will automatically appear here."}
              {activeTab === "picked_up" && "Go to the New tab to mark an assigned order as Picked Up and begin navigation."}
              {activeTab === "delivered" && "Completed doorstep deliveries will be cataloged here with confirmed timestamps."}
            </p>
            <button
              type="button"
              onClick={() => checkAccessAndFetch(true)}
              disabled={refreshing}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-100 min-h-[44px]"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-[#F97316]" : ""} />
              <span>Tap to Refresh Orders</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedOrders.map((order) => {
              const isCOD = order.payment_method === "cod" || order.payment_status !== "paid";
              const isUpdating = updatingOrderId === order.id;

              // Build address string for Google Maps
              const fullAddress = [
                order.shipping_address,
                order.shipping_city,
                order.shipping_pincode ? `Pincode: ${order.shipping_pincode}` : "",
              ].filter(Boolean).join(", ");

              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${order.shipping_address || ""}, ${order.shipping_city || "Hyderabad"}, ${order.shipping_pincode || ""}`
              )}`;

              return (
                <div
                  key={order.id}
                  className="rounded-3xl border border-[#EADBCC] bg-white p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  {/* Top Bar: Order Number & Payment Status */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-stone-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-[#4A0A0F]">
                          {order.order_number}
                        </span>
                        <span className="text-[10px] font-semibold text-stone-400">
                          #{order.id}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                        <Clock size={11} />
                        <span>
                          {order.created_at
                            ? new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "Today"}
                        </span>
                        {order.delivery_distance && (
                          <span className="ml-1 text-stone-400">• {order.delivery_distance} km away</span>
                        )}
                      </p>
                    </div>

                    {/* Payment Mode Badge (Prominent for Driver) */}
                    {isCOD ? (
                      <div className="rounded-xl bg-amber-500/10 border border-amber-300 px-3 py-1.5 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                          Collect COD
                        </p>
                        <p className="text-sm font-black text-amber-950">
                          ₹{Number(order.total_amount).toFixed(0)}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                          Prepaid Online
                        </p>
                        <p className="text-xs font-black text-emerald-900">
                          Do Not Collect Cash
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Customer Information */}
                  <div className="py-3 space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <div className="h-7 w-7 rounded-lg bg-[#4A0A0F]/5 text-[#4A0A0F] flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin size={15} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-stone-900 text-xs sm:text-sm">
                          {order.customer_name}
                        </p>
                        <p className="text-stone-600 mt-0.5 leading-relaxed text-xs">
                          {order.shipping_address || "Address snapshot unavailable"}
                        </p>
                        <p className="text-stone-500 font-semibold text-[11px] mt-0.5">
                          {order.shipping_city} {order.shipping_pincode ? `• ${order.shipping_pincode}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Items Summary */}
                    <div className="flex items-start gap-2 pt-2 border-t border-stone-100">
                      <div className="h-7 w-7 rounded-lg bg-[#F97316]/10 text-[#F97316] flex items-center justify-center shrink-0 mt-0.5">
                        <Package size={15} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                          Package Contents
                        </p>
                        <p className="text-stone-800 font-semibold text-xs mt-0.5 leading-normal">
                          {order.itemsSummary}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons: Strictly >= 44px for ergonomics */}
                  <div className="pt-3 border-t border-stone-100">
                    {activeTab === "new" && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleMarkPickedUp(order)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#4A0A0F] py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#360509] transition-all min-h-[44px] active:scale-[0.99] disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <>
                            <RefreshCw size={16} className="animate-spin" />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <>
                            <Truck size={17} />
                            <span>Mark Picked Up &amp; Start Delivery</span>
                          </>
                        )}
                      </button>
                    )}

                    {activeTab === "picked_up" && (
                      <div className="space-y-2">
                        {/* Quick Contact & Navigation Controls */}
                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={order.customer_phone ? `tel:${order.customer_phone}` : "#"}
                            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors min-h-[44px] text-center"
                          >
                            <Phone size={15} className="text-emerald-700" />
                            <span>Call Customer</span>
                          </a>

                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-blue-300 bg-blue-50 px-3 py-3 text-xs font-bold text-blue-800 shadow-2xs hover:bg-blue-100 transition-colors min-h-[44px] text-center"
                          >
                            <Navigation size={15} className="text-blue-700" />
                            <span>Google Maps</span>
                          </a>
                        </div>

                        {/* Mark Delivered Trigger */}
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => setConfirmDeliveredOrder(order)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-emerald-700 transition-all min-h-[44px] active:scale-[0.99]"
                        >
                          <CheckCircle size={17} />
                          <span>Mark Delivered {isCOD ? `(Collect ₹${Number(order.total_amount).toFixed(0)})` : ""}</span>
                        </button>
                      </div>
                    )}

                    {activeTab === "delivered" && (
                      <div className="flex items-center justify-between text-xs text-stone-600 bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200">
                        <span className="flex items-center gap-1.5 font-bold text-emerald-800">
                          <Check size={15} className="text-emerald-600" />
                          <span>Delivery Completed</span>
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700">
                          {order.delivered_at
                            ? new Date(order.delivered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "Confirmed"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Mark Delivered Confirmation Modal */}
      {confirmDeliveredOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-stone-200 animate-in slide-in-from-bottom-4 sm:zoom-in-95">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle size={28} />
            </div>

            <h3 className="text-center text-lg font-black text-stone-900">
              Confirm Order Delivery
            </h3>
            <p className="mt-1 text-center text-xs text-stone-500">
              Order {confirmDeliveredOrder.order_number}
            </p>

            {/* COD Reminder */}
            {confirmDeliveredOrder.payment_method === "cod" || confirmDeliveredOrder.payment_status !== "paid" ? (
              <div className="my-4 rounded-2xl bg-amber-500/10 border border-amber-300 p-4 text-center">
                <p className="text-xs font-bold text-amber-900 uppercase">
                  Please Confirm Cash Collection:
                </p>
                <p className="text-2xl font-black text-amber-950 mt-1">
                  ₹{Number(confirmDeliveredOrder.total_amount).toFixed(0)}
                </p>
                <p className="text-[11px] text-amber-800 mt-1 font-semibold">
                  Hand over package only after collecting cash from customer.
                </p>
              </div>
            ) : (
              <div className="my-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-center text-xs font-bold text-emerald-800">
                ✓ Order was paid online. No cash collection required.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeliveredOrder(null)}
                className="rounded-xl border border-stone-200 py-3 text-xs font-bold text-stone-700 hover:bg-stone-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeliverOrder}
                className="rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs min-h-[44px]"
              >
                Yes, Delivered
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
