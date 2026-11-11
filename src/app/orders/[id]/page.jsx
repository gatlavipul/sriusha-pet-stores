import { useState, useEffect } from "react";
import Header from "@/components/Header";
import {
  CheckCircle,
  Package,
  Truck,
  MapPin,
  Clock,
  Printer,
  ShoppingBag,
  CreditCard,
  Banknote,
  ArrowLeft,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import useUser from "@/utils/useUser";

export default function OrderDetailPage({ params }) {
  const { data: user } = useUser();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("confirmed") === "true") {
        setShowConfirmation(true);
      }
    }
  }, []);

  useEffect(() => {
    fetchOrder();
  }, [params.id]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: cancelReason || "Customer cancellation request",
          email: order.customer_email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel order");
      }

      setCancelSuccess("Order successfully cancelled.");
      setShowCancelModal(false);
      fetchOrder();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") return "border-emerald-300 bg-emerald-50 text-emerald-800";
    if (s === "shipped") return "border-indigo-300 bg-indigo-50 text-indigo-800";
    if (s === "packed") return "border-purple-300 bg-purple-50 text-purple-800";
    if (s === "confirmed" || s === "processing") return "border-blue-300 bg-blue-50 text-blue-800";
    if (s === "cancelled") return "border-red-300 bg-red-50 text-red-800";
    return "border-amber-300 bg-amber-50 text-amber-800";
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mx-auto mb-4" />
          <p className="text-xs text-gray-500 font-medium">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Order not found</h2>
          <p className="text-xs text-gray-500 mt-1 mb-6">
            We couldn&apos;t find this order. Please verify the order reference number.
          </p>
          <a
            href="/orders"
            className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-xs"
          >
            Go to My Orders
          </a>
        </div>
      </div>
    );
  }

  const isCancellable = ["pending", "processing", "confirmed"].includes((order.status || "").toLowerCase());
  const orderNumber = order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`;

  // Calculate timeline state
  const s = (order.status || "").toLowerCase();
  const step = s === "delivered" ? 4 : s === "shipped" ? 3 : s === "packed" ? 2 : 1;
  const isCancelled = s === "cancelled";

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#0F172A]">
      <Header />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation links & action */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <a
            href="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#2563EB] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to All Orders</span>
          </a>

          <div className="flex items-center gap-2">
            {isCancellable && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 px-3.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
              >
                <XCircle size={14} />
                <span>Cancel Order</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors"
            >
              <Printer size={14} />
              <span>Print Invoice</span>
            </button>
          </div>
        </div>

        {/* Confirmation Banner */}
        {showConfirmation && (
          <div className="mb-8 rounded-3xl border border-emerald-200 bg-emerald-50/90 p-6 shadow-xs animate-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                <CheckCircle size={26} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-emerald-950">
                  Order Successfully Placed!
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-emerald-800 leading-relaxed">
                  Thank you for shopping with Sri Usha Pet &amp; Vet Stores! Our team in Uppal has received your order and is preparing it for prompt delivery.
                </p>
                <div className="mt-3 text-xs font-bold text-emerald-900">
                  Order Reference: {orderNumber}
                </div>
              </div>
            </div>
          </div>
        )}

        {cancelSuccess && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            {cancelSuccess}
          </div>
        )}

        {/* Order Header Card */}
        <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-6">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Order Receipt &amp; Tax Invoice
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 mt-0.5">
                {orderNumber}
              </h1>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                <Clock size={13} />
                <span>
                  Placed on{" "}
                  {new Date(order.created_at || Date.now()).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${getStatusColor(
                  order.status
                )}`}
              >
                Status: {order.status || "Processing"}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                Payment: {(order.payment_method || "cod").toUpperCase()} ({order.payment_status || "Pending"})
              </span>
            </div>
          </div>

          {/* Cancellation Notice if Cancelled */}
          {isCancelled && (
            <div className="my-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-red-900">This order has been cancelled</h4>
                  <p className="text-xs text-red-700 mt-0.5">
                    Reason: {order.cancellation_reason || "Customer cancelled before dispatch"}
                  </p>
                  {order.payment_status === "refunded" && (
                    <p className="text-xs font-bold text-emerald-800 mt-1">
                      Online payment has been flagged for refund back to your original payment source.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tracking Progress Timeline (if not cancelled) */}
          {!isCancelled && (
            <div className="py-6 border-b border-gray-100">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                Order Timeline
              </div>
              <div className="grid grid-cols-4 text-center text-xs relative">
                <div className="space-y-1">
                  <div
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                      step >= 1 ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    ✓
                  </div>
                  <div className="font-bold text-gray-900">Order Placed</div>
                  <div className="text-[10px] text-gray-400">Received</div>
                </div>

                <div className="space-y-1">
                  <div
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                      step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    2
                  </div>
                  <div className="font-bold text-gray-900">Packed</div>
                  <div className="text-[10px] text-gray-400">Store Prep</div>
                </div>

                <div className="space-y-1">
                  <div
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                      step >= 3 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    3
                  </div>
                  <div className="font-semibold text-gray-600">Dispatched</div>
                  <div className="text-[10px] text-gray-400">Out for delivery</div>
                </div>

                <div className="space-y-1">
                  <div
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full font-bold ${
                      step >= 4 ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    4
                  </div>
                  <div className="font-semibold text-gray-600">Delivered</div>
                  <div className="text-[10px] text-gray-400">At Doorstep</div>
                </div>
              </div>
            </div>
          )}

          {/* Ordered Items List */}
          <div className="py-6 border-b border-gray-100">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Items in this Order
            </div>
            <div className="space-y-4">
              {(order.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 p-1">
                      <img
                        src={
                          item.product_image ||
                          "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=200&q=80"
                        }
                        alt={item.product_name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">
                        {item.product_name}
                      </h4>
                      <p className="text-xs text-gray-500">
                        Qty: {item.quantity} × ₹{parseFloat(item.price).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    ₹{(parseFloat(item.price) * item.quantity).toFixed(0)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer & Shipping Details Grid */}
          <div className="py-6 grid gap-6 sm:grid-cols-2 text-xs border-b border-gray-100">
            <div>
              <div className="font-bold text-gray-400 uppercase tracking-wider mb-2">
                Shipping &amp; Recipient
              </div>
              <p className="font-bold text-gray-900 text-sm">{order.customer_name}</p>
              <p className="text-gray-600 mt-1">{order.customer_phone}</p>
              <p className="text-gray-600">{order.customer_email}</p>
              <div className="mt-2 text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200">
                <div className="flex items-start gap-1.5">
                  <MapPin size={14} className="text-[#EA580C] shrink-0 mt-0.5" />
                  <span>
                    {order.shipping_address}, {order.shipping_city} - {order.shipping_pincode}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-gray-400 uppercase tracking-wider mb-2">
                Payment Breakdown
              </div>
              <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Method</span>
                  <span className="font-bold text-gray-900">
                    {order.payment_method === "cod"
                      ? "Cash on Delivery (COD)"
                      : "Online (Razorpay)"}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Charge</span>
                  <span className="font-bold text-emerald-700">
                    {parseFloat(order.delivery_charge || 0) === 0
                      ? "FREE"
                      : `₹${parseFloat(order.delivery_charge || 0).toFixed(0)}`}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between font-extrabold text-sm text-gray-900">
                  <span>Total Amount</span>
                  <span className="text-base text-[#2563EB]">
                    ₹{parseFloat(order.total_amount).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Support and Store Help */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <div>
              Questions regarding this order? Call Sri Usha Store directly at{" "}
              <a href="tel:+919876543210" className="font-bold text-[#2563EB]">
                +91 98765 43210
              </a>
            </div>
            <a
              href="/products"
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-black transition-colors"
            >
              Continue Shopping
            </a>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Modal for Order Cancellation */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-gray-100">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle size={24} />
              <h3 className="text-base font-extrabold text-gray-900">Cancel Order {orderNumber}?</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Are you sure you wish to cancel this order? Items will be returned to store inventory.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Reason for cancellation (optional):
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Changed mind, ordered wrong item, etc."
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs outline-none focus:border-red-500"
                rows={3}
              />
            </div>

            {cancelError && (
              <div className="mb-4 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-700">
                {cancelError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
