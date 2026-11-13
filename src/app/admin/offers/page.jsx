"use client";

import { useEffect, useState } from "react";
import AdminAccessGuard from "@/components/AdminAccessGuard";
import AdminHeader from "@/components/AdminHeader";
import { Tag, Plus, Trash2, PauseCircle, PlayCircle } from "lucide-react";

const EMPTY_FORM = {
  code: "",
  title: "",
  description: "",
  offer_type: "festival",
  discount_type: "percentage",
  discount_value: "10",
  min_order_amount: "0",
  max_discount: "",
  applicable_scope: "all",
  start_date: "",
  end_date: "",
  status: "active",
};

function AdminOffersContent() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/offers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load offers");
      setOffers(data.offers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          discount_value: parseFloat(form.discount_value || 0),
          min_order_amount: parseFloat(form.min_order_amount || 0),
          max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create offer");
      setForm(EMPTY_FORM);
      setMessage(`Offer ${data.offer?.code} created.`);
      await fetchOffers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (offer) => {
    const nextStatus = offer.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/admin/offers/${offer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        await fetchOffers();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteOffer = async (id) => {
    try {
      const res = await fetch(`/api/admin/offers/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchOffers();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Tag className="text-[#27AE60]" size={24} />
            Offers &amp; Festival Promotions
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Create First-Time Customer (one-time per customer) and Festival date-bounded promo codes.
          </p>
        </div>

        {message && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}

        {/* Create Offer Form */}
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4"
        >
          <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
            <Plus size={16} /> Create New Offer
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Promo Code *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME15"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-bold uppercase"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="First Order Welcome Offer"
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Offer Type</label>
              <select
                value={form.offer_type}
                onChange={(e) => setForm({ ...form, offer_type: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
              >
                <option value="first_time">First-Time Customer (Once Only)</option>
                <option value="festival">Festival / Seasonal Offer</option>
                <option value="general">General Promo</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Discount Type &amp; Value</label>
              <div className="flex gap-2">
                <select
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                  className="rounded-xl border border-gray-200 px-2 py-2"
                >
                  <option value="percentage">% Off</option>
                  <option value="flat">₹ Flat</option>
                </select>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Min Order Amount (₹)</label>
              <input
                type="number"
                min="0"
                value={form.min_order_amount}
                onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Max Discount Cap (₹)</label>
              <input
                type="number"
                min="0"
                value={form.max_discount}
                onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                placeholder="Optional"
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Start Date</label>
              <input
                type="datetime-local"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">End Date</label>
              <input
                type="datetime-local"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#27AE60] px-5 py-2 text-xs font-bold text-white hover:bg-[#219150] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create Offer"}
            </button>
          </div>
        </form>

        {/* Offers List */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase text-[11px]">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Type / Title</th>
                <th className="px-4 py-3 text-left">Discount</th>
                <th className="px-4 py-3 text-left">Schedule</th>
                <th className="px-4 py-3 text-right">Redemptions</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Loading offers...
                  </td>
                </tr>
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No offers created yet.
                  </td>
                </tr>
              ) : (
                offers.map((offer) => (
                  <tr key={offer.id}>
                    <td className="px-4 py-3 font-black text-[#0066CC]">{offer.code}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{offer.title}</div>
                      <div className="text-[11px] text-gray-500 uppercase">{offer.offer_type}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800">
                      {offer.discount_type === "percentage"
                        ? `${offer.discount_value}%`
                        : `₹${offer.discount_value}`}
                      {offer.min_order_amount > 0 && (
                        <span className="block text-[10px] font-normal text-gray-500">
                          Min ₹{offer.min_order_amount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">
                      {offer.start_date ? new Date(offer.start_date).toLocaleDateString("en-IN") : "Now"} →{" "}
                      {offer.end_date ? new Date(offer.end_date).toLocaleDateString("en-IN") : "No expiry"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {offer.redemption_count || 0}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          offer.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {offer.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => toggleStatus(offer)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {offer.status === "active" ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
                        <span>{offer.status === "active" ? "Pause" : "Activate"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteOffer(offer.id)}
                        className="inline-flex items-center rounded-lg border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default function AdminOffersPage() {
  return (
    <AdminAccessGuard>
      <AdminOffersContent />
    </AdminAccessGuard>
  );
}

