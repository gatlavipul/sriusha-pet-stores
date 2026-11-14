import { useState, useEffect } from "react";
import AdminHeader from "@/components/AdminHeader";
import AdminAccessGuard from "@/components/AdminAccessGuard";
import {
  Truck,
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  Banknote,
  Search,
  Filter,
  User,
  Phone,
  MapPin,
  RefreshCw,
  Check,
  BellOff,
} from "lucide-react";

export default function AdminOperationsPage() {
  const [orders, setOrders] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPartnerId, setSelectedPartnerId] = useState({});
  const [assigningId, setAssigningId] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);

  const fetchOperationsData = async () => {
    setLoading(true);
    try {
      const [ordRes, partRes] = await Promise.all([
        fetch("/api/admin/orders?limit=150"),
        fetch("/api/admin/delivery-partners"),
      ]);
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        setOrders(ordData.orders || []);
      }
      if (partRes.ok) {
        const partData = await partRes.json();
        setPartners(partData.deliveryPartners || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperationsData();
  }, []);

  const handleAssignRider = async (orderId) => {
    const partnerId = selectedPartnerId[orderId];
    if (!partnerId) {
      alert("Please select a delivery partner to assign.");
      return;
    }
    setAssigningId(orderId);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "assigned",
          assigned_delivery_partner_id: parseInt(partnerId, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign driver");
      setActionMsg(`Order #${orderId} assigned successfully.`);
      await fetchOperationsData();
    } catch (err) {
      alert(err.message);
    } finally {
      setAssigningId(null);
    }
  };

  // Metrics
  const activeQueue = orders.filter((o) =>
    ["placed", "confirmed", "packing", "ready_for_delivery", "assigned", "out_for_delivery"].includes(o.status)
  );
  const unassignedReady = orders.filter(
    (o) => ["ready_for_delivery", "confirmed", "packing"].includes(o.status) && !o.assigned_delivery_partner_id
  );
  const outForDelivery = orders.filter((o) => o.status === "out_for_delivery");
  const exceptions = orders.filter((o) => o.status === "delivery_failed");
  const codDelivered = orders.filter(
    (o) => o.status === "delivered" && o.payment_method === "cod" && o.payment_status === "paid"
  );
  const totalCodCollected = codDelivered.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
  const codPendingInTransit = outForDelivery
    .filter((o) => o.payment_method === "cod")
    .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

  return (
    <AdminAccessGuard>
      <div className="min-h-screen bg-[#F8F9FA] pb-16">
        <AdminHeader />

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Truck className="h-6 w-6 text-[#2563EB]" />
                Hyperlocal Delivery Dispatch &amp; Operations Center
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Real-time rider assignment, live fulfillment queue, and cash-on-delivery reconciliation.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchOperationsData}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:bg-gray-50"
            >
              <RefreshCw size={13} />
              <span>Refresh Operations</span>
            </button>
          </div>

          {actionMsg && (
            <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800">
              <Check size={14} strokeWidth={2.5} className="text-emerald-600" />
              <span>{actionMsg}</span>
            </div>
          )}

          {/* Operations KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-gray-400">Live Active Queue</span>
              <p className="text-2xl font-black text-gray-900 mt-0.5">{activeQueue.length}</p>
              <span className="text-[10px] text-gray-500">In fulfillment</span>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-amber-800">Needs Dispatch</span>
              <p className="text-2xl font-black text-amber-900 mt-0.5">{unassignedReady.length}</p>
              <span className="text-[10px] text-amber-700">Rider unassigned</span>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-indigo-800">On The Road</span>
              <p className="text-2xl font-black text-indigo-900 mt-0.5">{outForDelivery.length}</p>
              <span className="text-[10px] text-indigo-700">Out for delivery</span>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase text-rose-800">Exceptions</span>
              <p className="text-2xl font-black text-rose-900 mt-0.5">{exceptions.length}</p>
              <span className="text-[10px] text-rose-700">Delivery issues</span>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-extrabold uppercase text-emerald-800">COD Collected</span>
              <p className="text-2xl font-black text-emerald-900 mt-0.5">₹{totalCodCollected.toFixed(0)}</p>
              <span className="text-[10px] text-emerald-700">{codDelivered.length} reconciled COD orders</span>
            </div>
          </div>

          {/* Unassigned Dispatch Orders */}
          <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                  {unassignedReady.length}
                </span>
                <h2 className="text-sm font-extrabold text-gray-900">
                  Ready for Delivery Dispatch (Assign Rider)
                </h2>
              </div>
            </div>

            {unassignedReady.length === 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-gray-500 py-3">
                <Check size={14} className="text-emerald-600" strokeWidth={2.5} />
                <span>All current orders have assigned delivery partners or are completed.</span>
              </p>
            ) : (
              <div className="space-y-3">
                {unassignedReady.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50/60 p-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900">
                          {o.order_number || `SU-#${o.id}`}
                        </span>
                        <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                          {o.status.replace(/_/g, " ")}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700 uppercase">
                          {o.payment_method} (₹{parseFloat(o.total_amount).toFixed(0)})
                        </span>
                        {o.gentle_delivery && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                            <BellOff size={10} strokeWidth={1.75} />
                            <span>Gentle Drop</span>
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600">
                        <span className="font-semibold text-gray-800">{o.customer_name}</span> ({o.customer_phone || "No phone"}) • {o.shipping_address}, {o.shipping_city} - {o.shipping_pincode}
                      </p>
                      {o.delivery_instructions && (
                        <p className="text-amber-800 text-[11px] font-medium">
                          Note: {o.delivery_instructions}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={selectedPartnerId[o.id] || ""}
                        onChange={(e) =>
                          setSelectedPartnerId((prev) => ({ ...prev, [o.id]: e.target.value }))
                        }
                        className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#2563EB]"
                      >
                        <option value="">Select Rider...</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.phone || p.email})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={assigningId === o.id}
                        onClick={() => handleAssignRider(o.id)}
                        className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] disabled:opacity-50"
                      >
                        {assigningId === o.id ? "Assigning..." : "Assign & Dispatch"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COD Cash Reconciliation */}
          <div className="rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-600" />
                <h2 className="text-sm font-extrabold text-gray-900">
                  Cash on Delivery (COD) Reconciliation Ledger
                </h2>
              </div>
              <span className="text-xs font-bold text-gray-500">
                In-Transit COD: ₹{codPendingInTransit.toFixed(0)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="border-b border-gray-100 bg-gray-50/70 text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="py-2.5 px-3">Order #</th>
                    <th className="py-2.5 px-3">Delivered Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Assigned Driver</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Reconciliation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {codDelivered.slice(0, 15).map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-bold text-gray-900">
                        {o.order_number || `SU-#${o.id}`}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500">
                        {new Date(o.updated_at || o.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="py-2.5 px-3">{o.customer_name}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-800">
                        {o.assigned_delivery_partner_id
                          ? partners.find((p) => p.id === o.assigned_delivery_partner_id)?.name ||
                            `Driver #${o.assigned_delivery_partner_id}`
                          : "Store Dispatch"}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700">
                        ₹{parseFloat(o.total_amount).toFixed(0)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                          <CheckCircle size={10} /> Cash Collected &amp; Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </AdminAccessGuard>
  );
}

