import { useState, useEffect } from "react";
import useUser from "@/utils/useUser";
import {
  Truck,
  Phone,
  MapPin,
  CheckCircle,
  Package,
  Clock,
  LogOut,
  Navigation,
  IndianRupee,
  AlertTriangle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { signOut } from "@auth/create/react";

const FAILURE_REASONS = [
  "Customer unavailable / phone unreachable",
  "Customer requested delivery reschedule",
  "Incorrect or incomplete address",
  "Customer refused package at doorstep",
  "Payment issue / customer does not have cash",
  "Weather / road closure obstruction",
  "Other exception",
];

export default function DeliveryPartnerPage() {
  const { data: user, loading: userLoading } = useUser();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);

  // Failure modal state
  const [failureModalOrder, setFailureModalOrder] = useState(null);
  const [selectedReason, setSelectedReason] = useState(FAILURE_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [submittingFailure, setSubmittingFailure] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      if (typeof window !== "undefined") {
        window.location.href = "/account/signin?callbackUrl=/delivery";
      }
    } else if (!userLoading && user) {
      fetchDeliveryOrders();
    }
  }, [user, userLoading]);

  const fetchDeliveryOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/delivery/orders");
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || "Access denied. Delivery partner role required.");
        setLoading(false);
        return;
      }

      setOrders(data.orders || []);
      setPartner(data.partner || null);
    } catch (err) {
      console.error("Error fetching delivery orders:", err);
      setAuthError("Failed to connect to delivery services.");
    } finally {
      setLoading(false);
    }
  };

  const updateStage = async (orderId, newStatus) => {
    const actionLabel = newStatus === "out_for_delivery" ? "start delivery for" : "mark as delivered";
    if (!confirm(`Are you sure you want to ${actionLabel} this order?`)) return;

    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to update order status");
        return;
      }

      // Refresh list after successful status update
      await fetchDeliveryOrders();
    } catch (err) {
      console.error(err);
      alert("Network error updating order status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReportFailure = async (e) => {
    e.preventDefault();
    if (!failureModalOrder) return;

    const reason = selectedReason === "Other exception" && customReason.trim()
      ? customReason.trim()
      : selectedReason;

    if (!reason || reason.trim().length < 3) {
      alert("Please provide a valid failure reason.");
      return;
    }

    setSubmittingFailure(true);
    try {
      const res = await fetch(`/api/delivery/orders/${failureModalOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "delivery_failed",
          failure_reason: reason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to report delivery failure");
        return;
      }

      setFailureModalOrder(null);
      setSelectedReason(FAILURE_REASONS[0]);
      setCustomReason("");
      await fetchDeliveryOrders();
    } catch (err) {
      console.error(err);
      alert("Network error submitting delivery issue");
    } finally {
      setSubmittingFailure(false);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] p-4">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mb-3" />
        <p className="text-xs font-semibold text-gray-500">Connecting to Delivery Dispatch...</p>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8F9FA] p-4">
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xs">
          <AlertTriangle size={40} className="mx-auto text-amber-500 mb-3" />
          <h1 className="text-lg font-extrabold text-gray-900">Access Restricted</h1>
          <p className="text-xs text-gray-600 mt-2 mb-6">{authError}</p>
          <div className="flex flex-col gap-2">
            <a
              href="/account/signin?callbackUrl=/delivery"
              className="rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
            >
              Sign In with Delivery Account
            </a>
            <a
              href="/"
              className="rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              Return to Store Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  const assignedCount = orders.filter((o) => o.status === "assigned" || o.status === "ready_for_delivery" || o.status === "packed").length;
  const activeCount = orders.filter((o) => o.status === "out_for_delivery").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const failedCount = orders.filter((o) => o.status === "delivery_failed").length;

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "active") return o.status === "out_for_delivery" || o.status === "assigned" || o.status === "ready_for_delivery" || o.status === "packed";
    if (statusFilter === "delivered") return o.status === "delivered";
    if (statusFilter === "failed") return o.status === "delivery_failed";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      {/* Driver Top Bar */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-md shadow-2xs sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs">
              <Truck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-gray-900">Sri Usha Logistics</span>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700 border border-indigo-200">
                  Driver Portal
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                {partner?.name || user?.name} ({partner?.email || user?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchDeliveryOrders}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
              title="Refresh assigned orders"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/account/signin" })}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-amber-900">{assignedCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mt-0.5">
              Assigned
            </div>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-indigo-900">{activeCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 mt-0.5">
              Out for Delivery
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-emerald-900">{deliveredCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mt-0.5">
              Delivered
            </div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 text-center shadow-2xs">
            <div className="text-xl font-extrabold text-rose-900">{failedCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 mt-0.5">
              Exceptions
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2 mb-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-xl px-3.5 py-1.5 transition-all ${
              statusFilter === "all"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            All Orders ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-xl px-3.5 py-1.5 transition-all ${
              statusFilter === "active"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            To Deliver ({assignedCount + activeCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("delivered")}
            className={`rounded-xl px-3.5 py-1.5 transition-all ${
              statusFilter === "delivered"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Delivered ({deliveredCount})
          </button>
          {failedCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("failed")}
              className={`rounded-xl px-3.5 py-1.5 transition-all ${
                statusFilter === "failed"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-white border border-rose-200 text-rose-700 hover:bg-rose-50"
              }`}
            >
              Failed / Issues ({failedCount})
            </button>
          )}
        </div>

        {/* Orders Listing */}
        {filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-sm font-bold text-gray-900">No delivery orders in this view</h2>
            <p className="text-xs text-gray-400 mt-1">
              New customer orders assigned to you by administrators will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const isCOD = order.payment_method === "cod";
              const isPaid = order.payment_status === "paid";
              const isDelivered = order.status === "delivered";
              const isOut = order.status === "out_for_delivery";
              const isFailed = order.status === "delivery_failed";
              const isAssigned = !isOut && !isDelivered && !isFailed;

              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${order.shipping_address}, ${order.shipping_city} ${order.shipping_pincode}`
              )}`;

              return (
                <div
                  key={order.id}
                  className={`rounded-3xl border p-5 shadow-xs transition-all bg-white ${
                    isOut
                      ? "border-indigo-300 ring-2 ring-indigo-500/10"
                      : isFailed
                      ? "border-rose-200 bg-rose-50/20"
                      : isDelivered
                      ? "border-gray-200 opacity-80"
                      : "border-gray-200"
                  }`}
                >
                  {/* Top Bar: Order ID + Status */}
                  <div className="flex items-start justify-between border-b border-gray-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-gray-900">
                          {order.order_number || `Order #${order.id}`}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isDelivered
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : isFailed
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : isOut
                              ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {order.status === "delivery_failed" ? "Delivery Attempt Failed" : order.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Assigned on {new Date(order.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>

                    {/* Payment Badge */}
                    <div className="text-right">
                      {isCOD && !isPaid ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-right">
                          <div className="text-[9px] font-bold uppercase text-red-600">Collect Cash</div>
                          <div className="text-xs font-black text-red-800">
                            ₹{parseFloat(order.total_amount).toFixed(0)}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-right">
                          <div className="text-[9px] font-bold uppercase text-emerald-600">Prepaid</div>
                          <div className="text-xs font-black text-emerald-800">
                            ₹{parseFloat(order.total_amount).toFixed(0)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delivery Failure Alert Box */}
                  {isFailed && (
                    <div className="my-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                      <div className="font-bold flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-rose-600" />
                        <span>Delivery Issue Reported</span>
                      </div>
                      <p className="mt-1 text-[11px] text-rose-700">
                        Reason: <strong className="font-semibold">{order.delivery_failure_reason || "Customer unavailable"}</strong>
                      </p>
                      <p className="text-[10px] text-rose-500 mt-0.5">
                        Awaiting store administrator review. Do not return stock to shelf.
                      </p>
                    </div>
                  )}

                  {/* Customer Contact & Navigation */}
                  <div className="my-4 space-y-2.5 text-xs">
                    <div className="flex items-start gap-2.5 text-gray-800">
                      <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-gray-900">{order.customer_name}</div>
                        <div className="text-gray-600 mt-0.5 leading-relaxed">
                          {order.shipping_address}, {order.shipping_city} - {order.shipping_pincode}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {order.customer_phone && (
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 hover:border-[#2563EB] hover:text-[#2563EB] shadow-2xs"
                        >
                          <Phone size={13} className="text-[#2563EB]" />
                          <span>Call Customer: {order.customer_phone}</span>
                        </a>
                      )}
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-800 hover:border-emerald-600 hover:text-emerald-700 shadow-2xs"
                      >
                        <Navigation size={13} className="text-emerald-600" />
                        <span>Open in Maps</span>
                      </a>
                    </div>
                  </div>

                  {/* Items Preview */}
                  {order.items && order.items.length > 0 && (
                    <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3 mb-4 text-xs">
                      <div className="font-bold text-gray-700 mb-1.5">Package Contents ({order.items.length} items):</div>
                      <div className="space-y-1 text-gray-600 text-[11px]">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {item.quantity} × {item.product_name}
                            </span>
                            <span className="font-semibold text-gray-800">
                              ₹{(item.quantity * parseFloat(item.price)).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stage Action Button */}
                  <div className="pt-2">
                    {isAssigned && (
                      <button
                        type="button"
                        disabled={updatingId === order.id}
                        onClick={() => updateStage(order.id, "out_for_delivery")}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        <Truck size={15} />
                        <span>Start Delivery (Out for Delivery)</span>
                      </button>
                    )}

                    {isOut && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => updateStage(order.id, "delivered")}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                          <CheckCircle size={16} />
                          <span>
                            {isCOD && !isPaid
                              ? `Confirm Cash Received (₹${parseFloat(order.total_amount).toFixed(0)}) & Mark Delivered`
                              : "Confirm Package Delivered"}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={updatingId === order.id}
                          onClick={() => {
                            setFailureModalOrder(order);
                            setSelectedReason(FAILURE_REASONS[0]);
                            setCustomReason("");
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all"
                        >
                          <AlertTriangle size={14} />
                          <span>Report Delivery Issue / Unable to Deliver</span>
                        </button>
                      </div>
                    )}

                    {isDelivered && (
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 py-2 rounded-xl border border-emerald-200">
                        <CheckCircle size={15} />
                        <span>Delivery Completed &amp; Verified</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Report Delivery Issue Modal */}
      {failureModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle size={20} />
                <h3 className="font-extrabold text-sm text-gray-900">Report Delivery Issue</h3>
              </div>
              <button
                type="button"
                onClick={() => setFailureModalOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReportFailure} className="mt-4 space-y-4">
              <p className="text-xs text-gray-600">
                Please state why <span className="font-bold text-gray-900">{failureModalOrder.order_number}</span> could not be delivered to <span className="font-bold text-gray-900">{failureModalOrder.customer_name}</span>. The store admin will be alerted.
              </p>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                  Reason for Exception
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-800 focus:border-rose-500 focus:outline-none"
                >
                  {FAILURE_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {selectedReason === "Other exception" && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Describe Issue
                  </label>
                  <textarea
                    rows={3}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Provide details about why the delivery attempt failed..."
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-xs text-gray-800 focus:border-rose-500 focus:outline-none"
                    required
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFailureModalOrder(null)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFailure}
                  className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
                >
                  {submittingFailure ? "Submitting..." : "Submit Exception"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

