import { useState, useEffect, useCallback } from "react";
import AdminHeader from "@/components/AdminHeader";
import {
  Truck,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  Phone,
  Mail,
  User,
  Shield,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { useAdminAccess, AdminAccessRestricted, AdminAuthChecking } from "@/components/AdminAccessGuard";

export default function AdminDeliveryTeamPage() {
  const { status: adminStatus, role: adminRole, email: adminEmail } = useAdminAccess("/admin/delivery-team");
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [deleteConfirmStaff, setDeleteConfirmStaff] = useState(null);

  const fetchStaff = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/delivery-staff");
      const data = await res.json();
      if (res.ok) {
        setStaffList(data.staff || []);
      }
    } catch (err) {
      console.error("Failed to fetch delivery staff:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (adminStatus === "authorized") {
      fetchStaff();
    }
  }, [adminStatus, fetchStaff]);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const email = formEmail.trim().toLowerCase();
    if (!email) {
      setFormError("Please enter a valid email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError("Please enter a valid email address format (e.g. driver@gmail.com).");
      return;
    }

    const phoneClean = formPhone.replace(/\D/g, "");
    if (phoneClean && phoneClean.length !== 10) {
      setFormError("Phone number must be exactly 10 digits.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/delivery-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: formName.trim() || undefined,
          phone: phoneClean || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to add delivery staff member.");
        return;
      }

      setFormSuccess(`Added "${email}" to the delivery team! If they haven't signed in yet, their account will automatically link when they sign in.`);
      setFormEmail("");
      setFormName("");
      setFormPhone("");
      fetchStaff();
    } catch (err) {
      console.error(err);
      setFormError("Network error adding delivery staff.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (staff) => {
    const nextStatus = staff.status === "active" ? "disabled" : "active";
    const confirmMsg = nextStatus === "disabled"
      ? `Disable ${staff.email}? They will immediately lose access to the delivery portal.`
      : `Re-activate ${staff.email} as an active delivery driver?`;

    if (!confirm(confirmMsg)) return;

    setActionLoadingId(staff.id);
    try {
      const res = await fetch(`/api/admin/delivery-staff/${staff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update status");
        return;
      }

      fetchStaff();
    } catch (err) {
      console.error(err);
      alert("Network error updating staff status");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmStaff) return;
    setActionLoadingId(deleteConfirmStaff.id);
    try {
      const res = await fetch(`/api/admin/delivery-staff/${deleteConfirmStaff.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to remove staff member");
        return;
      }

      setDeleteConfirmStaff(null);
      fetchStaff();
    } catch (err) {
      console.error(err);
      alert("Network error removing staff member");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (adminStatus === "checking" || adminStatus === "unauthenticated") {
    return <AdminAuthChecking />;
  }

  if (adminStatus === "forbidden") {
    return <AdminAccessRestricted role={adminRole} email={adminEmail} />;
  }

  const filteredStaff = staffList.filter((s) => {
    const matchesSearch =
      !searchQuery.trim() ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
      (s.phone && s.phone.includes(searchQuery.trim()));

    const matchesStatus =
      statusFilter === "all" ||
      s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalCount = staffList.length;
  const activeCount = staffList.filter((s) => s.status === "active").length;
  const disabledCount = staffList.filter((s) => s.status === "disabled").length;
  const linkedCount = staffList.filter((s) => s.is_linked).length;

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#241819]">
      <AdminHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header & Title */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                <Truck size={13} />
                Logistics &amp; Dispatch
              </span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-black text-[#4A0A0F]">
              Delivery Team
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Add Gmail/verified accounts for your delivery fleet, assign orders, and control driver portal access.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchStaff(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-xs font-bold text-stone-700 shadow-xs hover:bg-stone-50 min-h-[44px]"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin text-[#F97316]" : ""} />
              <span>Refresh</span>
            </button>
            <a
              href="/delivery"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A0A0F] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#360509] min-h-[44px]"
            >
              <Truck size={14} />
              <span>Open Delivery App</span>
              <ExternalLink size={12} className="opacity-70" />
            </a>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-semibold text-stone-500">Total Fleet</p>
            <p className="mt-1 text-2xl font-black text-[#4A0A0F]">{totalCount}</p>
            <p className="text-[11px] text-stone-400 mt-0.5">Invited delivery partners</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-xs">
            <p className="text-xs font-semibold text-emerald-700">Active Drivers</p>
            <p className="mt-1 text-2xl font-black text-emerald-800">{activeCount}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Can access /delivery</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 shadow-xs">
            <p className="text-xs font-semibold text-rose-700">Disabled Drivers</p>
            <p className="mt-1 text-2xl font-black text-rose-800">{disabledCount}</p>
            <p className="text-[11px] text-rose-600 mt-0.5">Access suspended</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 shadow-xs">
            <p className="text-xs font-semibold text-blue-700">Clerk Linked</p>
            <p className="mt-1 text-2xl font-black text-blue-800">{linkedCount}</p>
            <p className="text-[11px] text-blue-600 mt-0.5">Signed in at least once</p>
          </div>
        </div>

        {/* Add Delivery Staff Form Card */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xs mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4A0A0F]/10 text-[#4A0A0F]">
              <Plus size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#4A0A0F]">Invite Delivery Partner</h2>
              <p className="text-xs text-stone-500">
                Enter their Gmail address. They don't need an account yet — when they sign in with this email, they will automatically receive the Delivery role.
              </p>
            </div>
          </div>

          {formError && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertTriangle size={15} className="text-rose-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle size={15} className="text-emerald-600 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleAddStaff} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Email Address (Gmail / Corporate) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-stone-400" />
                <input
                  type="email"
                  required
                  placeholder="driver@gmail.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-[#FAF7F2] py-2.5 pl-9 pr-3 text-xs font-semibold text-stone-900 outline-none focus:border-[#F97316] focus:bg-white min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Driver Name (Optional)
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-3.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="e.g. Ramesh Reddy"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-[#FAF7F2] py-2.5 pl-9 pr-3 text-xs font-semibold text-stone-900 outline-none focus:border-[#F97316] focus:bg-white min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-3.5 text-stone-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-[#FAF7F2] py-2.5 pl-9 pr-3 text-xs font-semibold text-stone-900 outline-none focus:border-[#F97316] focus:bg-white min-h-[44px]"
                />
              </div>
            </div>

            <div className="sm:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#F97316] px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#EA580C] disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Adding Partner...</span>
                  </>
                ) : (
                  <>
                    <Plus size={15} />
                    <span>Add Delivery Partner</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-3.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-10 pr-4 text-xs font-semibold text-stone-900 outline-none focus:border-[#F97316] min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs font-bold text-stone-700 outline-none focus:border-[#F97316] min-h-[44px]"
            >
              <option value="all">All Statuses ({totalCount})</option>
              <option value="active">Active ({activeCount})</option>
              <option value="disabled">Disabled ({disabledCount})</option>
            </select>
          </div>
        </div>

        {/* Team List / Table */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw size={24} className="mx-auto animate-spin text-[#F97316] mb-3" />
              <p className="text-xs font-semibold text-stone-500">Loading delivery fleet...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-12 text-center">
              <Truck size={36} className="mx-auto text-stone-300 mb-3" />
              <p className="text-sm font-bold text-stone-700">No delivery staff found</p>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? "No members match your search criteria. Try a different term or clear filters."
                  : "Invite your first delivery driver above using their Gmail address."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF7F2] border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-6 py-3.5">Driver &amp; Account</th>
                      <th className="px-6 py-3.5">Contact</th>
                      <th className="px-6 py-3.5">Clerk Status</th>
                      <th className="px-6 py-3.5">Deliveries</th>
                      <th className="px-6 py-3.5">Role Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredStaff.map((staff) => {
                      const isActive = staff.status === "active";
                      const isLoadingThis = actionLoadingId === staff.id;

                      return (
                        <tr key={staff.id} className="hover:bg-stone-50/70 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-[#4A0A0F]/10 text-[#4A0A0F] font-bold flex items-center justify-center shrink-0">
                                {staff.name ? staff.name.charAt(0).toUpperCase() : staff.email.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-stone-900">{staff.name || "Delivery Partner"}</p>
                                <p className="text-[11px] text-stone-500 font-mono">{staff.email}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {staff.phone ? (
                              <a
                                href={`tel:${staff.phone}`}
                                className="inline-flex items-center gap-1 font-semibold text-stone-700 hover:text-[#F97316]"
                              >
                                <Phone size={12} className="text-stone-400" />
                                <span>+91 {staff.phone}</span>
                              </a>
                            ) : (
                              <span className="text-stone-400 italic">No phone set</span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            {staff.is_linked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                                <CheckCircle size={11} />
                                Clerk Linked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                <Clock size={11} />
                                Invite Pending
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <div className="text-stone-700">
                              <span className="font-bold text-emerald-700">{staff.completed_deliveries || 0}</span> done
                              {staff.pending_deliveries > 0 && (
                                <span className="ml-1 text-[11px] font-semibold text-amber-600">
                                  ({staff.pending_deliveries} active)
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 border border-rose-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                                Disabled
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={isLoadingThis}
                                onClick={() => handleToggleStatus(staff)}
                                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors min-h-[36px] ${
                                  isActive
                                    ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                                }`}
                              >
                                {isLoadingThis ? "Saving..." : isActive ? "Disable" : "Enable"}
                              </button>

                              <button
                                type="button"
                                disabled={isLoadingThis}
                                onClick={() => setDeleteConfirmStaff(staff)}
                                className="rounded-xl p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Remove delivery partner"
                                aria-label="Remove delivery partner"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View (<768px) */}
              <div className="md:hidden divide-y divide-stone-100">
                {filteredStaff.map((staff) => {
                  const isActive = staff.status === "active";
                  const isLoadingThis = actionLoadingId === staff.id;

                  return (
                    <div key={staff.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-10 w-10 rounded-full bg-[#4A0A0F]/10 text-[#4A0A0F] font-bold flex items-center justify-center shrink-0">
                            {staff.name ? staff.name.charAt(0).toUpperCase() : staff.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-stone-900">{staff.name || "Delivery Partner"}</h3>
                            <p className="text-xs text-stone-500 font-mono break-all">{staff.email}</p>
                          </div>
                        </div>

                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 shrink-0">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200 shrink-0">
                            Disabled
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-stone-100">
                        <div>
                          <p className="text-[10px] font-semibold text-stone-400">Phone</p>
                          {staff.phone ? (
                            <a href={`tel:${staff.phone}`} className="font-bold text-stone-800 flex items-center gap-1">
                              <Phone size={11} className="text-stone-400" />
                              <span>{staff.phone}</span>
                            </a>
                          ) : (
                            <span className="text-stone-400 italic">None</span>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold text-stone-400">Clerk Account</p>
                          {staff.is_linked ? (
                            <span className="font-bold text-blue-700">Linked</span>
                          ) : (
                            <span className="font-bold text-amber-700">Invite Pending</span>
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold text-stone-400">Deliveries Done</p>
                          <p className="font-bold text-emerald-700">{staff.completed_deliveries || 0} completed</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-semibold text-stone-400">Added By</p>
                          <p className="font-semibold text-stone-600 truncate">{staff.added_by || "admin"}</p>
                        </div>
                      </div>

                      {/* Mobile Actions: Buttons >= 44px */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          disabled={isLoadingThis}
                          onClick={() => handleToggleStatus(staff)}
                          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-colors min-h-[44px] flex items-center justify-center ${
                            isActive
                              ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                          }`}
                        >
                          {isLoadingThis ? "Saving..." : isActive ? "Disable Access" : "Enable Access"}
                        </button>

                        <button
                          type="button"
                          disabled={isLoadingThis}
                          onClick={() => setDeleteConfirmStaff(staff)}
                          className="rounded-xl px-4 py-2.5 border border-stone-200 text-stone-600 hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[44px] flex items-center justify-center gap-1 text-xs font-bold"
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirmStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-stone-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 mb-4">
              <Trash2 size={24} />
            </div>

            <h3 className="text-base font-black text-stone-900">Remove Delivery Partner?</h3>
            <p className="mt-2 text-xs text-stone-600 leading-relaxed">
              Are you sure you want to remove <strong className="text-stone-900">{deleteConfirmStaff.email}</strong> from the delivery team?
              Their role will be reverted to customer and they will immediately lose access to the delivery portal.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmStaff(null)}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-700 shadow-xs min-h-[44px]"
              >
                Yes, Remove Partner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
