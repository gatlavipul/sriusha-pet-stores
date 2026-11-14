import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import useUser from "@/utils/useUser";
import useAuth from "@/utils/useAuth";
import useCart from "@/utils/useCart";
import { useWishlist } from "@/utils/useWishlist";
import useStoreSettings from "@/utils/useStoreSettings";
import PetOnboardingFlow, { getPetEmoji } from "@/components/PetOnboardingFlow";
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
  PawPrint,
  Pencil,
  Trash2,
  ShoppingBag,
  Upload,
  Loader2,
  FileText,
  Sparkles,
  Gift,
  RotateCcw,
  Dog,
  Cat,
  Bird,
  Zap,
} from "lucide-react";

const STATUS_BADGE = {
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  out_for_delivery: "bg-orange-50 text-[#EA580C] border-orange-200",
  delivery_failed: "bg-rose-50 text-rose-700 border-rose-200",
  ready_for_delivery: "bg-amber-50 text-amber-800 border-amber-200",
  assigned: "bg-[#FFF7ED] text-[#F97316] border-[#FED7AA]",
  packing: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-[#FEFCE8] text-[#D97706] border-[#FEF08A]",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function CustomerAccountPage() {
  const { data: user, loading: userLoading } = useUser();
  const { signOut } = useAuth();
  const { addToCart } = useCart();
  const { toggleWishlist } = useWishlist();
  const { telUrl } = useStoreSettings();

  const openClerkProfile = async () => {
    if (typeof window === "undefined") return;
    if (window.Clerk?.openUserProfile) {
      window.Clerk.openUserProfile();
      return;
    }
    window.location.href = "/account/signin?callbackUrl=/account?tab=profile";
  };

  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [pets, setPets] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [loadingWishlist, setLoadingWishlist] = useState(true);
  const [loadingPets, setLoadingPets] = useState(true);

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const tab = new URLSearchParams(window.location.search).get("tab");
      if (["orders", "pets", "addresses", "wishlist", "profile"].includes(tab)) {
        return tab;
      }
    }
    return "orders";
  });

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState(null);

  // Profile edit state
  const [profileName, setProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Address modal/form state
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    name: "",
    phone: "",
    address_line: "",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "",
    is_default: false,
  });

  // Pet Add/Edit modal state
  const [showPetModal, setShowPetModal] = useState(false);
  const [editingPet, setEditingPet] = useState(null);
  const [savingPet, setSavingPet] = useState(false);
  const [uploadingPetPhoto, setUploadingPetPhoto] = useState(false);
  const [petForm, setPetForm] = useState({
    name: "",
    type: "dog",
    breed: "",
    age: "",
    food_preference: "",
    care_interests_text: "",
    image_url: "",
  });

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Guard against unauthenticated visits
  useEffect(() => {
    if (!userLoading && !user) {
      if (typeof window !== "undefined") {
        window.location.href = "/account/signin?callbackUrl=/account";
      }
    }
  }, [user, userLoading]);

  const [rewardsData, setRewardsData] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [activeOffers, setActiveOffers] = useState([]);
  const [pantryItems, setPantryItems] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [healthRecords, setHealthRecords] = useState([]);
  const [healthForm, setHealthForm] = useState({
    pet_id: "",
    record_type: "vaccination",
    title: "",
    record_date: "",
    next_due_date: "",
    clinic_name: "",
    notes: "",
  });
  const [savingHealth, setSavingHealth] = useState(false);

  const handleReorder = async (order) => {
    if (!order?.items || order.items.length === 0) return;
    for (const item of order.items) {
      await addToCart(
        {
          id: item.product_id,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          variant_name: item.variant_name || null,
          name: item.product_name || item.name,
          price: Number(item.unit_price || item.price || 0),
          image_url: item.image_url,
          stock_quantity: 99,
        },
        Number(item.quantity || 1)
      );
    }
    window.location.href = "/cart";
  };

  const fetchProfileAndPets = useCallback(async () => {
    try {
      setLoadingProfile(true);
      setLoadingPets(true);
      const [meRes, petsRes, recRes, rewRes, rxRes, offRes, pantryRes, subRes, healthRes] = await Promise.all([
        fetch("/api/account/me"),
        fetch("/api/pets"),
        fetch("/api/pets/recommendations"),
        fetch("/api/rewards"),
        fetch("/api/prescriptions"),
        fetch("/api/offers"),
        fetch("/api/pantry"),
        fetch("/api/subscriptions"),
        fetch("/api/pets/health"),
      ]);
      if (rewRes?.ok) {
        setRewardsData(await rewRes.json());
      }
      if (rxRes?.ok) {
        const rxData = await rxRes.json();
        setPrescriptions(rxData.prescriptions || []);
      }
      if (offRes?.ok) {
        const offData = await offRes.json();
        setActiveOffers(offData.offers || []);
      }
      if (pantryRes?.ok) {
        const pantryData = await pantryRes.json();
        setPantryItems(pantryData.pantry || []);
      }
      if (subRes?.ok) {
        const subData = await subRes.json();
        setSubscriptions(subData.subscriptions || []);
      }
      if (healthRes?.ok) {
        const healthData = await healthRes.json();
        setHealthRecords(healthData.records || []);
      }

      let loadedProfile = null;
      if (meRes.ok) {
        const meData = await meRes.json();
        loadedProfile = meData.user;
        setProfile(loadedProfile);
        setProfileName(loadedProfile?.name || "");
      }

      let loadedPets = [];
      if (petsRes.ok) {
        const petsData = await petsRes.json();
        loadedPets = petsData.pets || [];
        setPets(loadedPets);

        const completed =
          petsData.onboarding_completed ||
          loadedProfile?.pet_onboarding_completed ||
          loadedPets.length > 0;
        setShowOnboarding(!completed);
      }

      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations(recData.recommendations || []);
      }
    } catch (err) {
      console.error("Failed to fetch profile/pets:", err);
    } finally {
      setLoadingProfile(false);
      setLoadingPets(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setLoadingOrders(true);
      const res = await fetch("/api/orders");
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchAddresses = useCallback(async () => {
    try {
      setLoadingAddresses(true);
      const res = await fetch("/api/addresses");
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses || []);
      }
    } catch (err) {
      console.error("Error fetching addresses:", err);
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  const fetchWishlist = useCallback(async () => {
    try {
      setLoadingWishlist(true);
      const res = await fetch("/api/wishlist");
      if (res.ok) {
        const data = await res.json();
        setWishlistItems(data.items || []);
      }
    } catch (err) {
      console.error("Error fetching wishlist:", err);
    } finally {
      setLoadingWishlist(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfileAndPets();
      fetchOrders();
      fetchAddresses();
      fetchWishlist();
    }
  }, [user, fetchProfileAndPets, fetchOrders, fetchAddresses, fetchWishlist]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim() || profileName.trim().length < 2) {
      notify("Please enter a valid display name.", "error");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/account/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setProfile(data.user);
      notify("Profile name updated.");
    } catch (err) {
      notify(err.message || "Failed to update profile", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setSavingAddress(true);
    try {
      const res = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAddress),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save address");
      setShowAddAddress(false);
      setNewAddress({
        name: "",
        phone: "",
        address_line: "",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "",
        is_default: false,
      });
      fetchAddresses();
      notify("Delivery address saved.");
    } catch (err) {
      notify(err.message || "Error adding address", "error");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSetDefaultAddress = async (id) => {
    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ set_default: true }),
      });
      if (res.ok) {
        fetchAddresses();
        notify("Default address updated.");
      }
    } catch (err) {
      console.error("Failed to set default address:", err);
    }
  };

  const handleDeleteAddress = async (id) => {
    try {
      const res = await fetch(`/api/addresses/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAddresses();
        notify("Address removed.");
      }
    } catch (err) {
      console.error("Failed to delete address:", err);
    }
  };

  const openAddPetModal = () => {
    setEditingPet(null);
    setPetForm({
      name: "",
      type: "dog",
      breed: "",
      age: "",
      food_preference: "",
      care_interests_text: "",
      image_url: "",
    });
    setShowPetModal(true);
  };

  const openEditPetModal = (pet) => {
    setEditingPet(pet);
    setPetForm({
      name: pet.name || "",
      type: pet.type || "dog",
      breed: pet.breed || "",
      age: pet.age || "",
      food_preference: pet.preferences?.food_preference || "",
      care_interests_text: Array.isArray(pet.preferences?.care_interests)
        ? pet.preferences.care_interests.join(", ")
        : "",
      image_url: pet.image_url || "",
    });
    setShowPetModal(true);
  };

  const handlePetPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPetPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/pets/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPetForm((prev) => ({ ...prev, image_url: data.url }));
    } catch (err) {
      notify(err.message || "Photo upload failed", "error");
    } finally {
      setUploadingPetPhoto(false);
    }
  };

  const handleSavePet = async (e) => {
    e.preventDefault();
    if (!petForm.name.trim()) {
      notify("Pet name is required.", "error");
      return;
    }
    setSavingPet(true);
    try {
      const interests = petForm.care_interests_text
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        name: petForm.name.trim(),
        type: petForm.type,
        breed: petForm.breed.trim(),
        age: petForm.age.trim(),
        image_url: petForm.image_url || null,
        preferences: {
          food_preference: petForm.food_preference.trim(),
          care_interests: interests,
        },
      };

      const url = editingPet ? `/api/pets/${editingPet.id}` : "/api/pets";
      const method = editingPet ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save pet");

      setShowPetModal(false);
      await fetchProfileAndPets();
      notify(editingPet ? "Pet profile updated." : "Pet profile added!");
    } catch (err) {
      notify(err.message || "Error saving pet", "error");
    } finally {
      setSavingPet(false);
    }
  };

  const handleDeletePet = async (petId) => {
    if (!confirm("Remove this pet profile?")) return;
    try {
      const res = await fetch(`/api/pets/${petId}`, { method: "DELETE" });
      if (res.ok) {
        await fetchProfileAndPets();
        notify("Pet profile removed.");
      }
    } catch (err) {
      console.error("Delete pet error:", err);
    }
  };

  const handleQuickAddToCart = async (product) => {
    await addToCart(
      {
        id: product.id,
        product_id: product.product_id || product.id,
        variant_id: product.variant_id || null,
        variant_name: product.variant_name || null,
        name: product.name,
        price: product.sale_price || product.price,
        image_url: product.image_url,
        stock_quantity: product.stock_quantity ?? 99,
      },
      1
    );
    notify(`${product.name} added to cart.`);
  };

  const handleSubscribeFromPantry = async (item, frequencyDays = 30) => {
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pet_id: item.pet_id || null,
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          variant_name: item.variant_name || null,
          quantity: 1,
          frequency_days: frequencyDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create subscription");
      await fetchProfileAndPets();
      notify(`Subscribed to ${item.product_name} every ${frequencyDays} days (5% subscriber discount)!`);
      setActiveTab("subscriptions");
    } catch (err) {
      notify(err.message || "Failed to subscribe", "error");
    }
  };

  const handleSubscriptionAction = async (subId, action) => {
    try {
      const res = await fetch(`/api/subscriptions/${subId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Subscription update failed");
      await fetchProfileAndPets();
      notify(`Subscription ${action}d successfully.`);
    } catch (err) {
      notify(err.message || "Failed to update subscription", "error");
    }
  };

  const handleAddHealthRecord = async (e) => {
    e.preventDefault();
    if (!healthForm.pet_id || !healthForm.title.trim()) {
      notify("Select a pet and enter a title (e.g., Rabies Booster).", "error");
      return;
    }
    setSavingHealth(true);
    try {
      const res = await fetch("/api/pets/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(healthForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save record");
      setHealthForm({
        pet_id: "",
        record_type: "vaccination",
        title: "",
        record_date: "",
        next_due_date: "",
        clinic_name: "",
        notes: "",
      });
      await fetchProfileAndPets();
      notify("Health record saved to Pet Health Passport.");
    } catch (err) {
      notify(err.message || "Failed to add health record", "error");
    } finally {
      setSavingHealth(false);
    }
  };

  const handleDeleteHealthRecord = async (recordId) => {
    try {
      const res = await fetch(`/api/pets/health?id=${recordId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove record");
      await fetchProfileAndPets();
      notify("Health record removed.");
    } catch (err) {
      notify(err.message || "Failed to remove record", "error");
    }
  };

  const handleRemoveWishlist = async (item) => {
    await toggleWishlist({ id: item.product_id });
    setWishlistItems((prev) =>
      prev.filter((w) => w.product_id !== item.product_id)
    );
    notify("Removed from wishlist.");
  };

  if (userLoading || loadingProfile) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <Header />
        <div className="py-24 text-center text-xs font-bold text-gray-500">
          Loading your Sri Usha account...
        </div>
      </div>
    );
  }

  const displayName = profile?.name || user?.name || "Customer";
  const displayEmail = profile?.email || user?.email || "";
  const userRole = profile?.role || user?.role || "customer";

  const tabs = [
    { id: "orders", label: "My Orders", icon: Package, count: orders.length },
    { id: "pets", label: "My Pets", icon: PawPrint, count: pets.length },
    {
      id: "pantry",
      label: "Pet Pantry",
      icon: Clock,
      count: pantryItems.filter((p) => p.running_low).length || pantryItems.length,
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      icon: RotateCcw,
      count: subscriptions.filter((s) => s.status === "active").length,
    },
    { id: "rewards", label: "Pet Points", icon: Gift, count: rewardsData?.balance ?? 0 },
    { id: "offers", label: "Offers", icon: Sparkles, count: activeOffers.length },
    { id: "prescriptions", label: "Prescriptions", icon: FileText, count: prescriptions.length },
    { id: "addresses", label: "Addresses", icon: MapPin, count: addresses.length },
    { id: "wishlist", label: "Wishlist", icon: Heart, count: wishlistItems.length },
    { id: "profile", label: "My Profile", icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {toast && (
          <div
            className={`fixed bottom-5 right-5 z-50 rounded-xl px-4 py-3 text-xs font-bold shadow-lg border ${
              toast.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center gap-3.5 sm:gap-4">
            {user?.image ? (
              <img
                src={user.image}
                alt={displayName}
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover border-2 border-[#FED7AA] shadow-sm shrink-0"
              />
            ) : (
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[#4A0A0F] text-xl sm:text-2xl font-black text-white shadow-sm shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-stone-900">
                  {displayName}
                </h1>
                <span className="rounded-full bg-[#FFF7ED] border border-[#FED7AA] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#F97316]">
                  {userRole.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">{displayEmail}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {userRole === "admin" && (
              <a
                href="/admin"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A0A0F] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#360509] min-h-[44px]"
              >
                <Shield className="h-4 w-4" /> Admin Dashboard
              </a>
            )}
            {userRole === "delivery_partner" && (
              <a
                href="/delivery"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#EA580C] min-h-[44px]"
              >
                <Truck className="h-4 w-4" /> Delivery Portal
              </a>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  if (typeof window !== "undefined" && window.Clerk?.signOut) {
                    await window.Clerk.signOut();
                  }
                } catch {}
                signOut({ callbackUrl: "/account/signin" });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs sm:text-sm font-bold text-red-700 hover:bg-red-100 min-h-[44px] transition-colors"
              aria-label="Sign out of account"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>

        {/* First-time Pet Onboarding Flow */}
        {showOnboarding && (
          <PetOnboardingFlow
            onCompleted={async () => {
              setShowOnboarding(false);
              await fetchProfileAndPets();
              setActiveTab("pets");
            }}
            onSkip={() => {
              setShowOnboarding(false);
              fetchProfileAndPets();
            }}
            onAddToCart={handleQuickAddToCart}
          />
        )}

        {/* Personalized Recommendations Strip when customer has pets */}
        {!showOnboarding && recommendations.length > 0 && (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
            {recommendations.slice(0, 2).map(({ pet, categories: matchedCats, products }) => (
              <div key={pet.id} className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#F97316]">
                      <Sparkles className="h-3 w-3" /> Tailored Pet Care
                    </div>
                    <h2 className="text-lg font-black text-gray-900">
                      Recommended for {pet.name} {getPetEmoji(pet.type)}
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(matchedCats || []).slice(0, 3).map((cat) => (
                      <a
                        key={cat.id}
                        href={`/products?category=${cat.slug}`}
                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-bold text-gray-700 hover:border-[#F97316] hover:text-[#F97316]"
                      >
                        {cat.name} →
                      </a>
                    ))}
                  </div>
                </div>

                {products.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {products.map((prod) => (
                      <div
                        key={prod.id}
                        className="flex flex-col justify-between rounded-xl border border-gray-200 bg-[#F8F9FA] p-3"
                      >
                        <div>
                          <a
                            href={`/products/${prod.slug || prod.id}`}
                            className="block aspect-square overflow-hidden rounded-lg bg-white mb-2.5"
                          >
                            {prod.image_url ? (
                              <img
                                src={prod.image_url}
                                alt={prod.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-gray-300">
                                <ShoppingBag className="h-6 w-6" />
                              </div>
                            )}
                          </a>
                          <p className="text-[10px] font-bold uppercase text-[#F97316]">
                            {prod.category_name}
                          </p>
                          <a
                            href={`/products/${prod.slug || prod.id}`}
                            className="text-xs font-extrabold text-gray-900 line-clamp-2 hover:text-[#F97316]"
                          >
                            {prod.name}
                          </a>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-gray-200/70">
                          <span className="text-xs font-black text-gray-900">
                            ₹{Number(prod.sale_price || prod.price || 0).toFixed(0)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuickAddToCart(prod)}
                            disabled={(prod.stock_quantity ?? 0) <= 0}
                            className="rounded-lg bg-[#4A0A0F] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#360509] disabled:opacity-40"
                          >
                            {(prod.stock_quantity ?? 0) > 0 ? "Add" : "Sold Out"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-[#4A0A0F] text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${
                      active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 1: My Orders */}
        {activeTab === "orders" && (
          <section className="space-y-4">
            {loadingOrders ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-xs text-gray-500">
                Loading your order history...
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                <Package className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <h3 className="text-sm font-extrabold text-gray-900">
                  No orders yet
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Start shopping for veterinary care, nutrition, and pet essentials.
                </p>
                <a
                  href="/products"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#360509]"
                >
                  Browse Store
                </a>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3.5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-gray-900">
                          {order.order_number || `SU-${order.id}`}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                            STATUS_BADGE[order.status] ||
                            "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          {(order.status || "placed").replace(/_/g, " ")}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-gray-700">
                          {order.payment_method} • {order.payment_status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Placed on{" "}
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[11px] text-gray-500">Order Total</p>
                        <p className="text-base font-black text-gray-900">
                          ₹{Number(order.total_amount || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {Array.isArray(order.items) && order.items.length > 0 && (
                    <div className="mt-3.5 space-y-2">
                      {order.items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="flex items-center justify-between text-xs text-gray-700"
                        >
                          <span className="font-semibold">
                            {item.product_name || item.name} × {item.quantity}
                          </span>
                          <span className="font-bold text-gray-900">
                            ₹
                            {Number(
                              item.subtotal || item.price * item.quantity || 0
                            ).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleReorder(order)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Buy Again
                    </button>
                    <a
                      href={`/receipt/${order.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="h-3.5 w-3.5" /> Receipt
                    </a>
                    <a
                      href={`/orders/${order.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A0A0F] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#360509]"
                    >
                      <Truck className="h-3.5 w-3.5" /> Track Order
                    </a>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* Tab 2: My Pets */}
        {activeTab === "pets" && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-gray-900">
                  My Pet Profiles
                </h2>
                <p className="text-xs text-gray-500">
                  Manage your pets to keep recommendations and care preferences accurate
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!showOnboarding && (
                  <button
                    type="button"
                    onClick={() => setShowOnboarding(true)}
                    className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Guided Setup
                  </button>
                )}
                <button
                  type="button"
                  onClick={openAddPetModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A0A0F] px-4 py-2 text-xs font-bold text-white hover:bg-[#360509]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Pet
                </button>
              </div>
            </div>

            {loadingPets ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-xs text-gray-500">
                Loading your pets...
              </div>
            ) : pets.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
                <PawPrint className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <h3 className="text-sm font-extrabold text-gray-900">
                  No pet profiles added yet
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Add your dog, cat, bird, or small pet for tailored product suggestions.
                </p>
                <button
                  type="button"
                  onClick={openAddPetModal}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#4A0A0F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#360509]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Your First Pet
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pets.map((pet) => (
                  <div
                    key={pet.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {pet.image_url ? (
                            <img
                              src={pet.image_url}
                              alt={pet.name}
                              className="h-14 w-14 rounded-2xl object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl border border-amber-100">
                              {getPetEmoji(pet.type)}
                            </div>
                          )}
                          <div>
                            <h3 className="text-base font-black text-gray-900">
                              {pet.name}
                            </h3>
                            <p className="text-xs font-semibold text-gray-600 capitalize">
                              {pet.type}
                              {pet.breed ? ` • ${pet.breed}` : ""}
                            </p>
                            {pet.age && (
                              <p className="text-[11px] text-gray-500">
                                Age: {pet.age}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-1.5 text-xs text-gray-600">
                        {pet.preferences?.food_preference && (
                          <p>
                            <span className="font-bold text-gray-800">Food:</span>{" "}
                            {pet.preferences.food_preference}
                          </p>
                        )}
                        {Array.isArray(pet.preferences?.care_interests) &&
                          pet.preferences.care_interests.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {pet.preferences.care_interests.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-[#FFF7ED] px-2.5 py-0.5 text-[10px] font-bold text-[#F97316]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => openEditPetModal(pet)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePet(pet.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pet Health Passport (Records & Reminders Only) */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-black text-gray-900">
                    🩺 Pet Health Passport (Records &amp; Reminders)
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Record-keeping &amp; vaccination/deworming due-date reminders only — consult a veterinarian for medical advice.
                  </p>
                </div>
              </div>

              {pets.length > 0 && (
                <form onSubmit={handleAddHealthRecord} className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <select
                    value={healthForm.pet_id}
                    onChange={(e) => setHealthForm((f) => ({ ...f, pet_id: e.target.value }))}
                    required
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold"
                  >
                    <option value="">Select Pet *</option>
                    {pets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.type || "Pet"})
                      </option>
                    ))}
                  </select>
                  <select
                    value={healthForm.record_type}
                    onChange={(e) => setHealthForm((f) => ({ ...f, record_type: e.target.value }))}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold"
                  >
                    <option value="vaccination">Vaccination</option>
                    <option value="deworming">Deworming</option>
                    <option value="vet_visit">Vet Visit</option>
                    <option value="grooming">Grooming / Checkup</option>
                  </select>
                  <input
                    type="text"
                    required
                    placeholder="Title (e.g. Rabies Booster)"
                    value={healthForm.title}
                    onChange={(e) => setHealthForm((f) => ({ ...f, title: e.target.value }))}
                    className="sm:col-span-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs"
                  />
                  <input
                    type="date"
                    title="Next Due Date"
                    value={healthForm.next_due_date}
                    onChange={(e) => setHealthForm((f) => ({ ...f, next_due_date: e.target.value }))}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs"
                  />
                  <button
                    type="submit"
                    disabled={savingHealth}
                    className="rounded-lg bg-[#4A0A0F] px-3 py-2 text-xs font-bold text-white hover:bg-[#360509] disabled:opacity-50"
                  >
                    {savingHealth ? "Saving..." : "+ Add Record"}
                  </button>
                </form>
              )}

              {healthRecords.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No health records logged yet. Add vaccinations, deworming dates, or vet visits above to receive due-date reminders.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {healthRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-start justify-between rounded-xl border border-gray-200 bg-[#F8F9FA] p-3.5"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#FFF7ED] border border-[#FED7AA] px-2 py-0.5 text-[10px] font-bold uppercase text-[#F97316]">
                            {rec.record_type.replace("_", " ")}
                          </span>
                          <span className="text-xs font-black text-gray-900">
                            {rec.pet_name}: {rec.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-600 flex flex-wrap gap-3">
                          {rec.next_due_date && (
                            <span
                              className={`font-bold ${
                                rec.days_until_due !== null && rec.days_until_due <= 14
                                  ? "text-amber-700"
                                  : "text-gray-700"
                              }`}
                            >
                              Next due: {new Date(rec.next_due_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                              {rec.days_until_due !== null &&
                                (rec.days_until_due < 0
                                  ? ` (${Math.abs(rec.days_until_due)}d overdue)`
                                  : rec.days_until_due === 0
                                  ? " (Due today)"
                                  : ` (in ${rec.days_until_due}d)`)}
                            </span>
                          )}
                          {rec.clinic_name && <span>Clinic: {rec.clinic_name}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteHealthRecord(rec.id)}
                        className="text-gray-400 hover:text-rose-600 p-1"
                        title="Remove record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab: Pet Pantry (Smart Consumption Predictor) */}
        {activeTab === "pantry" && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
              <h2 className="flex items-center gap-2 text-lg font-black text-gray-900">
                <Package size={20} strokeWidth={1.75} className="text-[#F97316]" />
                <span>Smart Pet Pantry</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Calculates estimated pack consumption from your real order history and pet weight so you never run out of essentials.
              </p>
            </div>
            {pantryItems.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                <Clock className="mx-auto h-9 w-9 text-gray-300 mb-2" />
                <p className="text-sm font-bold text-gray-700">No Pantry Predictions Yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  Once you place an order for food, treats, or essentials, your Pet Pantry will track usage automatically.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pantryItems.map((item) => (
                  <div
                    key={`${item.product_id}-${item.variant_id || 0}`}
                    className={`rounded-2xl border bg-white p-5 shadow-2xs space-y-3 ${
                      item.running_low ? "border-amber-300 bg-amber-50/30" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="h-12 w-12 rounded-xl object-contain bg-gray-50 border border-gray-100"
                          />
                        )}
                        <div>
                          <h3 className="text-sm font-black text-gray-900">{item.product_name}</h3>
                          <p className="text-[11px] text-gray-500">
                            {item.variant_name || "Standard Pack"} • Last ordered {item.days_since_order ?? 0}d ago
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          item.running_low
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {item.percent_consumed}% Used
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.running_low ? "bg-amber-500" : "bg-[#F97316]"
                        }`}
                        style={{ width: `${Math.min(100, item.percent_consumed)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>
                        {item.pet_name ? `${item.pet_name}'s ~${item.estimated_cycle_days}d cycle` : `Est. ~${item.estimated_cycle_days}d pack`}
                      </span>
                      <span className="font-bold text-gray-900">
                        {item.estimated_days_remaining > 0 ? `~${item.estimated_days_remaining} days left` : "Likely finished"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickAddToCart({
                            id: item.product_id,
                            product_id: item.product_id,
                            variant_id: item.variant_id,
                            variant_name: item.variant_name,
                            name: item.product_name,
                            price: item.price,
                            image_url: item.image_url,
                          })
                        }
                        className="rounded-xl bg-[#4A0A0F] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#360509]"
                      >
                        1-Tap Reorder (₹{Number(item.price || 0).toFixed(0)})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubscribeFromPantry(item, 30)}
                        className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                      >
                        Subscribe 30d (5% Off)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: Pet Subscriptions */}
        {activeTab === "subscriptions" && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
              <h2 className="flex items-center gap-2 text-lg font-black text-gray-900">
                <RotateCcw size={20} strokeWidth={1.75} className="text-[#F97316]" />
                <span>Flexible Pet Subscriptions</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                5% subscriber savings on recurring pet food &amp; essentials. Skip, pause, or cancel in one tap anytime.
              </p>
            </div>
            {subscriptions.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
                <RotateCcw className="mx-auto h-9 w-9 text-gray-300 mb-2" />
                <p className="text-sm font-bold text-gray-700">No Active Subscriptions</p>
                <p className="text-xs text-gray-500 mt-1">
                  Start a 30, 60, or 90-day subscription from your Pet Pantry tab to save 5% automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      {sub.image_url && (
                        <img
                          src={sub.image_url}
                          alt={sub.product_name}
                          className="h-14 w-14 rounded-xl object-contain bg-gray-50 border border-gray-100"
                        />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-gray-900">{sub.product_name}</h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              sub.status === "active"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : sub.status === "paused"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {sub.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {sub.variant_name || "Standard"} • Every {sub.frequency_days} days • {sub.discount_percent}% Off
                          {sub.pet_name ? ` • For ${sub.pet_name}` : ""}
                        </p>
                        {sub.next_delivery_date && sub.status !== "cancelled" && (
                          <p className="text-xs font-bold text-[#4A0A0F] mt-1">
                            Next Delivery: {new Date(sub.next_delivery_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                          </p>
                        )}
                      </div>
                    </div>

                    {sub.status !== "cancelled" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSubscriptionAction(sub.id, "skip")}
                          className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
                        >
                          Skip Next (+{sub.frequency_days}d)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSubscriptionAction(sub.id, sub.status === "active" ? "pause" : "resume")
                          }
                          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                        >
                          {sub.status === "active" ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubscriptionAction(sub.id, "cancel")}
                          className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Saved Addresses */}
        {activeTab === "addresses" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-gray-900">
                  Saved Delivery Addresses
                </h2>
                <p className="text-xs text-gray-500">
                  Manage addresses for faster checkout
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAddress(!showAddAddress)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A0A0F] px-4 py-2 text-xs font-bold text-white hover:bg-[#360509]"
              >
                <Plus className="h-3.5 w-3.5" /> Add Address
              </button>
            </div>

            {showAddAddress && (
              <form
                onSubmit={handleAddAddress}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4"
              >
                <h3 className="text-sm font-extrabold text-gray-900">
                  New Delivery Address
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Recipient / Address Label *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddress.name}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, name: e.target.value })
                      }
                      placeholder="e.g., Home - Vipul"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none focus:border-[#F97316]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={newAddress.phone}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, phone: e.target.value })
                      }
                      placeholder="10-digit mobile number"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none focus:border-[#F97316]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Street Address / Flat &amp; Landmark *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddress.address_line}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          address_line: e.target.value,
                        })
                      }
                      placeholder="House No, Street, Area"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none focus:border-[#F97316]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddress.city}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, city: e.target.value })
                      }
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none focus:border-[#F97316]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Pincode *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddress.pincode}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          pincode: e.target.value,
                        })
                      }
                      placeholder="e.g., 500001"
                      className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-xs outline-none focus:border-[#F97316]"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={newAddress.is_default}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        is_default: e.target.checked,
                      })
                    }
                  />
                  Set as default delivery address
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAddress(false)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAddress}
                    className="rounded-xl bg-[#4A0A0F] px-5 py-2 text-xs font-bold text-white hover:bg-[#360509] disabled:opacity-60"
                  >
                    {savingAddress ? "Saving..." : "Save Address"}
                  </button>
                </div>
              </form>
            )}

            {loadingAddresses ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-xs text-gray-500">
                Loading saved addresses...
              </div>
            ) : addresses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-xs text-gray-500">
                No saved addresses yet. Add one above for faster checkout.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`rounded-2xl border bg-white p-5 shadow-2xs flex flex-col justify-between ${
                      addr.is_default ? "border-[#4A0A0F]" : "border-gray-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-black text-gray-900">
                          {addr.name}
                        </span>
                        {addr.is_default && (
                          <span className="rounded-full bg-[#FFF7ED] border border-[#FED7AA] px-2.5 py-0.5 text-[10px] font-extrabold text-[#F97316]">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700">
                        {addr.address_line}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                      <p className="text-xs font-semibold text-gray-500 mt-1">
                        Phone: {addr.phone}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                      {!addr.is_default && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultAddress(addr.id)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 4: Wishlist */}
        {activeTab === "wishlist" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">
                Saved Wishlist
              </h2>
              <a
                href="/products"
                className="text-xs font-bold text-[#4A0A0F] hover:text-[#F97316] hover:underline"
              >
                Explore Products →
              </a>
            </div>

            {loadingWishlist ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-xs text-gray-500">
                Loading wishlist...
              </div>
            ) : wishlistItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-xs text-gray-500">
                Your wishlist is empty. Tap the heart icon on any product to save it here.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {wishlistItems.map((item) => (
                  <div
                    key={item.id || item.product_id}
                    className="flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs"
                  >
                    <div>
                      <a
                        href={`/products/${item.slug || item.product_id}`}
                        className="block aspect-square overflow-hidden rounded-xl bg-gray-50 mb-3"
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-300">
                            <ShoppingBag className="h-8 w-8" />
                          </div>
                        )}
                      </a>
                      <p className="text-[10px] font-bold uppercase text-[#F97316]">
                        {item.category_name}
                      </p>
                      <a
                        href={`/products/${item.slug || item.product_id}`}
                        className="mt-0.5 block text-xs font-extrabold text-gray-900 line-clamp-2 hover:text-[#F97316]"
                      >
                        {item.name}
                      </a>
                      <p className="mt-1.5 text-sm font-black text-gray-900">
                        ₹{Number(item.sale_price || item.price || 0).toFixed(0)}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickAddToCart({
                            id: item.product_id,
                            name: item.name,
                            price: item.sale_price || item.price,
                            image_url: item.image_url,
                            stock_quantity: item.stock_quantity,
                          })
                        }
                        className="flex-1 rounded-xl bg-[#4A0A0F] py-2 text-xs font-bold text-white hover:bg-[#360509]"
                      >
                        Add to Cart
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveWishlist(item)}
                        className="rounded-xl border border-gray-200 p-2 text-rose-600 hover:bg-rose-50"
                        title="Remove from wishlist"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab: Sri Usha Rewards */}
        {activeTab === "rewards" && (
          <section className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xs">
                <p className="text-xs font-bold text-gray-500 uppercase">Available Points</p>
                <p className="text-3xl font-black text-[#27AE60] mt-1">
                  {rewardsData?.balance ?? 0}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  1 pt = ₹{rewardsData?.config?.pointValueInr ?? 1}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
                <p className="text-xs font-bold text-gray-500 uppercase">Total Points Earned</p>
                <p className="text-3xl font-black text-gray-900 mt-1">
                  {rewardsData?.lifetimePoints ?? 0}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
                <p className="text-xs font-bold text-gray-500 uppercase">Points Redeemed</p>
                <p className="text-3xl font-black text-[#4A0A0F] mt-1">
                  {rewardsData?.redeemedPoints ?? 0}
                </p>
              </div>
            </div>

            {rewardsData?.config?.campaignName && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs font-semibold text-amber-900">
                Active Campaign: <strong>{rewardsData.config.campaignName}</strong> (
                {rewardsData.config.campaignMultiplier}x earning • Earn{" "}
                {rewardsData.config.pointsPer100} pts per ₹100 on delivered orders)
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
              <h3 className="text-sm font-extrabold text-gray-900 mb-3">Reward History</h3>
              {!rewardsData?.transactions?.length ? (
                <p className="text-xs text-gray-500">
                  Complete your first order to start earning Sri Usha Rewards!
                </p>
              ) : (
                <div className="divide-y divide-gray-100 text-xs">
                  {rewardsData.transactions.map((tx) => (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-800">{tx.description}</p>
                        <p className="text-[11px] text-gray-400">
                          {new Date(tx.created_at).toLocaleString("en-IN")}
                        </p>
                      </div>
                      <span
                        className={`font-black ${
                          tx.points >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {tx.points >= 0 ? `+${tx.points}` : tx.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab: Active Offers */}
        {activeTab === "offers" && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
              <h2 className="text-base font-black text-gray-900 mb-3">
                Available Offers &amp; Promo Codes
              </h2>
              {activeOffers.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No active promo codes right now. Check back soon for festival specials!
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-2xl border border-dashed border-[#FED7AA] bg-[#FFF7ED] p-4 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <span className="inline-block rounded-lg bg-[#4A0A0F] px-2.5 py-1 font-black text-white tracking-wider">
                          {offer.code}
                        </span>
                        <p className="font-bold text-gray-900 mt-1.5">{offer.title}</p>
                        <p className="text-gray-600 mt-0.5">
                          {offer.discount_type === "percentage"
                            ? `${offer.discount_value}% OFF`
                            : `₹${offer.discount_value} OFF`}
                          {Number(offer.min_order_amount) > 0
                            ? ` on orders above ₹${offer.min_order_amount}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== "undefined" && navigator.clipboard) {
                            navigator.clipboard.writeText(offer.code);
                            setToast(`Copied ${offer.code}! Apply it in Cart or Checkout.`);
                            setTimeout(() => setToast(null), 2500);
                          }
                        }}
                        className="rounded-xl border border-[#4A0A0F] bg-white px-3 py-1.5 font-bold text-[#4A0A0F] hover:bg-[#FFF7ED] shrink-0"
                      >
                        Copy Code
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab: Prescriptions */}
        {activeTab === "prescriptions" && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs">
              <h2 className="text-base font-black text-gray-900 mb-3">
                Uploaded Veterinary Prescriptions
              </h2>
              {prescriptions.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No prescriptions uploaded yet. When you order prescription medicines, you can upload your vet Rx during checkout.
                </p>
              ) : (
                <div className="space-y-3">
                  {prescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{rx.original_filename}</span>
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
                        </div>
                        <p className="text-gray-500 mt-1">
                          Uploaded {new Date(rx.created_at).toLocaleString("en-IN")}
                          {rx.order_number ? ` • Order ${rx.order_number}` : ""}
                        </p>
                        {rx.notes && <p className="text-gray-600 mt-1">Note: {rx.notes}</p>}
                      </div>
                      <a
                        href={`/api/prescriptions/${rx.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-[#4A0A0F] hover:text-[#F97316] hover:underline"
                      >
                        View File
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Tab 5: My Profile */}
        {activeTab === "profile" && (
          <section className="grid gap-6 md:grid-cols-2">
            <form
              onSubmit={handleSaveProfile}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-2xs space-y-4"
            >
              <h2 className="text-base font-black text-gray-900">
                Customer Details
              </h2>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  Verified Email Address
                </label>
                <input
                  type="email"
                  value={displayEmail}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-700">
                  Account Role (Neon Verified)
                </label>
                <p className="rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs font-bold uppercase text-gray-700">
                  {userRole}
                </p>
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-xl bg-[#4A0A0F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#360509] disabled:opacity-60"
              >
                {savingProfile ? "Saving..." : "Save Profile Name"}
              </button>
            </form>

            {/* Innovative Pet Passport & VIP Pet Care Hub */}
            <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-orange-50/40 to-white p-6 shadow-2xs flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PawPrint size={20} strokeWidth={1.75} className="text-[#4A0A0F]" />
                    <h2 className="text-base font-black text-gray-900">
                      Sri Usha Pet Passport
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800 tracking-wide">
                    <Zap size={10} className="fill-emerald-800 text-emerald-800" />
                    <span>Fast Pass</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                  Your personalized pet health, nutrition schedule, and quick-delivery preferences.
                </p>

                {/* Pet Quick Glance */}
                <div className="mt-4 rounded-xl border border-amber-200/60 bg-white/90 p-3.5">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-gray-700">Registered Fur Babies</span>
                    <span className="font-black text-[#EA580C]">{pets.length} Pet{pets.length === 1 ? "" : "s"}</span>
                  </div>
                  {pets.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {pets.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-xs font-bold text-gray-800"
                        >
                          <span>{p.type === "cat" ? <Cat size={13} className="text-[#D97706]" strokeWidth={1.75} /> : p.type === "bird" ? <Bird size={13} className="text-[#B45309]" strokeWidth={1.75} /> : <Dog size={13} className="text-[#F97316]" strokeWidth={1.75} />}</span>
                          <span>{p.name}</span>
                          <span className="text-[10px] font-normal text-gray-500">
                            ({p.breed || p.type})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      No pets linked yet. Add your pet to unlock auto-diet predictions and vaccine alerts!
                    </p>
                  )}
                </div>

                {/* Hyperlocal Vet Helpline */}
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#FFF7ED] border border-[#FED7AA] p-3 text-xs">
                  <div>
                    <p className="font-bold text-[#4A0A0F]">Sri Usha Vet &amp; Pet Helpline</p>
                    <p className="text-[11px] text-stone-600 font-medium">Uppal, Hyderabad • Store Assistance</p>
                  </div>
                  <a
                    href={telUrl}
                    className="rounded-lg bg-[#4A0A0F] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#360509]"
                  >
                    Call Vet
                  </a>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditingPet(null);
                    setPetFormData({
                      name: "",
                      type: "dog",
                      breed: "",
                      age: "",
                      weight: "",
                      allergies: "",
                      dietary_preferences: "",
                      medical_history: "",
                      image_url: "",
                    });
                    setShowPetModal(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#EA580C] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#D94E07] shadow-xs transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add New Pet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pets")}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-800 hover:bg-gray-50 shadow-xs transition-colors"
                >
                  <Heart className="h-3.5 w-3.5 text-rose-500" />
                  <span>View Pet Hub</span>
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Add / Edit Pet Modal */}
      {showPetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-black text-gray-900 mb-4">
              {editingPet ? `Edit ${editingPet.name}` : "Add New Pet Profile"}
            </h3>

            <form onSubmit={handleSavePet} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Pet Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={petForm.name}
                    onChange={(e) =>
                      setPetForm({ ...petForm, name: e.target.value })
                    }
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Type *
                  </label>
                  <select
                    value={petForm.type}
                    onChange={(e) =>
                      setPetForm({ ...petForm, type: e.target.value })
                    }
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  >
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="bird">Bird</option>
                    <option value="other">Other Pet</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Age
                  </label>
                  <input
                    type="text"
                    value={petForm.age}
                    onChange={(e) =>
                      setPetForm({ ...petForm, age: e.target.value })
                    }
                    placeholder="e.g., 2 years"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Breed (Optional)
                  </label>
                  <input
                    type="text"
                    value={petForm.breed}
                    onChange={(e) =>
                      setPetForm({ ...petForm, breed: e.target.value })
                    }
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Food Preference
                  </label>
                  <input
                    type="text"
                    value={petForm.food_preference}
                    onChange={(e) =>
                      setPetForm({
                        ...petForm,
                        food_preference: e.target.value,
                      })
                    }
                    placeholder="e.g., Dry Kibble, Grain-Free"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Care Interests (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={petForm.care_interests_text}
                    onChange={(e) =>
                      setPetForm({
                        ...petForm,
                        care_interests_text: e.target.value,
                      })
                    }
                    placeholder="e.g., Nutrition, Grooming, Supplements"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-3">
                  {petForm.image_url ? (
                    <img
                      src={petForm.image_url}
                      alt="Pet"
                      className="h-12 w-12 rounded-xl object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-lg">
                      {getPetEmoji(petForm.type)}
                    </div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
                    {uploadingPetPhoto ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {uploadingPetPhoto ? "Uploading..." : "Upload Pet Photo"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePetPhotoUpload}
                      className="hidden"
                      disabled={uploadingPetPhoto}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPetModal(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPet}
                  className="rounded-xl bg-[#4A0A0F] px-5 py-2 text-xs font-bold text-white hover:bg-[#360509] disabled:opacity-60"
                >
                  {savingPet ? "Saving..." : editingPet ? "Save Changes" : "Add Pet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
