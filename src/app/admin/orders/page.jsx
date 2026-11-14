import { useState, useEffect, useCallback } from "react";
import AdminHeader from "@/components/AdminHeader";
import {
  Eye,
  Search,
  Filter,
  ShoppingBag,
  CheckCircle,
  Clock,
  Truck,
  Package,
  XCircle,
  AlertTriangle,
  UserCheck,
  Check,
  X,
} from "lucide-react";
import { useAdminAccess, AdminAccessRestricted, AdminAuthChecking } from "@/components/AdminAccessGuard";

export default function AdminOrdersPage() {
  const { status: adminStatus, role: adminRole, email: adminEmail } = useAdminAccess("/admin/orders");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("status") || "all";
    }
    return "all";
  });
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [cancelReason, setCancelReason] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState("");

  useEffect(() => {
    if (adminStatus === "authorized") {
      fetchOrders();
    }
  }, [adminStatus]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (paymentFilter !== "all") params.set("payment_status", paymentFilter);

      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter, paymentFilter]);

  useEffect(() => {
    if (adminStatus === "authorized") {
      const timer = setTimeout(() => {
        fetchOrders();
      }, searchQuery ? 300 : 0);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, statusFilter, paymentFilter, adminStatus, fetchOrders]);

  const openOrderModal = async (order) => {
    setSelectedOrder(order);
    setSelectedPartnerId(order.assigned_delivery_partner_id ? String(order.assigned_delivery_partner_id) : "");
    setCancelReason(order.cancellation_reason || "");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`);
      const data = await res.json();
      if (data.order) {
        setSelectedOrder(data.order);
        setOrderHistory(data.order.history || []);
        setDeliveryPartners(data.deliveryPartners || []);
        if (data.order.assigned_delivery_partner_id) {
          setSelectedPartnerId(String(data.order.assigned_delivery_partner_id));
        }
      }
    } catch (err) {
      console.error("Error fetching order details:", err);
    }
  };

  const updateOrderStatus = async (orderId, newStatus, newPaymentStatus = undefined) => {
    setUpdatingStatus(true);
    try {
      const payload = { status: newStatus };
      if (newPaymentStatus) payload.payment_status = newPaymentStatus;
      if (newStatus === "cancelled") payload.cancellation_reason = cancelReason || "Cancelled by store administrator";

      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update order");
      }

      await fetchOrders();
      // Re-fetch order modal data
      await openOrderModal({ id: orderId });
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to update order status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignDeliveryPartner = async () => {
    if (!selectedOrder) return;
    setUpdatingStatus(true);
    try {
      const partnerId = selectedPartnerId ? parseInt(selectedPartnerId, 10) : null;
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_delivery_partner_id: partnerId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign partner");
      }

      await fetchOrders();
      await openOrderModal({ id: selectedOrder.id });
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to assign partner");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (s === "out_for_delivery") return "bg-indigo-50 text-indigo-800 border-indigo-200";
    if (s === "delivery_failed") return "bg-rose-50 text-rose-800 border-rose-200";
    if (s === "assigned") return "bg-cyan-50 text-cyan-800 border-cyan-200";
    if (s === "ready_for_delivery") return "bg-purple-50 text-purple-800 border-purple-200";
    if (s === "packing") return "bg-amber-50 text-amber-800 border-amber-200";
    if (s === "confirmed") return "bg-blue-50 text-blue-800 border-blue-200";
    if (s === "cancelled") return "bg-red-50 text-red-800 border-red-200";
    return "bg-gray-50 text-gray-800 border-gray-200";
  };

  if (adminStatus === "checking" || adminStatus === "unauthenticated") {
    return <AdminAuthChecking />;
  }

  if (adminStatus === "forbidden") {
    return <AdminAccessRestricted role={adminRole} email={adminEmail} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <AdminHeader />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
              Orders Management &amp; Fulfillment
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Track lifecycle, assign delivery drivers, and process customer shipments
            </p>
          </div>
          <div className="text-xs font-bold text-gray-600 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-2xs">
            Showing {orders.length} order(s)
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mb-6 grid gap-3 sm:grid-cols-12 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
          <div className="relative sm:col-span-6">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order ref (SU-...), customer name, phone, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-xs outline-none focus:border-[#2563EB]"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-2 px-3 text-xs outline-none focus:border-[#2563EB] bg-white font-medium"
            >
              <option value="all">All Stages</option>
              <option value="placed">Placed</option>
              <option value="confirmed">Confirmed</option>
              <option value="packing">Being Packed</option>
              <option value="ready_for_delivery">Ready for Delivery</option>
              <option value="assigned">Assigned to Driver</option>
              <option value="out_for_delivery">Out for Delivery</option>
              <option value="delivery_failed">Delivery Attempt Failed</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full rounded-xl border border-gray-300 py-2 px-3 text-xs outline-none focus:border-[#2563EB] bg-white font-medium"
            >
              <option value="all">All Payment States</option>
              <option value="pending">Pending Payment (COD)</option>
              <option value="paid">Paid (Online / Verified)</option>
              <option value="failed">Failed Payment</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingBag size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-bold text-gray-900">No matching orders found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/70">
                  <tr>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Order Ref</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Customer</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Contact &amp; City</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Assigned Driver</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Stage</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Payment</th>
                    <th className="p-3.5 text-right font-bold uppercase tracking-wider text-gray-500">Amount</th>
                    <th className="p-3.5 text-right font-bold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3.5 font-extrabold text-gray-900 whitespace-nowrap">
                        {order.order_number || `SU-2026-${String(order.id).padStart(4, "0")}`}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-gray-900">{order.customer_name}</div>
                        <div className="text-[10px] text-gray-400">{order.customer_email}</div>
                      </td>
                      <td className="p-3.5 text-gray-700">
                        <div className="font-semibold">{order.customer_phone}</div>
                        <div className="text-[10px] text-gray-500 truncate max-w-[180px]" title={order.shipping_address}>
                          {order.shipping_city}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {order.delivery_partner_name ? (
                          <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
                            <Truck size={13} />
                            <span>{order.delivery_partner_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold uppercase text-gray-800">{order.payment_method}</div>
                        <span
                          className={`inline-block text-[10px] font-bold uppercase ${
                            order.payment_status === "paid"
                              ? "text-emerald-700"
                              : order.payment_status === "refunded"
                              ? "text-indigo-700"
                              : "text-amber-700"
                          }`}
                        >
                          {order.payment_status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-extrabold text-gray-900 whitespace-nowrap">
                        ₹{parseFloat(order.total_amount).toFixed(0)}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => openOrderModal(order)}
                          className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:border-[#2563EB] hover:text-[#2563EB] shadow-2xs"
                        >
                          <Eye size={13} />
                          <span>View &amp; Manage</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Order Detail & Status Management Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between border-b border-gray-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Order Management
                </span>
                <h2 className="text-xl font-extrabold text-gray-900">
                  {selectedOrder.order_number || `Order #${selectedOrder.id}`}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Placed on {new Date(selectedOrder.created_at).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 text-sm font-bold"
                aria-label="Close modal"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="space-y-6 text-xs">
              {/* Customer Information */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                <h3 className="mb-2 font-bold text-gray-900">Customer &amp; Shipping</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-gray-700">
                  <div>
                    <span className="text-gray-400">Name:</span> <span className="font-semibold">{selectedOrder.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Phone:</span> <span className="font-semibold">{selectedOrder.customer_phone}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-gray-400">Email:</span> <span className="font-semibold">{selectedOrder.customer_email}</span>
                  </div>
                  <div className="sm:col-span-2 mt-1">
                    <span className="text-gray-400">Address:</span>{" "}
                    <span className="font-semibold">{selectedOrder.shipping_address}, {selectedOrder.shipping_city} - {selectedOrder.shipping_pincode}</span>
                  </div>
                </div>
              </div>

              {/* Delivery Partner Assignment */}
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
                <div className="flex items-center gap-2 mb-2 font-bold text-indigo-950">
                  <Truck size={16} className="text-indigo-600" />
                  <span>Assign Delivery Partner</span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="flex-1 rounded-xl border border-indigo-200 bg-white p-2 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-600"
                  >
                    <option value="">-- No Partner Assigned --</option>
                    {deliveryPartners.map((dp) => (
                      <option key={dp.id} value={dp.id}>
                        {dp.name || dp.email} ({dp.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={handleAssignDeliveryPartner}
                    className="rounded-xl bg-indigo-600 px-4 py-2 font-bold text-white hover:bg-indigo-700 shadow-xs disabled:opacity-50"
                  >
                    Assign Driver
                  </button>
                </div>
              </div>

              {/* Order Items */}
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 font-bold text-gray-900">Ordered Items ({selectedOrder.items.length})</h3>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between border-b border-gray-100 pb-2.5 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.product_image || "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=200&q=80"}
                            alt={item.product_name}
                            className="h-10 w-10 rounded-lg object-contain bg-gray-50 border border-gray-100 p-1"
                          />
                          <div>
                            <div className="font-bold text-gray-900">{item.product_name}</div>
                            <div className="text-[11px] text-gray-500">Qty: {item.quantity} × ₹{parseFloat(item.price).toFixed(0)}</div>
                          </div>
                        </div>
                        <div className="font-extrabold text-gray-900">
                          ₹{(item.quantity * parseFloat(item.price)).toFixed(0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Exception Banner if Failed */}
              {selectedOrder.status === "delivery_failed" && (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 font-bold text-rose-900">
                    <AlertTriangle size={18} className="text-rose-600" />
                    <span className="text-sm">Delivery Exception Alert</span>
                  </div>
                  <p className="mt-2 text-xs text-rose-800 leading-relaxed">
                    <strong>Reported Failure Reason:</strong>{" "}
                    <span className="font-semibold">{selectedOrder.delivery_failure_reason || "Driver could not reach customer"}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-rose-600">
                    Stock is currently retained with the package. As administrator, you can re-dispatch with a driver, return the package to the staging counter, or cancel and restock the order.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => updateOrderStatus(selectedOrder.id, "assigned")}
                      className="rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
                    >
                      Re-assign &amp; Retry Delivery
                    </button>
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => updateOrderStatus(selectedOrder.id, "ready_for_delivery")}
                      className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-purple-700 shadow-xs"
                    >
                      Return to Ready for Delivery
                    </button>
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => updateOrderStatus(selectedOrder.id, "cancelled")}
                      className="rounded-xl bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 shadow-xs"
                    >
                      Cancel Order &amp; Restock
                    </button>
                  </div>
                </div>
              )}

              {/* Status Workflow Selector */}
              <div className="rounded-2xl border border-gray-200 bg-blue-50/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900">Update Fulfillment Lifecycle Stage</h3>
                  <span className="text-[11px] text-gray-500">
                    Current: <span className="font-bold uppercase text-[#2563EB]">{selectedOrder.status}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    "placed",
                    "confirmed",
                    "packing",
                    "ready_for_delivery",
                    "assigned",
                    "out_for_delivery",
                    "delivered",
                  ].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => updateOrderStatus(selectedOrder.id, st)}
                      disabled={updatingStatus || selectedOrder.status === st}
                      className={`rounded-xl px-3 py-1.5 font-bold uppercase text-[11px] transition-all ${
                        selectedOrder.status === st
                          ? "bg-[#2563EB] text-white shadow-xs"
                          : "bg-white border border-gray-300 text-gray-700 hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(selectedOrder.id, "cancelled")}
                    disabled={updatingStatus || selectedOrder.status === "cancelled"}
                    className={`rounded-xl px-3 py-1.5 font-bold uppercase text-[11px] transition-all ${
                      selectedOrder.status === "cancelled"
                        ? "bg-red-600 text-white shadow-xs"
                        : "bg-white border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
                    }`}
                  >
                    Cancel Order
                  </button>
                </div>

                {selectedOrder.status === "cancelled" && (
                  <div className="mt-3 text-[11px] text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                    {selectedOrder.stock_restored ? (
                      <span className="flex items-center gap-1 font-bold">
                        <Check size={13} strokeWidth={2.5} className="text-emerald-600" />
                        <span>Inventory stock for these items has been safely restored to the store catalog.</span>
                      </span>
                    ) : (
                      "Pending inventory return."
                    )}
                  </div>
                )}
              </div>

              {/* Order Status History Timeline */}
              {orderHistory && orderHistory.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 font-bold text-gray-900 flex items-center gap-1.5">
                    <Clock size={15} className="text-gray-500" />
                    <span>Order Status Timeline &amp; Audit Trail</span>
                  </h3>
                  <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                    {orderHistory.map((h, idx) => (
                      <div key={idx} className="relative pl-6">
                        <div className="absolute left-1 top-1.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-white bg-[#2563EB]" />
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold uppercase text-gray-900 text-[11px]">
                            {h.status}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(h.created_at).toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-600 mt-0.5">
                          {h.notes || "Stage updated"}
                          {h.changed_by_name && (
                            <span className="text-gray-400"> — by {h.changed_by_name} ({h.changed_by_role})</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Summary */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                <div className="flex justify-between font-medium text-gray-600">
                  <span>Payment Gateway</span>
                  <span className="font-bold uppercase text-gray-900">{selectedOrder.payment_method}</span>
                </div>
                <div className="mt-1 flex justify-between font-medium text-gray-600">
                  <span>Payment State</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase text-gray-900">{selectedOrder.payment_status}</span>
                    {selectedOrder.payment_status !== "paid" && (
                      <button
                        onClick={() => updateOrderStatus(selectedOrder.id, selectedOrder.status, "paid")}
                        disabled={updatingStatus}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded hover:bg-emerald-100"
                      >
                        Mark as Paid
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between font-extrabold text-sm text-gray-900">
                  <span>Total Amount</span>
                  <span className="text-[#2563EB] text-base">₹{parseFloat(selectedOrder.total_amount).toFixed(0)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-full rounded-xl border border-gray-300 bg-white py-3 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close Order Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
