import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Upload,
  CheckCircle2,
  ShoppingBag,
  Loader2,
  PawPrint,
  Dog,
  Cat,
  Bird,
  Check,
} from "lucide-react";

const PET_TYPES = [
  { id: "dog", label: "Dog", icon: Dog, bg: "bg-[#FFF7ED]", text: "text-[#F97316]", border: "border-[#FED7AA]", desc: "Food, treats, grooming & care" },
  { id: "cat", label: "Cat", icon: Cat, bg: "bg-[#FEFCE8]", text: "text-[#D97706]", border: "border-[#FEF08A]", desc: "Litter, nutrition & hygiene" },
  { id: "bird", label: "Bird", icon: Bird, bg: "bg-[#FFFDF0]", text: "text-[#B45309]", border: "border-[#FDE68A]", desc: "Seeds, vitamins & accessories" },
  { id: "other", label: "Other", icon: PawPrint, bg: "bg-amber-50", text: "text-[#EA580C]", border: "border-amber-200", desc: "Small pets & specialty care" },
];

const CARE_INTEREST_OPTIONS = [
  "Nutrition & Food",
  "Grooming & Hygiene",
  "Veterinary Healthcare",
  "Vitamins & Supplements",
  "Treats & Training",
];

const FOOD_SUGGESTIONS = {
  dog: ["Dry Kibble", "Wet Food", "Grain-Free", "Puppy Starter", "Veterinary Diet"],
  cat: ["Dry Kibble", "Wet Gravy", "Hairball Control", "Kitten Formula", "Veterinary Diet"],
  bird: ["Seed Mix", "Pellets", "Calcium & Grit", "Fruit Blend"],
  other: ["Pellets & Hay", "Fresh & Dry Mix", "Supplement Diet"],
};

export function getPetEmoji(type) {
  return "";
}

export default function PetOnboardingFlow({
  onCompleted,
  onSkip,
  onAddToCart,
  initialStep = "welcome",
}) {
  const [step, setStep] = useState(initialStep); // welcome | basics | preferences | personalization
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [savedPet, setSavedPet] = useState(null);
  const [recommendedProducts, setRecommendedProducts] = useState([]);

  const [form, setForm] = useState({
    name: "",
    type: "dog",
    breed: "",
    age: "",
    food_preference: "",
    care_interests: [],
    image_url: "",
  });

  const handleSelectPetType = (typeId) => {
    setForm((prev) => ({ ...prev, type: typeId }));
    setError("");
    setStep("basics");
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_action: "skip" }),
      });
      if (onSkip) onSkip();
    } catch (err) {
      console.error("Failed to skip onboarding:", err);
      if (onSkip) onSkip();
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (interest) => {
    setForm((prev) => {
      const exists = prev.care_interests.includes(interest);
      return {
        ...prev,
        care_interests: exists
          ? prev.care_interests.filter((i) => i !== interest)
          : [...prev.care_interests, interest],
      };
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/pets/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload photo");
      }
      setForm((prev) => ({ ...prev, image_url: data.url }));
    } catch (err) {
      setError(err.message || "Could not upload pet photo");
    } finally {
      setUploading(false);
    }
  };

  const handleFinish = async () => {
    if (!form.name.trim()) {
      setError("Please enter your pet's name.");
      setStep("basics");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          breed: form.breed.trim(),
          age: form.age.trim(),
          image_url: form.image_url || null,
          preferences: {
            food_preference: form.food_preference.trim(),
            care_interests: form.care_interests,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save pet profile");
      }

      setSavedPet(data.pet);

      // Load real matched products for Step 3 Personalization
      const recRes = await fetch("/api/pets/recommendations");
      if (recRes.ok) {
        const recData = await recRes.json();
        const match = (recData.recommendations || []).find(
          (r) => r.pet?.id === data.pet?.id
        );
        setRecommendedProducts(match?.products || []);
      }

      setStep("personalization");
    } catch (err) {
      setError(err.message || "Failed to save pet profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl border border-stone-200 bg-gradient-to-br from-[#FFFDF9] via-white to-[#FFF7ED] p-6 sm:p-8 shadow-sm">
      {/* Welcome Screen */}
      {step === "welcome" && (
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#F97316] shadow-2xs border border-amber-100">
            <Sparkles className="h-3.5 w-3.5" />
            Personalized Pet Care Setup
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Welcome to the Sri Usha Pet Care Family!
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Tell us who you shop for so we can highlight the right food, grooming, and veterinary essentials.
          </p>

          <p className="mt-6 text-xs font-extrabold uppercase tracking-wider text-stone-500">
            Do you have a pet at home?
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PET_TYPES.map((petType) => {
              const IconComp = petType.icon;
              return (
                <button
                  key={petType.id}
                  type="button"
                  onClick={() => handleSelectPetType(petType.id)}
                  className="group rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-2xs transition-all hover:border-[#F97316] hover:shadow-md"
                >
                  <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center ${petType.bg} border ${petType.border} ${petType.text} mb-2 shadow-2xs group-hover:scale-110 transition-transform`}>
                    <IconComp size={22} strokeWidth={1.75} />
                  </div>
                  <div className="text-sm font-extrabold text-stone-900 group-hover:text-[#4A0A0F]">
                    {petType.label}
                  </div>
                  <div className="mt-1 text-[11px] text-stone-500 leading-snug">
                    {petType.desc}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="text-xs font-bold text-stone-500 hover:text-stone-800 underline underline-offset-4 disabled:opacity-50"
            >
              {saving ? "Saving preference..." : "Skip for now — I'll add my pet later"}
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Pet Basics */}
      {step === "basics" && (
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex items-center justify-between">
            <span className="rounded-full bg-[#FFF7ED] border border-[#FED7AA] px-3 py-1 text-[11px] font-extrabold text-[#F97316]">
              Step 1 of 2 • Pet Basics
            </span>
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs font-semibold text-stone-500 hover:text-stone-800"
            >
              Skip for now
            </button>
          </div>

          <h3 className="text-xl font-black text-stone-900">
            Tell us about your {form.type} {getPetEmoji(form.type)}
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            You can add multiple pets or edit these details anytime in your account.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold text-stone-700">
                Pet Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Bruno, Whiskers, Kiwi"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#F97316]"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-stone-700">
                Pet Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#F97316]"
              >
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
                <option value="bird">Bird</option>
                <option value="other">Other Pet</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-stone-700">
                Age
              </label>
              <input
                type="text"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="e.g., 2 years, 6 months"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#F97316]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-bold text-stone-700">
                Breed (Optional)
              </label>
              <input
                type="text"
                value={form.breed}
                onChange={(e) => setForm({ ...form, breed: e.target.value })}
                placeholder="e.g., Labrador, Persian, Budgie"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#F97316]"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("welcome")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (!form.name.trim()) {
                  setError("Please enter your pet's name to continue.");
                  return;
                }
                setError("");
                setStep("preferences");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#360509]"
            >
              Next: Care Preferences <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Pet Care Preferences */}
      {step === "preferences" && (
        <div className="mx-auto max-w-xl">
          <div className="mb-5 flex items-center justify-between">
            <span className="rounded-full bg-[#FFF7ED] border border-[#FED7AA] px-3 py-1 text-[11px] font-extrabold text-[#F97316]">
              Step 2 of 2 • Care Preferences
            </span>
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              Skip for now
            </button>
          </div>

          <h3 className="text-xl font-black text-gray-900">
            What does {form.name} need most? {getPetEmoji(form.type)}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            Optional preferences help us match store categories and products.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Food Preference
              </label>
              <input
                type="text"
                value={form.food_preference}
                onChange={(e) =>
                  setForm({ ...form, food_preference: e.target.value })
                }
                placeholder="e.g., Dry Kibble, Grain-Free, Royal Canin"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-[#F97316]"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(FOOD_SUGGESTIONS[form.type] || FOOD_SUGGESTIONS.other).map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, food_preference: preset }))
                      }
                      className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-colors ${
                        form.food_preference === preset
                          ? "border-[#4A0A0F] bg-[#4A0A0F] text-white"
                          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      {preset}
                    </button>
                  )
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Health &amp; Care Interests
              </label>
              <div className="flex flex-wrap gap-2">
                {CARE_INTEREST_OPTIONS.map((interest) => {
                  const selected = form.care_interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`rounded-xl px-3 py-2 text-xs font-bold border transition-all ${
                        selected
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {selected ? (
                        <span className="inline-flex items-center gap-1">
                          <Check size={12} strokeWidth={2.5} />
                          <span>{interest}</span>
                        </span>
                      ) : (
                        `+ ${interest}`
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-gray-700">
                Pet Photo (Optional)
              </label>
              <div className="flex items-center gap-4">
                {form.image_url ? (
                  <img
                    src={form.image_url}
                    alt={form.name}
                    className="h-14 w-14 rounded-2xl object-cover border border-gray-200"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white text-xl">
                    {getPetEmoji(form.type)}
                  </div>
                )}
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  <span>{uploading ? "Uploading..." : "Upload Photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep("basics")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving {form.name}...
                </>
              ) : (
                <>
                  Save &amp; Personalize <CheckCircle2 className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Personalization */}
      {step === "personalization" && savedPet && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-amber-100 pb-5 mb-5">
            <div className="flex items-center gap-3.5">
              {savedPet.image_url ? (
                <img
                  src={savedPet.image_url}
                  alt={savedPet.name}
                  className="h-14 w-14 rounded-2xl object-cover border border-white shadow-sm"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm border border-amber-100">
                  {getPetEmoji(savedPet.type)}
                </div>
              )}
              <div>
                <div className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                  <PawPrint className="h-3 w-3" /> Profile Saved
                </div>
                <h3 className="text-xl font-black text-stone-900">
                  Recommended for {savedPet.name} {getPetEmoji(savedPet.type)}
                </h3>
                <p className="text-xs text-stone-600">
                  Matched from Sri Usha&apos;s live store catalog based on{" "}
                  <span className="font-semibold capitalize">{savedPet.type}</span> care categories
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onCompleted && onCompleted(savedPet)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#360509] shrink-0"
            >
              Continue to Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recommendedProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center text-xs text-stone-600">
              Your pet profile is saved! Explore our full catalog on the{" "}
              <a href="/products" className="font-bold text-[#F97316] hover:underline">
                Products Page
              </a>
              .
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommendedProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-3.5 shadow-2xs"
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

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-stone-100">
                    <span className="text-sm font-black text-stone-900">
                      ₹{Number(prod.sale_price || prod.price || 0).toFixed(0)}
                    </span>
                    {onAddToCart && (
                      <button
                        type="button"
                        onClick={() => onAddToCart(prod)}
                        disabled={(prod.stock_quantity ?? 0) <= 0}
                        className="rounded-lg bg-[#4A0A0F] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#360509] disabled:opacity-40"
                      >
                        {(prod.stock_quantity ?? 0) > 0 ? "Add to Cart" : "Out of Stock"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

