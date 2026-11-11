import { useState, useEffect } from "react";
import AdminHeader from "@/components/AdminHeader";
import { Plus, Trash2, Shield, User, Truck, Filter, CheckCircle } from "lucide-react";
import useUser from "@/utils/useUser";

export default function AdminUsersPage() {
  const { data: user, loading: userLoading } = useUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [roleFilter, setRoleFilter] = useState("all");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "admin",
  });

  useEffect(() => {
    if (!userLoading && user) {
      checkAdminAccess();
    } else if (!userLoading && !user) {
      if (typeof window !== "undefined") {
        window.location.href = "/account/signin?callbackUrl=/admin/users";
      }
    }
  }, [user, userLoading]);

  const checkAdminAccess = async () => {
    try {
      const response = await fetch("/api/admin/check-role");
      const data = await response.json();
      if (!data.isAdmin) {
        if (typeof window !== "undefined") window.location.href = "/";
        return;
      }
      fetchUsers();
    } catch (error) {
      console.error("Error checking admin access:", error);
      if (typeof window !== "undefined") window.location.href = "/";
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({ email: "", password: "", name: "", role: "admin" });
        setShowAddUser(false);
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create user");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Failed to create user");
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchUsers();
      } else {
        const err = await response.json();
        alert(err.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        fetchUsers();
      } else {
        const err = await response.json();
        alert(err.error || "Failed to update role");
      }
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter === "admin") return u.role === "admin";
    if (roleFilter === "delivery_partner") return u.role === "delivery_partner";
    if (roleFilter === "customer") return u.role === "customer" || !u.role;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <AdminHeader />

      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#111827]">
              User &amp; Staff Management
            </h1>
            <p className="text-sm text-[#6B7280]">
              Manage administrators, delivery partners, and customer accounts
            </p>
          </div>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="flex items-center gap-2 rounded-xl bg-[#2ECC71] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#27AE60] shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create Staff / Partner</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setRoleFilter("all")}
            className={`rounded-xl px-3.5 py-1.5 transition-all ${
              roleFilter === "all"
                ? "bg-[#111827] text-white shadow-xs"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("admin")}
            className={`rounded-xl px-3.5 py-1.5 transition-all ${
              roleFilter === "admin"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Admins ({users.filter((u) => u.role === "admin").length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("delivery_partner")}
            className={`rounded-xl px-3.5 py-1.5 transition-all ${
              roleFilter === "delivery_partner"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Delivery Partners ({users.filter((u) => u.role === "delivery_partner").length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("customer")}
            className={`rounded-xl px-3.5 py-1.5 transition-all ${
              roleFilter === "customer"
                ? "bg-[#2563EB] text-white shadow-xs"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Customers ({users.filter((u) => u.role === "customer" || !u.role).length})
          </button>
        </div>

        {showAddUser && (
          <div className="mb-6 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
            <h2 className="mb-4 text-base font-bold text-[#111827]">
              Create Staff or Partner Account
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#6B7280]">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#2ECC71] focus:ring-2 focus:ring-[#2ECC71]/20"
                    placeholder="staff@sriusha.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#6B7280]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#2ECC71] focus:ring-2 focus:ring-[#2ECC71]/20"
                    placeholder="Staff Member Name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#6B7280]">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#2ECC71] focus:ring-2 focus:ring-[#2ECC71]/20"
                    placeholder="Strong password (at least 6 chars)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#6B7280]">
                    Role Assignment *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm outline-none focus:border-[#2ECC71] focus:ring-2 focus:ring-[#2ECC71]/20 font-medium"
                  >
                    <option value="admin">Administrator (Full Access)</option>
                    <option value="delivery_partner">Delivery Partner (Logistics Portal)</option>
                    <option value="customer">Customer (Store Buyer)</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="rounded-xl bg-[#2ECC71] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#27AE60] shadow-xs"
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-xs font-bold text-[#111827] transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-gray-50/70">
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase text-[#6B7280]">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase text-[#6B7280]">
                    Contact Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase text-[#6B7280]">
                    Address
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase text-[#6B7280]">
                    Orders
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase text-[#6B7280]">
                    Total Spent
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase text-[#6B7280]">
                    Role
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase text-[#6B7280]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {loading ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-12 text-center text-sm text-[#6B7280]"
                    >
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent mx-auto mb-2" />
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan="7"
                      className="px-6 py-12 text-center text-sm text-[#6B7280]"
                    >
                      No users match the selected role filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((item) => {
                    const isAdm = item.role === "admin";
                    const isDel = item.role === "delivery_partner";

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                isAdm
                                  ? "bg-purple-100 text-purple-700"
                                  : isDel
                                  ? "bg-indigo-100 text-indigo-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {isAdm ? (
                                <Shield className="h-5 w-5" />
                              ) : isDel ? (
                                <Truck className="h-5 w-5" />
                              ) : (
                                <User className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[#111827]">
                                {item.name || "Customer"}
                              </p>
                              <p className="text-xs text-[#6B7280]">
                                ID: #{item.id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-xs font-semibold text-[#111827]">{item.email}</p>
                          {item.phone && (
                            <p className="text-xs text-[#6B7280]">{item.phone}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="max-w-[200px] truncate text-xs text-[#6B7280]" title={item.address}>
                            {item.address || "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold text-[#111827]">
                          {item.total_orders || 0} orders
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-[#2ECC71]">
                          ₹{Number(item.total_spent || 0).toFixed(0)}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={item.role || "customer"}
                            onChange={(e) =>
                              handleRoleChange(item.id, e.target.value)
                            }
                            className={`rounded-lg border px-3 py-1.5 text-xs font-bold outline-none ${
                              isAdm
                                ? "border-purple-200 bg-purple-50 text-purple-800"
                                : isDel
                                ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                                : "border-gray-200 bg-white text-gray-700"
                            }`}
                          >
                            <option value="admin">Admin</option>
                            <option value="delivery_partner">Delivery Partner</option>
                            <option value="customer">Customer</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
