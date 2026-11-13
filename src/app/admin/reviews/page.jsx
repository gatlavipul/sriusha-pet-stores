"use client";

import { useEffect, useState } from "react";
import AdminAccessGuard from "@/components/AdminAccessGuard";
import AdminHeader from "@/components/AdminHeader";
import { Star, Check, EyeOff, Trash2 } from "lucide-react";

function AdminReviewsContent() {
  const [reviews, setReviews] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchReviews();
  }, [statusFilter]);

  const fetchReviews = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/reviews?status=${statusFilter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load reviews");
      setReviews(data.reviews || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update review");
      setMessage(`Review #${id} marked ${status}.`);
      await fetchReviews();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteReview = async (id) => {
    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage(`Review #${id} deleted.`);
        await fetchReviews();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Star className="text-amber-500" size={24} />
              Customer Reviews Moderation
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Approve authentic customer reviews or hide inappropriate submissions.
            </p>
          </div>
          <div className="flex gap-2 text-xs font-bold">
            {["all", "pending", "approved", "rejected"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-xl px-3.5 py-2 capitalize border ${
                  statusFilter === s
                    ? "bg-[#27AE60] text-white border-[#27AE60]"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {s}
              </button>
            ))}
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

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-xs text-gray-400">
              Loading reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-xs text-gray-500">
              No reviews found.
            </div>
          ) : (
            reviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-gray-900">{rev.product_name}</span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
                      {"★".repeat(rev.rating)} ({rev.rating}/5)
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        rev.status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : rev.status === "rejected"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {rev.status}
                    </span>
                  </div>
                  <p className="font-bold text-gray-800">{rev.title}</p>
                  <p className="text-gray-600">{rev.comment}</p>
                  <p className="text-[11px] text-gray-400">
                    By {rev.customer_name} • {new Date(rev.created_at).toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs shrink-0">
                  {rev.status !== "approved" && (
                    <button
                      type="button"
                      onClick={() => updateStatus(rev.id, "approved")}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#27AE60] px-3 py-1.5 font-bold text-white hover:bg-[#219150]"
                    >
                      <Check size={13} /> Approve
                    </button>
                  )}
                  {rev.status !== "rejected" && (
                    <button
                      type="button"
                      onClick={() => updateStatus(rev.id, "rejected")}
                      className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 font-bold text-amber-800 hover:bg-amber-100"
                    >
                      <EyeOff size={13} /> Hide
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteReview(rev.id)}
                    className="inline-flex items-center rounded-xl border border-rose-200 px-2.5 py-1.5 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminReviewsPage() {
  return (
    <AdminAccessGuard>
      <AdminReviewsContent />
    </AdminAccessGuard>
  );
}

