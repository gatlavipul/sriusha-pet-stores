"use client";

import { useEffect, useState } from "react";
import AdminAccessGuard from "@/components/AdminAccessGuard";
import AdminHeader from "@/components/AdminHeader";
import { Boxes, RefreshCw, AlertTriangle, History, Check, Search } from "lucide-react";

function AdminInventoryContent() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [adjustKey, setAdjustKey] = useState(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInventory();
  }, [lowStockOnly]);

  const fetchInventory = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/inventory?low_stock=${lowStockOnly ? "true" : "false"}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load inventory");
      setItems(data.items || []);
      setMovements(data.movements || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAdjust = (productId, variantId, currentStock) => {
    setAdjustKey(`${productId}:${variantId || "base"}`);
    setAdjustQty(String(currentStock));
    setAdjustNote("");
    setMessage("");
    setError("");
  };

  const saveStockAdjustment = async (productId, variantId) => {
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty < 0) {
      setError("Stock quantity must be 0 or greater.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          variant_id: variantId || null,
          new_stock: qty,
          reason: "manual_adjustment",
          notes: adjustNote || "Admin stock update",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update stock");
      setAdjustKey(null);
      setMessage("Stock updated and movement recorded.");
      await fetchInventory();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch = !search.trim()
      ? true
      : item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.category_name?.toLowerCase().includes(search.toLowerCase());
    const matchesOut = !outOfStockOnly
      ? true
      : Number(item.stock_quantity || 0) <= 0 ||
        item.variants?.some((v) => Number(v.stock_quantity || 0) <= 0);
    return matchesSearch && matchesOut;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Boxes className="text-[#27AE60]" size={24} />
              Real-Time Inventory &amp; Stock Ledger
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Manage base and package-size variant stock with full audit movement logs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setLowStockOnly((v) => !v);
                setOutOfStockOnly(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border transition-colors ${
                lowStockOnly
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <AlertTriangle size={14} />
              <span>{lowStockOnly ? "Showing Low Stock (<=5)" : "Filter Low Stock"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOutOfStockOnly((v) => !v);
                setLowStockOnly(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold border transition-colors ${
                outOfStockOnly
                  ? "bg-rose-50 border-rose-300 text-rose-800"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{outOfStockOnly ? "Showing Out of Stock (=0)" : "Out of Stock"}</span>
            </button>
            <button
              type="button"
              onClick={fetchInventory}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
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

        <div className="relative max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or categories..."
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2 text-xs font-medium text-gray-800 focus:border-[#27AE60] focus:outline-none"
          />
        </div>

        {/* Inventory Table */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3 text-left">Product / Package Variant</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      Loading inventory...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      No matching products found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const baseKey = `${item.id}:base`;
                    return (
                      <>
                        <tr key={`p-${item.id}`} className="hover:bg-gray-50/70">
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {item.name}
                            {item.variants?.length > 0 && (
                              <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                {item.variants.length} pack sizes
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{item.category_name || "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">
                            ₹{Number(item.price || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 font-black ${
                                item.stock_quantity <= 5
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {item.stock_quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {adjustKey === baseKey ? (
                              <div className="inline-flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={adjustQty}
                                  onChange={(e) => setAdjustQty(e.target.value)}
                                  className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-right font-bold"
                                />
                                <input
                                  type="text"
                                  value={adjustNote}
                                  onChange={(e) => setAdjustNote(e.target.value)}
                                  placeholder="Reason"
                                  className="w-28 rounded-lg border border-gray-300 px-2 py-1"
                                />
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => saveStockAdjustment(item.id, null)}
                                  className="rounded-lg bg-[#27AE60] px-2.5 py-1 text-white font-bold hover:bg-[#219150]"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAdjustKey(null)}
                                  className="rounded-lg border border-gray-200 px-2 py-1 text-gray-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openAdjust(item.id, null, item.stock_quantity)}
                                className="rounded-lg border border-gray-200 px-2.5 py-1 font-bold text-gray-700 hover:bg-gray-100"
                              >
                                Adjust Base Stock
                              </button>
                            )}
                          </td>
                        </tr>
                        {item.variants?.map((v) => {
                          const vKey = `${item.id}:${v.id}`;
                          return (
                            <tr key={`v-${v.id}`} className="bg-slate-50/60">
                              <td className="px-4 py-2 pl-10 text-gray-700 font-semibold">
                                ↳ {v.label} {v.sku ? `(${v.sku})` : ""}
                              </td>
                              <td className="px-4 py-2 text-gray-400">Variant</td>
                              <td className="px-4 py-2 text-right font-semibold text-gray-700">
                                ₹{Number(v.price || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 font-black ${
                                    v.stock_quantity <= 5
                                      ? "bg-rose-50 text-rose-700"
                                      : "bg-emerald-50 text-emerald-700"
                                  }`}
                                >
                                  {v.stock_quantity}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                {adjustKey === vKey ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={adjustQty}
                                      onChange={(e) => setAdjustQty(e.target.value)}
                                      className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-right font-bold"
                                    />
                                    <input
                                      type="text"
                                      value={adjustNote}
                                      onChange={(e) => setAdjustNote(e.target.value)}
                                      placeholder="Reason"
                                      className="w-28 rounded-lg border border-gray-300 px-2 py-1"
                                    />
                                    <button
                                      type="button"
                                      disabled={saving}
                                      onClick={() => saveStockAdjustment(item.id, v.id)}
                                      className="rounded-lg bg-[#27AE60] px-2.5 py-1 text-white font-bold hover:bg-[#219150]"
                                    >
                                      <Check size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAdjustKey(null)}
                                      className="rounded-lg border border-gray-200 px-2 py-1 text-gray-600"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openAdjust(item.id, v.id, v.stock_quantity)}
                                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-bold text-gray-700 hover:bg-gray-100"
                                  >
                                    Adjust Variant
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Stock Movements */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
          <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 mb-4">
            <History size={16} className="text-[#0066CC]" />
            Recent Stock Movement Audit Log
          </h2>
          {movements.length === 0 ? (
            <p className="text-xs text-gray-500">No stock movements logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Product / Variant</th>
                    <th className="px-3 py-2 text-left">Reason</th>
                    <th className="px-3 py-2 text-right">Change</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-800">
                        #{m.product_id}
                        {m.variant_id ? ` (Variant #${m.variant_id})` : ""}
                      </td>
                      <td className="px-3 py-2 uppercase text-[10px] font-bold text-gray-600">
                        {m.reason}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-black ${
                          m.change_qty >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {m.change_qty >= 0 ? `+${m.change_qty}` : m.change_qty}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800">
                        {m.previous_stock} → {m.new_stock}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{m.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminInventoryPage() {
  return (
    <AdminAccessGuard>
      <AdminInventoryContent />
    </AdminAccessGuard>
  );
}

