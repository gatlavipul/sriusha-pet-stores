"use client";

import { useEffect, useState } from "react";
import AdminAccessGuard from "@/components/AdminAccessGuard";
import AdminHeader from "@/components/AdminHeader";
import { FileText, CheckCircle, XCircle, ExternalLink } from "lucide-react";

function AdminPrescriptionsContent() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notesById, setNotesById] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchPrescriptions();
  }, [statusFilter]);

  const fetchPrescriptions = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/prescriptions?scope=all&status=${statusFilter}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch prescriptions");
      setPrescriptions(data.prescriptions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reviewPrescription = async (id, status) => {
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/prescriptions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          notes: notesById[id] || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update prescription");
      setMessage(`Prescription #${id} marked as ${status}.`);
      await fetchPrescriptions();
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
              <FileText className="text-[#0066CC]" size={24} />
              Veterinary Prescription Review
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Verify uploaded customer prescriptions stored in protected non-public storage.
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
                    ? "bg-[#0066CC] text-white border-[#0066CC]"
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

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-xs text-gray-400">
              Loading prescriptions...
            </div>
          ) : prescriptions.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-xs text-gray-500">
              No prescriptions found for this filter.
            </div>
          ) : (
            prescriptions.map((rx) => (
              <div
                key={rx.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-gray-900">Rx #{rx.id}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        rx.status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : rx.status === "rejected"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {rx.status}
                    </span>
                    {rx.order_number && (
                      <span className="font-bold text-[#0066CC]">Order {rx.order_number}</span>
                    )}
                  </div>
                  <p className="text-gray-700 font-semibold">
                    Customer: {rx.customer_name || "Customer"} ({rx.customer_email || "—"})
                  </p>
                  <p className="text-gray-500">
                    File: {rx.original_filename} • Uploaded{" "}
                    {new Date(rx.created_at).toLocaleString("en-IN")}
                  </p>
                  {rx.notes && <p className="text-gray-600 italic">Notes: {rx.notes}</p>}
                  <a
                    href={`/api/prescriptions/${rx.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#0066CC] hover:underline pt-1"
                  >
                    <ExternalLink size={13} />
                    <span>View Protected Prescription File</span>
                  </a>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={notesById[rx.id] ?? rx.notes ?? ""}
                    onChange={(e) => setNotesById({ ...notesById, [rx.id]: e.target.value })}
                    placeholder="Reviewer notes (optional)"
                    className="rounded-xl border border-gray-200 px-3 py-2 min-w-[220px]"
                  />
                  <button
                    type="button"
                    onClick={() => reviewPrescription(rx.id, "approved")}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#27AE60] px-3.5 py-2 font-bold text-white hover:bg-[#219150]"
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewPrescription(rx.id, "resubmit_requested")}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 font-bold text-amber-800 hover:bg-amber-100"
                  >
                    Request New Rx
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewPrescription(rx.id, "rejected")}
                    className="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-600 px-3.5 py-2 font-bold text-white hover:bg-rose-700"
                  >
                    <XCircle size={14} /> Reject
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

export default function AdminPrescriptionsPage() {
  return (
    <AdminAccessGuard>
      <AdminPrescriptionsContent />
    </AdminAccessGuard>
  );
}

