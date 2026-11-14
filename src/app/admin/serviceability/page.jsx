import { useState, useEffect } from "react";
import AdminHeader from "@/components/AdminHeader";
import { useAdminAccess, AdminAccessRestricted, AdminAuthChecking } from "@/components/AdminAccessGuard";
import {
  MapPin,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Truck,
  IndianRupee,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";

export default function AdminServiceabilityPage() {
  const { status: adminStatus, role: adminRole, email: adminEmail } = useAdminAccess("/admin/serviceability");
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    pincode: "",
    area_name: "",
    city: "Hyderabad",
    state: "Telangana",
    delivery_charge: "40",
    free_delivery_threshold: "500",
    estimated_delivery_time: "Same-day in 2-4 hours",
    is_active: true,
  });

  useEffect(() => {
    if (adminStatus === "authorized") {
      fetchZones();
    }
  }, [adminStatus]);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/serviceability");
      if (res.ok) {
        const data = await res.json();
        setZones(data.zones || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (zone) => {
    try {
      const res = await fetch(`/api/admin/serviceability/${zone.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !zone.is_active }),
      });
      if (res.ok) {
        setZones((prev) =>
          prev.map((z) => (z.id === zone.id ? { ...z, is_active: !z.is_active } : z))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (zoneId) => {
    if (!confirm("Are you sure you want to remove this delivery zone?")) return;
    try {
      const res = await fetch(`/api/admin/serviceability/${zoneId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setZones((prev) => prev.filter((z) => z.id !== zoneId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateZone = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/serviceability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add delivery zone");
      }

      setSuccess("Delivery zone successfully saved.");
      setShowAddModal(false);
      setFormData({
        pincode: "",
        area_name: "",
        city: "Hyderabad",
        state: "Telangana",
        delivery_charge: "40",
        free_delivery_threshold: "500",
        estimated_delivery_time: "Same-day in 2-4 hours",
        is_active: true,
      });
      fetchZones();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (adminStatus === "checking" || adminStatus === "unauthenticated") {
    return <AdminAuthChecking />;
  }

  if (adminStatus === "forbidden") {
    return <AdminAccessRestricted role={adminRole} email={adminEmail} />;
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <AdminHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Delivery Serviceability Zones
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Configure serviceable delivery pincodes, delivery charges, free delivery thresholds, and delivery speed
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchZones}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs"
            >
              <RefreshCw size={13} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-xs"
            >
              <Plus size={15} />
              <span>Add Pincode Zone</span>
            </button>
          </div>
        </div>

        {success && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
            {success}
          </div>
        )}

        {/* Zones Grid */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-semibold">Loading serviceable zones...</p>
            </div>
          ) : zones.length === 0 ? (
            <div className="py-16 text-center">
              <MapPin size={40} className="mx-auto text-gray-300 mb-3" />
              <h2 className="text-sm font-bold text-gray-900">No serviceable zones configured yet</h2>
              <p className="text-xs text-gray-400 mt-1">Add pincodes to open delivery coverage.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50/70">
                  <tr>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Pincode</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Area / Locality</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">City &amp; State</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Delivery Fee</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Free Over</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Estimated Speed</th>
                    <th className="p-3.5 font-bold uppercase tracking-wider text-gray-500">Status</th>
                    <th className="p-3.5 text-right font-bold uppercase tracking-wider text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {zones.map((zone) => (
                    <tr key={zone.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="p-3.5 font-black text-gray-900 whitespace-nowrap">
                        {zone.pincode}
                      </td>
                      <td className="p-3.5 font-bold text-gray-800">
                        {zone.area_name}
                      </td>
                      <td className="p-3.5 text-gray-600">
                        {zone.city}, {zone.state}
                      </td>
                      <td className="p-3.5 font-semibold text-gray-900">
                        ₹{parseFloat(zone.delivery_charge).toFixed(0)}
                      </td>
                      <td className="p-3.5 font-semibold text-emerald-700">
                        ₹{parseFloat(zone.free_delivery_threshold).toFixed(0)}
                      </td>
                      <td className="p-3.5 text-gray-600">
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                          {zone.estimated_delivery_time}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(zone)}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border transition-all ${
                            zone.is_active
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                          }`}
                        >
                          {zone.is_active ? "Active" : "Disabled"}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(zone.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title="Delete Zone"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Zone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
              <div className="flex items-center gap-2 text-indigo-600">
                <MapPin size={20} />
                <h3 className="font-extrabold text-sm text-gray-900">Add Serviceable Delivery Pincode</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close modal"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-red-50 p-2.5 text-xs font-bold text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateZone} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Pincode *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500039"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 outline-none focus:border-indigo-600 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Area / Locality Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Uppal & Ramanthapur"
                    value={formData.area_name}
                    onChange={(e) => setFormData({ ...formData, area_name: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 outline-none focus:border-indigo-600 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Standard Delivery Fee (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.delivery_charge}
                    onChange={(e) => setFormData({ ...formData, delivery_charge: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                    Free Delivery Threshold (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.free_delivery_threshold}
                    onChange={(e) => setFormData({ ...formData, free_delivery_threshold: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                  Estimated Delivery Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. Same-day in 2-4 hours, Express in 1-2 hours"
                  value={formData.estimated_delivery_time}
                  onChange={(e) => setFormData({ ...formData, estimated_delivery_time: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 p-2.5 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 font-bold text-white hover:bg-indigo-700 shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Delivery Zone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

