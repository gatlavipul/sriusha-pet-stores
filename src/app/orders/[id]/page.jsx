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
} from "lucide-react";
import useUser from "@/utils/useUser";

export default function OrderDetailPage({ params }) {
  const { data: user, loading: userLoading } = useUser();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);

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

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") return "border-emerald-300 bg-emerald-50 text-emerald-800";
    if (s === "shipped") return "border-indigo-300 bg-indigo-50 text-indigo-800";
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
            We couldn&apos;t find this order. Please verify the order number.
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

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#0F172A]">
      <Header />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation link */}
        <div className="mb-6 flex items-center justify-between">
          <a
            href="/orders"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#2563EB] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to All Orders</span>
          </a>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors"
          >
            <Printer size={14} />
            <span>Print Invoice</span>
          </button>
        </div>

        {/* Confirmation Banner */}
        {showConfirmation && (
          <div className="mb-8 rounded-3xl border border-emerald-200 bg-emerald-50/80 p-6 shadow-xs animate-in zoom-in-95">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                <CheckCircle size={26} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-emerald-950">
                  Order Successfully Placed!
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-emerald-800 leading-relaxed">
                  Thank you for shopping with Sri Usha Pet &amp; Vet Stores! Our team in Uppal has received your order and is currently preparing it for local dispatch.
                </p>
                <div className="mt-3 text-xs font-bold text-emerald-900">
                  Estimated Delivery: Today or within 24 hours in Hyderabad
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Header Card */}
        <div className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-6">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Order Receipt
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 mt-0.5">
                Order #{order.id}
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

          {/* Tracking Progress Timeline */}
          <div className="py-6 border-b border-gray-100">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Order Timeline
            </div>
            <div className="grid grid-cols-4 text-center text-xs relative">
              <div className="space-y-1">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white font-bold">
                  ✓
                </div>
                <div className="font-bold text-gray-900">Order Placed</div>
                <div className="text-[10px] text-gray-400">Received</div>
              </div>

              <div className="space-y-1">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-bold">
                  2
                </div>
                <div className="font-bold text-gray-900">Packed</div>
                <div className="text-[10px] text-gray-400">Store Prep</div>
              </div>

              <div className="space-y-1">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 font-bold">
                  3
                </div>
                <div className="font-semibold text-gray-600">Dispatched</div>
                <div className="text-[10px] text-gray-400">Out for delivery</div>
              </div>

              <div className="space-y-1">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600 font-bold">
                  4
                </div>
                <div className="font-semibold text-gray-600">Delivered</div>
                <div className="text-[10px] text-gray-400">At Doorstep</div>
              </div>
            </div>
          </div>

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
                        Qty: {item.quantity} × ₹{item.price}
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
                      ? "Cash on Delivery"
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
                  <span>Total Amount Paid / Due</span>
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
              Need assistance with your delivery? Call Sri Usha Store directly at{" "}
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
    </div>
  );
}
