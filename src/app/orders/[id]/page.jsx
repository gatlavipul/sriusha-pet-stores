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
  Mail,
  MessageSquare,
  HelpCircle,
  Send,
  Phone,
  Check,
  X,
  BellOff,
  Zap,
} from "lucide-react";
import useUser from "@/utils/useUser";
import {
  ORDER_STATUS,
  ORDER_STATUS_METADATA,
  CUSTOMER_TIMELINE_STAGES,
  isCancellableByCustomer,
  getStatusBadgeClass,
} from "@/utils/orderWorkflow";

export default function OrderDetailPage({ params }) {
  const { data: user } = useUser();
  const [order, setOrder] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState(null);
  const [cancelSuccess, setCancelSuccess] = useState(null);

  // Customer Support Ticket State
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportCategory, setSupportCategory] = useState("delivery_delay");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportDesc, setSupportDesc] = useState("");
  const [submittingSupport, setSubmittingSupport] = useState(false);
  const [supportFeedback, setSupportFeedback] = useState(null);
  const [ticketList, setTicketList] = useState([]);

  useEffect(() => {
    if (order?.id) {
      fetch(`/api/support?order_id=${order.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setTicketList(d?.tickets || []))
        .catch(() => {});
    }
  }, [order?.id]);

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportDesc.trim()) return;
    setSubmittingSupport(true);
    setSupportFeedback(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.id,
          category: supportCategory,
          subject: supportSubject.trim(),
          description: supportDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit ticket");
      setSupportFeedback({ type: "success", text: `Ticket #${data.ticket?.id} submitted. Our support team will review it promptly.` });
      setSupportSubject("");
      setSupportDesc("");
      const refreshed = await fetch(`/api/support?order_id=${order.id}`).then((r) => r.json());
      setTicketList(refreshed?.tickets || []);
      setTimeout(() => setShowSupportModal(false), 2000);
    } catch (err) {
      setSupportFeedback({ type: "error", text: err.message });
    } finally {
      setSubmittingSupport(false);
    }
  };

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

        // Fetch notifications dispatched for this order
        try {
          const emailParam = data.order?.customer_email ? `?email=${encodeURIComponent(data.order.customer_email)}` : "";
          const notifRes = await fetch(`/api/orders/${params.id}/notifications${emailParam}`);
          if (notifRes.ok) {
            const notifData = await notifRes.json();
            setNotifications(notifData.notifications || []);
          }
        } catch (notifErr) {
          console.error("Failed to load notifications:", notifErr);
        }
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

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4A0A0F] border-t-transparent mx-auto mb-4" />
          <p className="text-xs text-stone-500 font-medium">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FFFDF9]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <Package size={48} className="mx-auto text-stone-300 mb-3" />
          <h2 className="text-lg font-bold text-stone-900">Order not found</h2>
          <p className="text-xs text-stone-500 mt-1 mb-6">
            We couldn&apos;t find this order. Please verify the order reference number.
          </p>
          <a
            href="/orders"
            className="rounded-xl bg-[#4A0A0F] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#360509]"
          >
            Go to My Orders
          </a>
        </div>
      </div>
    );
  }

  const orderNumber = order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`;
  const s = (order.status || "").toLowerCase();
  const isCancelled = s === "cancelled";
  const isFailed = s === "delivery_failed";
  const canCancel = isCancellableByCustomer(s);

  // Active step in 6-stage timeline
  const getTimelineStep = (status) => {
    switch (status) {
      case ORDER_STATUS.PLACED: return 1;
      case ORDER_STATUS.CONFIRMED: return 2;
      case ORDER_STATUS.PACKING: return 3;
      case ORDER_STATUS.READY_FOR_DELIVERY:
      case ORDER_STATUS.ASSIGNED: return 4;
      case ORDER_STATUS.OUT_FOR_DELIVERY: return 5;
      case ORDER_STATUS.DELIVERED: return 6;
      default: return 1;
    }
  };

  const currentStep = getTimelineStep(s);
  const metadata = ORDER_STATUS_METADATA[s] || {
    customerLabel: order.status,
    customerDescription: "Order in progress",
    badgeClass: "bg-stone-100 text-stone-800 border-stone-200",
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819]">
      <Header />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation links & action */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <a
            href="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-[#4A0A0F] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to All Orders</span>
          </a>

          <div className="flex items-center gap-2">
            {canCancel && (
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
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${metadata.badgeClass}`}
              >
                {metadata.customerLabel}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                Payment: {(order.payment_method || "cod").toUpperCase()} ({order.payment_status || "Pending"})
              </span>
              {order.delivery_otp && order.status !== "delivered" && !isCancelled && (
                <span className="rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-3 py-1 text-xs font-extrabold text-[#F97316]">
                  Delivery OTP: {order.delivery_otp}
                </span>
              )}
              {order.gentle_delivery && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                  <BellOff size={13} strokeWidth={1.75} className="text-[#F97316]" />
                  <span>Gentle Delivery: Call instead of bell</span>
                </span>
              )}
            </div>
            {order.delivery_instructions && (
              <p className="mt-2 text-xs text-stone-600">
                <span className="font-bold text-stone-800">Delivery Note:</span> {order.delivery_instructions}
              </p>
            )}
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

          {/* Delivery Exception Alert if Delivery Attempt Failed */}
          {isFailed && (
            <div className="my-6 rounded-2xl border border-amber-300 bg-amber-50/80 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-950">Delivery Attempt Unsuccessful</h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Our delivery partner was unable to complete the delivery on this run ({order.delivery_failure_reason || "Customer unavailable"}).
                  </p>
                  <p className="text-xs text-amber-900 font-semibold mt-1">
                    Don&apos;t worry! Our store dispatch team is reviewing your address and will arrange a re-delivery attempt shortly.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 6-Stage Customer Tracking Progress Timeline (if not cancelled) */}
          {!isCancelled && (
            <div className="py-6 border-b border-stone-100">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Live Order Timeline
                </div>
                <div className="text-xs text-stone-500 font-medium italic">
                  {metadata.customerDescription}
                </div>
              </div>

              {(() => {
                const timelineStages = order.prescription_required
                  ? [
                      CUSTOMER_TIMELINE_STAGES[0],
                      { key: "prescription_review", label: "Rx Review", step: 1.5 },
                      ...CUSTOMER_TIMELINE_STAGES.slice(1),
                    ]
                  : CUSTOMER_TIMELINE_STAGES;
                return (
                  <div className={`grid ${order.prescription_required ? "grid-cols-7" : "grid-cols-6"} text-center text-xs relative gap-1`}>
                    {timelineStages.map((stage, idx) => {
                      const isCompleted = currentStep >= stage.step;
                      const isCurrent = currentStep === stage.step;

                      return (
                        <div key={stage.key} className="space-y-1">
                          <div
                            className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                              isCompleted
                                ? isCurrent
                                  ? "bg-[#F97316] text-white ring-4 ring-orange-100"
                                  : "bg-emerald-600 text-white"
                                : "bg-stone-100 text-stone-400"
                            }`}
                          >
                            {isCompleted && !isCurrent ? <Check size={14} strokeWidth={2.5} /> : idx + 1}
                          </div>
                          <div className={`font-bold text-[11px] leading-tight ${isCompleted ? "text-stone-900" : "text-stone-400"}`}>
                            {stage.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Live Delivery Partner Card (when assigned or out for delivery) */}
          {order.deliveryPartner && (
            <div className="my-6 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4A0A0F] text-white shadow-xs">
                    <Truck size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-stone-900 text-sm">
                        {order.deliveryPartner.name}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FFFDF0] px-2 py-0.5 text-[10px] font-bold uppercase text-[#B45309]">
                        <Zap size={10} className="fill-[#F97316] text-[#F97316]" />
                        <span>Sri Usha Express Rider</span>
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Assigned to deliver your pet care order safely to your doorstep.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {order.deliveryPartner.phone && (
                    <a
                      href={`tel:${order.deliveryPartner.phone}`}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-colors"
                    >
                      <Phone size={14} />
                      <span>Call Rider</span>
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${order.shipping_address || ""}, ${order.shipping_city || "Hyderabad"} ${order.shipping_pincode || ""}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors"
                  >
                    <MapPin size={14} className="text-[#EA580C]" />
                    <span>View Route</span>
                  </a>
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

          {/* Dispatched Notifications & Order Updates */}
          {notifications && notifications.length > 0 && (
            <div className="py-6 border-b border-stone-100">
              <div className="flex items-center justify-between mb-4">
                <div className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={14} className="text-[#F97316]" />
                  <span>Dispatched Notifications &amp; Customer Updates</span>
                </div>
                <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-full">
                  {notifications.length} {notifications.length === 1 ? "Message" : "Messages"} Sent
                </span>
              </div>
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3.5 rounded-2xl border border-stone-100 bg-stone-50/70 hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            notif.channel === "email"
                              ? "bg-amber-100 text-amber-800"
                              : notif.channel === "sms"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {notif.channel === "email" ? (
                            <Mail size={10} />
                          ) : (
                            <MessageSquare size={10} />
                          )}
                          {notif.channel}
                        </span>
                        <span className="text-xs font-bold text-stone-900">{notif.title}</span>
                      </div>
                      <span className="text-[11px] text-stone-400">
                        {new Date(notif.created_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed font-sans">{notif.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer & Shipping Details Grid */}
          <div className="py-6 grid gap-6 sm:grid-cols-2 text-xs border-b border-stone-100">
            <div>
              <div className="font-bold text-stone-400 uppercase tracking-wider mb-2">
                Shipping &amp; Recipient
              </div>
              <p className="font-bold text-stone-900 text-sm">{order.customer_name}</p>
              <p className="text-stone-600 mt-1">{order.customer_phone}</p>
              <p className="text-stone-600">{order.customer_email}</p>
              <div className="mt-2 text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-200">
                <div className="flex items-start gap-1.5">
                  <MapPin size={14} className="text-[#EA580C] shrink-0 mt-0.5" />
                  <span>
                    {order.shipping_address}, {order.shipping_city} - {order.shipping_pincode}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="font-bold text-stone-400 uppercase tracking-wider mb-2">
                Payment Breakdown
              </div>
              <div className="space-y-2 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div className="flex justify-between text-stone-600">
                  <span>Method</span>
                  <span className="font-bold text-stone-900">
                    {order.payment_method === "cod"
                      ? "Cash on Delivery (COD)"
                      : "Online (Razorpay)"}
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Delivery Charge</span>
                  <span className="font-bold text-emerald-700">
                    {parseFloat(order.delivery_charge || 0) === 0
                      ? "FREE"
                      : `₹${parseFloat(order.delivery_charge || 0).toFixed(0)}`}
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-200 flex justify-between font-extrabold text-sm text-stone-900">
                  <span>Total Amount</span>
                  <span className="text-base text-[#4A0A0F]">
                    ₹{parseFloat(order.total_amount).toFixed(0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Support and Store Help */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500 border-t border-stone-100 mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <span>Need help with this order?</span>
              <button
                type="button"
                onClick={() => setShowSupportModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-3.5 py-1.5 text-xs font-bold text-[#F97316] hover:bg-[#FED7AA]/40 transition-colors shadow-2xs"
              >
                <HelpCircle size={14} />
                <span>Report Issue / Support Ticket</span>
              </button>
              <a href="tel:+919876543210" className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-[#F97316]">
                <Phone size={13} strokeWidth={1.75} className="text-[#F97316]" />
                <span>+91 98765 43210</span>
              </a>
            </div>
            <a
              href="/products"
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-black transition-colors"
            >
              Continue Shopping
            </a>
          </div>

          {/* Existing Support Tickets for this Order */}
          {ticketList.length > 0 && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-gray-700">
                  Support Requests on This Order ({ticketList.length})
                </span>
              </div>
              <div className="space-y-2">
                {ticketList.map((t) => (
                  <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-900">
                        #{t.id} — {t.subject}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          t.status === "resolved"
                            ? "bg-emerald-100 text-emerald-800"
                            : t.status === "closed"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {t.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-gray-600 leading-relaxed">{t.description}</p>
                    {t.resolution_notes && (
                      <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-emerald-800 font-medium">
                        <span className="font-bold">Resolution:</span> {t.resolution_notes}
                        {t.refund_amount > 0 && (
                          <span className="block font-bold mt-0.5">
                            Refund Approved: ₹{Number(t.refund_amount).toFixed(0)} ({t.refund_status})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {/* Support / Issue Reporting Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-4">
              <div className="flex items-center gap-2 text-[#F97316]">
                <HelpCircle size={20} />
                <h3 className="text-sm font-extrabold text-stone-900">
                  Report an Issue — Order {orderNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
                aria-label="Close support modal"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Issue Category</label>
                <select
                  value={supportCategory}
                  onChange={(e) => setSupportCategory(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white p-2.5 outline-none focus:border-[#F97316]"
                >
                  <option value="delivery_delay">Delivery Delay / Track Rider</option>
                  <option value="missing_product">Missing Product from Package</option>
                  <option value="wrong_product">Wrong / Incorrect Product Received</option>
                  <option value="damaged_product">Damaged or Leaking Product</option>
                  <option value="payment_issue">Payment or COD Issue</option>
                  <option value="refund_request">Refund Request</option>
                  <option value="other">Other Query</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1 can of wet food missing from package"
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white p-2.5 outline-none focus:border-[#F97316]"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Description</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Please provide details (e.g. batch number, delivery time, damaged item details)..."
                  value={supportDesc}
                  onChange={(e) => setSupportDesc(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white p-2.5 outline-none focus:border-[#F97316]"
                />
              </div>

              {supportFeedback && (
                <div
                  className={`rounded-xl p-3 text-xs font-semibold ${
                    supportFeedback.type === "error"
                      ? "bg-rose-50 border border-rose-200 text-rose-800"
                      : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  }`}
                >
                  {supportFeedback.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  disabled={submittingSupport}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSupport}
                  className="rounded-xl bg-[#4A0A0F] px-5 py-2 text-xs font-bold text-white hover:bg-[#360509] disabled:opacity-50"
                >
                  {submittingSupport ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
