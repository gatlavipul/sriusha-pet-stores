"use client";

import { useEffect, useState } from "react";
import AdminAccessGuard from "@/components/AdminAccessGuard";
import AdminHeader from "@/components/AdminHeader";
import { Gift, Save } from "lucide-react";

function AdminRewardsContent() {
  const [config, setConfig] = useState({
    enabled: true,
    pointsPer100: 5,
    pointValueInr: 1,
    minRedeem: 50,
    firstOrderBonus: 25,
    campaignMultiplier: 1,
    campaignName: "Standard Rewards",
  });
  const [stats, setStats] = useState({
    active_holders: 0,
    current_outstanding_points: 0,
    total_lifetime_points: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rewards");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load rewards config");
      if (data.config) setConfig(data.config);
      if (data.stats) setStats(data.stats);
      setTransactions(data.recentTransactions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/admin/rewards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save rewards settings");
      setConfig(data.config);
      setMessage("Sri Usha Rewards rules updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Gift className="text-[#27AE60]" size={24} />
            Sri Usha Rewards &amp; Loyalty Configuration
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Control earning, redemption, first-order bonus, and active reward campaigns.
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
            <p className="text-xs font-bold text-gray-500 uppercase">Active Loyalty Members</p>
            <p className="text-2xl font-black text-gray-900 mt-1">{stats.active_holders}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
            <p className="text-xs font-bold text-gray-500 uppercase">Outstanding Points</p>
            <p className="text-2xl font-black text-[#27AE60] mt-1">
              {stats.current_outstanding_points}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
            <p className="text-xs font-bold text-gray-500 uppercase">Total Lifetime Awarded</p>
            <p className="text-2xl font-black text-[#0066CC] mt-1">
              {stats.total_lifetime_points}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-2xs space-y-4 text-xs"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-gray-900">Loyalty Program Rules</h2>
            <label className="inline-flex items-center gap-2 font-bold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="rounded"
              />
              <span>Program Enabled</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Points Earned per ₹100 Spent</label>
              <input
                type="number"
                min="0"
                value={config.pointsPer100}
                onChange={(e) => setConfig({ ...config, pointsPer100: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">1 Point Value (₹)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={config.pointValueInr}
                onChange={(e) => setConfig({ ...config, pointValueInr: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Minimum Points to Redeem</label>
              <input
                type="number"
                min="0"
                value={config.minRedeem}
                onChange={(e) => setConfig({ ...config, minRedeem: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">First Completed Order Bonus</label>
              <input
                type="number"
                min="0"
                value={config.firstOrderBonus}
                onChange={(e) => setConfig({ ...config, firstOrderBonus: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Active Campaign Name</label>
              <input
                type="text"
                value={config.campaignName}
                onChange={(e) => setConfig({ ...config, campaignName: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Campaign Multiplier (e.g. 2x)</label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={config.campaignMultiplier}
                onChange={(e) => setConfig({ ...config, campaignMultiplier: Number(e.target.value) })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#27AE60] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#219150]"
            >
              <Save size={14} />
              <span>{saving ? "Saving..." : "Save Rules"}</span>
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
          <h2 className="text-sm font-extrabold text-gray-900 mb-3">Recent Point Transactions</h2>
          {transactions.length === 0 ? (
            <p className="text-xs text-gray-500">No loyalty transactions recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Points</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-3 py-2 font-semibold text-gray-800">
                        {tx.user_name || tx.user_email || tx.user_id}
                      </td>
                      <td className="px-3 py-2 uppercase font-bold text-[10px]">{tx.type}</td>
                      <td
                        className={`px-3 py-2 text-right font-black ${
                          tx.points >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {tx.points >= 0 ? `+${tx.points}` : tx.points}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{tx.description}</td>
                      <td className="px-3 py-2 text-gray-400">
                        {new Date(tx.created_at).toLocaleString("en-IN")}
                      </td>
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

export default function AdminRewardsPage() {
  return (
    <AdminAccessGuard>
      <AdminRewardsContent />
    </AdminAccessGuard>
  );
}

