import { useState, useEffect } from "react";
import Header from "@/components/Header";
import useUser from "@/utils/useUser";
import {
  User,
  Package,
  MapPin,
  Heart,
  LogOut,
  Shield,
  Truck,
  ExternalLink,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import useAuth from "@/utils/useAuth";

export default function CustomerAccountPage() {
  const { data: user, loading: userLoading } = useUser();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [activeTab, setActiveTab] = useState("orders"); // orders | addresses | profile
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    tag: "Home",
    street_address: "",
    city: "Hyderabad",
    pincode: "",
    phone: "",
    is_default: false,
  });

  // Guard against unauthenticated visits
  useEffect(() => {
    if (!userLoading && !user) {
      if (typeof window !== "undefined") {
        window.location.href = "/account/signin?callbackUrl=/account";
      }
    }
  }, [user, userLoading]);

  // Load user profile and data
  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchOrders();
      fetchAddresses();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/account/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setProfile(data.user);
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);
      const res = await fetch("/api/orders");
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const res = await fetch("/api/addresses");
      const data = await res.json();
      setAddresses(data.addresses || []);
    } catch (err) {
      console.error("Error fetching addresses:", err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleCreateAddress = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAddress),
      });
      if (res.ok) {
        setShowAddAddress(false);
        setNewAddress({
          tag: "Home",
          street_address: "",
          city: "Hyderabad",
          pincode: "",
          phone: "",
          is_default: false,
        });
        fetchAddresses();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save address");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save address");
    }
  };

  const getStatusColor = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "delivered") return "bg-emerald-50 text-emerald-800 border-emerald-200";
    if (s === "out_for_delivery" || s === "shipped") return "bg-indigo-50 text-indigo-800 border-indigo-200";
    if (s === "packing" || s === "packed") return "bg-purple-50 text-purple-800 border-purple-200";
    if (s === "confirmed" || s === "processing") return "bg-blue-50 text-blue-800 border-blue-200";
    if (s === "cancelled") return "bg-red-50 text-red-800 border-red-200";
    return "bg-amber-50 text-amber-800 border-amber-200";
  };

  if (userLoading || (!profile && !user)) {
    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent" />
        </div>
      </div>
    );
  }

  const role = profile?.role || user?.role || "customer";

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <Header />

      <main className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Role Portal Banners */}
        {role === "admin" && (
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-purple-200 bg-purple-50 p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-purple-900">
                  Store Administrator Portal Available
                </h2>
                <p className="text-xs text-purple-700">
                  You have full administrative privileges to manage products, orders, inventory, and staff.
                </p>
              </div>
            </div>
            <a
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-800 transition-all shrink-0"
            >
              <span>Go to Admin Dashboard</span>
              <ExternalLink size={13} />
            </a>
          </div>
        )}

        {role === "delivery_partner" && (
          <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-indigo-900">
                  Delivery Partner Portal Available
                </h2>
                <p className="text-xs text-indigo-700">
                  Access your assigned customer orders, map directions, and mark deliveries.
                </p>
              </div>
            </div>
            <a
              href="/delivery"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-800 transition-all shrink-0"
            >
              <span>Go to Delivery Dashboard</span>
              <ExternalLink size={13} />
            </a>
          </div>
        )}

        {/* Profile Card */}
        <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2563EB]/10 text-[#2563EB]">
                <User size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-gray-900">
                    {profile?.name || user?.name || "Customer"}
                  </h1>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
                    {role}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {profile?.email || user?.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/wishlist"
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-pink-300 hover:text-pink-600 shadow-2xs transition-colors"
              >
                <Heart size={14} className="text-pink-500" />
                <span>Wishlist</span>
              </a>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 shadow-2xs transition-colors"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex border-b border-gray-100 gap-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "orders"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <Package size={15} />
              <span>Order History ({orders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("addresses")}
              className={`pb-3 transition-colors border-b-2 flex items-center gap-1.5 ${
                activeTab === "addresses"
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-500 hover:text-gray-900"
              }`}
            >
              <MapPin size={15} />
              <span>Saved Addresses ({addresses.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Orders */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {loadingOrders ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading your orders...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-xs">
                <Package size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-sm font-bold text-gray-900">No orders placed yet</h3>
                <p className="text-xs text-gray-400 mt-1 mb-4">
                  Browse our vet-approved pet foods, supplies, and healthcare products.
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8]"
                >
                  Start Shopping
                </a>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition-all hover:border-gray-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-gray-900 text-sm">
                          {order.order_number || `Order #${order.id}`}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Placed on {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase font-semibold">Total Paid</div>
                        <div className="text-sm font-extrabold text-gray-900">
                          ₹{parseFloat(order.total_amount).toFixed(0)}
                        </div>
                      </div>
                      <a
                        href={`/receipt/${order.id}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-[#2563EB] hover:text-[#2563EB] shadow-2xs"
                      >
                        <span>Receipt</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  {order.items && order.items.length > 0 && (
                    <div className="pt-4">
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs text-gray-700">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 font-medium">Qty: {item.quantity} ×</span>
                              <span className="font-semibold text-gray-900">{item.product_name}</span>
                            </div>
                            <span className="font-bold text-gray-900">
                              ₹{(item.quantity * parseFloat(item.price)).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Saved Addresses */}
        {activeTab === "addresses" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-sm font-extrabold text-gray-900">
                Delivery Addresses
              </h2>
              <button
                type="button"
                onClick={() => setShowAddAddress(!showAddAddress)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8]"
              >
                <Plus size={14} />
                <span>Add New Address</span>
              </button>
            </div>

            {/* Add Address Form Modal / Box */}
            {showAddAddress && (
              <form
                onSubmit={handleCreateAddress}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-3 text-xs"
              >
                <h3 className="font-bold text-gray-900 text-sm">New Delivery Address</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-gray-600 font-bold mb-1">Address Label</label>
                    <select
                      value={newAddress.tag}
                      onChange={(e) => setNewAddress({ ...newAddress, tag: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2 text-xs outline-none focus:border-[#2563EB]"
                    >
                      <option value="Home">Home</option>
                      <option value="Office">Office / Work</option>
                      <option value="Clinic">Clinic / Pet Hospital</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-600 font-bold mb-1">Phone Number *</label>
                    <input
                      required
                      type="tel"
                      value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      placeholder="10-digit mobile number"
                      className="w-full rounded-xl border border-gray-300 p-2 text-xs outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-gray-600 font-bold mb-1">Flat / House No., Street, Area *</label>
                    <input
                      required
                      type="text"
                      value={newAddress.street_address}
                      onChange={(e) => setNewAddress({ ...newAddress, street_address: e.target.value })}
                      placeholder="e.g. Flat 302, Green Meadows, Banjara Hills Rd 12"
                      className="w-full rounded-xl border border-gray-300 p-2 text-xs outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 font-bold mb-1">City *</label>
                    <input
                      required
                      type="text"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2 text-xs outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 font-bold mb-1">PIN Code *</label>
                    <input
                      required
                      type="text"
                      value={newAddress.pincode}
                      onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                      placeholder="6-digit pincode"
                      className="w-full rounded-xl border border-gray-300 p-2 text-xs outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-[#2563EB] px-4 py-2 font-bold text-white hover:bg-[#1D4ED8]"
                  >
                    Save Address
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddAddress(false)}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {loadingAddresses ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-xs text-gray-500">
                Loading saved addresses...
              </div>
            ) : addresses.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-xs text-gray-500">
                No saved addresses yet. Save your primary delivery address for faster checkout.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#2563EB]">
                        {addr.tag || "Delivery"}
                      </span>
                      {addr.is_default && (
                        <span className="text-[10px] font-bold text-emerald-700">Default</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-gray-900">{addr.street_address}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {addr.city} - {addr.pincode}
                    </p>
                    {addr.phone && (
                      <p className="text-[11px] text-gray-400 mt-1">Phone: {addr.phone}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
