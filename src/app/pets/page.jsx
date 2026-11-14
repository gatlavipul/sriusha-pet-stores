import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import useUser from "@/utils/useUser";
import useCart from "@/utils/useCart";
import PetOnboardingFlow, { getPetEmoji } from "@/components/PetOnboardingFlow";
import {
  PawPrint,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  ShoppingBag,
  Upload,
  Loader2,
  HeartPulse,
  Utensils,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

const SPECIES_STYLES = {
  dog: {
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    banner: "from-amber-50 via-white to-orange-50/40",
    accent: "text-amber-700",
  },
  cat: {
    badge: "bg-[#FEFCE8] text-[#D97706] border-[#FEF08A]",
    banner: "from-[#FEFCE8] via-white to-amber-50/40",
    accent: "text-[#D97706]",
  },
  bird: {
    badge: "bg-[#FFFDF0] text-[#B45309] border-[#FDE68A]",
    banner: "from-[#FFFDF0] via-white to-yellow-50/40",
    accent: "text-[#B45309]",
  },
  other: {
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    banner: "from-emerald-50 via-white to-teal-50/40",
    accent: "text-emerald-700",
  },
};

export default function PetFamilyHubPage() {
  const { data: user, loading: userLoading } = useUser();
  const { addToCart } = useCart();

  const [pets, setPets] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [activePetId, setActivePetId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toast, setToast] = useState(null);

  // Add/Edit Pet Modal
  const [showPetModal, setShowPetModal] = useState(false);
  const [editingPet, setEditingPet] = useState(null);
  const [savingPet, setSavingPet] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
    setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (!userLoading && !user) {
      if (typeof window !== "undefined") {
        window.location.href = "/account/signin?callbackUrl=/pets";
      }
    }
  }, [user, userLoading]);

  const loadPetHub = useCallback(async () => {
    try {
      setLoading(true);
      const [petsRes, recRes] = await Promise.all([
        fetch("/api/pets"),
        fetch("/api/pets/recommendations"),
      ]);

      let loadedPets = [];
      if (petsRes.ok) {
        const data = await petsRes.json();
        loadedPets = data.pets || [];
        setPets(loadedPets);
        if (loadedPets.length > 0) {
          setActivePetId((prev) =>
            prev && loadedPets.some((p) => p.id === prev) ? prev : loadedPets[0].id
          );
          setShowOnboarding(false);
        } else {
          setActivePetId(null);
          setShowOnboarding(!data.onboarding_completed);
        }
      }

      if (recRes.ok) {
        const recData = await recRes.json();
        setRecommendations(recData.recommendations || []);
      }
    } catch (err) {
      console.error("Failed to load Pet Care Hub:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadPetHub();
    }
  }, [user, loadPetHub]);

  const handleQuickAddToCart = async (prod) => {
    await addToCart(
      {
        id: prod.id,
        name: prod.name,
        price: prod.sale_price || prod.price,
        image_url: prod.image_url,
        stock_quantity: prod.stock_quantity,
      },
      1
    );
    notify(`${prod.name} added to cart.`);
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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/pets/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setPetForm((prev) => ({ ...prev, image_url: data.url }));
    } catch (err) {
      notify(err.message || "Could not upload photo", "error");
    } finally {
      setUploadingPhoto(false);
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
      const payload = {
        name: petForm.name.trim(),
        type: petForm.type,
        breed: petForm.breed.trim(),
        age: petForm.age.trim(),
        image_url: petForm.image_url || null,
        preferences: {
          food_preference: petForm.food_preference.trim(),
          care_interests: petForm.care_interests_text
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
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
      if (!res.ok) throw new Error(data.error || "Failed to save pet");

      setShowPetModal(false);
      await loadPetHub();
      if (data.pet?.id) setActivePetId(data.pet.id);
      notify(editingPet ? "Pet passport updated!" : "Pet added to your family!");
    } catch (err) {
      notify(err.message || "Error saving pet", "error");
    } finally {
      setSavingPet(false);
    }
  };

  const handleDeletePet = async (petId) => {
    if (!confirm("Remove this pet passport?")) return;
    try {
      const res = await fetch(`/api/pets/${petId}`, { method: "DELETE" });
      if (res.ok) {
        await loadPetHub();
        notify("Pet passport removed.");
      }
    } catch (err) {
      console.error("Delete pet failed:", err);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <Header />
        <div className="py-24 text-center text-xs font-bold text-gray-500">
          Loading your Pet Care Hub...
        </div>
      </div>
    );
  }

  const activePet = pets.find((p) => p.id === activePetId) || pets[0] || null;
  const activeRec = recommendations.find((r) => r.pet?.id === activePet?.id) || null;
  const style = SPECIES_STYLES[activePet?.type] || SPECIES_STYLES.other;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-16">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
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

        {/* Top Hero & Pet Switcher */}
        <section className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7ED] border border-[#FED7AA] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#F97316]">
                <PawPrint className="h-3.5 w-3.5" /> Sri Usha Pet Family Hub
              </div>
              <h1 className="mt-2.5 text-2xl sm:text-3xl font-black tracking-tight text-stone-900">
                {activePet
                  ? `${activePet.name}'s Care Space`
                  : "Your Pet Care Passport"}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-stone-600">
                Keep each pet&apos;s food, health interests, and store essentials organized in one place.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowOnboarding((prev) => !prev)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
              >
                {showOnboarding ? "Close Wizard" : "Guided Pet Setup"}
              </button>
              <button
                type="button"
                onClick={openAddPetModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#4A0A0F] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#360509]"
              >
                <Plus className="h-3.5 w-3.5" /> Add Pet
              </button>
            </div>
          </div>

          {/* Interactive Pet Selector Pills */}
          {pets.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2.5 border-t border-stone-100 pt-5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 mr-1">
                Switch Pet:
              </span>
              {pets.map((pet) => {
                const isSelected = pet.id === activePet?.id;
                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => setActivePetId(pet.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold border transition-all ${
                      isSelected
                        ? "border-[#4A0A0F] bg-[#4A0A0F] text-white shadow-sm"
                        : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-white hover:border-stone-300"
                    }`}
                  >
                    {pet.image_url ? (
                      <img
                        src={pet.image_url}
                        alt={pet.name}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <span>{getPetEmoji(pet.type)}</span>
                    )}
                    <span>{pet.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Guided Onboarding when no pets or toggled */}
        {showOnboarding && (
          <PetOnboardingFlow
            onCompleted={async (newPet) => {
              setShowOnboarding(false);
              await loadPetHub();
              if (newPet?.id) setActivePetId(newPet.id);
            }}
            onSkip={() => setShowOnboarding(false)}
            onAddToCart={handleQuickAddToCart}
          />
        )}

        {/* Active Pet Passport Card */}
        {activePet && (
          <section
            className={`rounded-3xl border border-gray-200 bg-gradient-to-br ${style.banner} p-6 sm:p-8 shadow-2xs`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-start sm:items-center gap-5">
                {activePet.image_url ? (
                  <img
                    src={activePet.image_url}
                    alt={activePet.name}
                    className="h-24 w-24 rounded-3xl object-cover border-4 border-white shadow-md shrink-0"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white text-5xl shadow-sm border border-gray-200 shrink-0">
                    {getPetEmoji(activePet.type)}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${style.badge}`}
                    >
                      {activePet.type} Passport
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" /> Saved in Neon Profile
                    </span>
                  </div>

                  <h2 className="mt-2 text-2xl font-black text-gray-900">
                    {activePet.name}
                  </h2>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-gray-600">
                    {activePet.breed && <span>Breed: {activePet.breed}</span>}
                    {activePet.age && <span>Age: {activePet.age}</span>}
                    {!activePet.breed && !activePet.age && (
                      <span>Add breed or age anytime using Edit</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditPetModal(activePet)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-2xs"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit Passport
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePet(activePet.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 shadow-2xs"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>

            {/* Care Snapshot Grid */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-extrabold text-stone-900">
                  <Utensils className="h-4 w-4 text-[#F97316]" />
                  Nutrition Preference
                </div>
                <p className="mt-1.5 text-sm font-bold text-stone-800">
                  {activePet.preferences?.food_preference || "Not specified yet"}
                </p>
              </div>

              <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-extrabold text-stone-900">
                  <HeartPulse className="h-4 w-4 text-emerald-600" />
                  Care &amp; Health Focus
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.isArray(activePet.preferences?.care_interests) &&
                  activePet.preferences.care_interests.length > 0 ? (
                    activePet.preferences.care_interests.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800"
                      >
                        <CheckCircle2 className="inline h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-stone-500">
                      General pet care &amp; essentials
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-extrabold text-stone-900">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Quick Category Aisles
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(activeRec?.categories || []).slice(0, 3).map((cat) => (
                    <a
                      key={cat.id}
                      href={`/products?category=${cat.slug}`}
                      className="inline-flex items-center gap-1 rounded-full bg-[#FFF7ED] px-2.5 py-0.5 text-[11px] font-bold text-[#F97316] hover:bg-[#FED7AA]/40"
                    >
                      {cat.name} <ArrowRight className="h-2.5 w-2.5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tailored Product Picks for Active Pet */}
        {activePet && activeRec && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-stone-900">
                  Recommended for {activePet.name} {getPetEmoji(activePet.type)}
                </h2>
                <p className="text-xs text-stone-500">
                  Real in-store products matched to {activePet.name}&apos;s species and care preferences
                </p>
              </div>
              <a
                href={`/products?category=${activePet.type}`}
                className="text-xs font-bold text-[#F97316] hover:underline"
              >
                Shop All {activePet.type} Care →
              </a>
            </div>

            {activeRec.products?.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {activeRec.products.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-4 shadow-2xs"
                  >
                    <div>
                      <a
                        href={`/products/${prod.slug || prod.id}`}
                        className="block aspect-square overflow-hidden rounded-xl bg-stone-50 mb-3"
                      >
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-stone-300">
                            <ShoppingBag className="h-8 w-8" />
                          </div>
                        )}
                      </a>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#F97316]">
                        {prod.category_name}
                      </p>
                      <a
                        href={`/products/${prod.slug || prod.id}`}
                        className="mt-0.5 block text-xs font-extrabold text-stone-900 line-clamp-2 hover:text-[#4A0A0F]"
                      >
                        {prod.name}
                      </a>
                    </div>

                    <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-stone-100">
                      <span className="text-sm font-black text-stone-900">
                        ₹{Number(prod.sale_price || prod.price || 0).toFixed(0)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickAddToCart(prod)}
                        disabled={(prod.stock_quantity ?? 0) <= 0}
                        className="rounded-lg bg-[#4A0A0F] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#360509] disabled:opacity-40"
                      >
                        {(prod.stock_quantity ?? 0) > 0 ? "Add to Cart" : "Sold Out"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-xs text-stone-500">
                Explore all pet products in our{" "}
                <a href="/products" className="font-bold text-[#F97316] hover:underline">
                  Store Catalog
                </a>
                .
              </div>
            )}
          </section>
        )}

        {/* Empty State if skipped and no pets */}
        {!activePet && !showOnboarding && (
          <section className="rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <PawPrint className="mx-auto h-12 w-12 text-stone-300 mb-3" />
            <h2 className="text-lg font-black text-stone-900">
              No Pet Passports Yet
            </h2>
            <p className="mt-1 text-xs text-stone-500 max-w-md mx-auto">
              Create your pet&apos;s profile to unlock tailored food, grooming, and veterinary care recommendations.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowOnboarding(true)}
                className="rounded-xl bg-[#4A0A0F] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#360509]"
              >
                Start Guided Pet Setup
              </button>
              <button
                type="button"
                onClick={openAddPetModal}
                className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
              >
                Quick Add Pet
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Add / Edit Pet Modal */}
      {showPetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-black text-gray-900 mb-4">
              {editingPet ? `Edit ${editingPet.name}'s Passport` : "Add Pet Passport"}
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
                    onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-700">
                    Type *
                  </label>
                  <select
                    value={petForm.type}
                    onChange={(e) => setPetForm({ ...petForm, type: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  >
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="bird">Bird</option>
                    <option value="other">Other Pet</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-stone-700">
                    Age
                  </label>
                  <input
                    type="text"
                    value={petForm.age}
                    onChange={(e) => setPetForm({ ...petForm, age: e.target.value })}
                    placeholder="e.g., 2 years"
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-stone-700">
                    Breed (Optional)
                  </label>
                  <input
                    type="text"
                    value={petForm.breed}
                    onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-stone-700">
                    Food Preference
                  </label>
                  <input
                    type="text"
                    value={petForm.food_preference}
                    onChange={(e) =>
                      setPetForm({ ...petForm, food_preference: e.target.value })
                    }
                    placeholder="e.g., Dry Kibble, Grain-Free"
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-stone-700">
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
                    className="w-full rounded-xl border border-stone-200 px-3.5 py-2 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-3">
                  {petForm.image_url ? (
                    <img
                      src={petForm.image_url}
                      alt="Pet"
                      className="h-12 w-12 rounded-xl object-cover border border-stone-200"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 text-lg">
                      {getPetEmoji(petForm.type)}
                    </div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 px-3.5 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50">
                    {uploadingPhoto ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    <span>{uploadingPhoto ? "Uploading..." : "Upload Pet Photo"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPetModal(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPet}
                  className="rounded-xl bg-[#4A0A0F] px-5 py-2 text-xs font-bold text-white hover:bg-[#360509] disabled:opacity-60"
                >
                  {savingPet ? "Saving..." : editingPet ? "Save Changes" : "Save Pet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

