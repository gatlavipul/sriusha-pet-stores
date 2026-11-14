import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import ProductCard from "@/components/ProductCard";
import useCart from "@/utils/useCart";
import useUser from "@/utils/useUser";
import { useWishlist } from "@/utils/useWishlist";
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  HeartHandshake,
  Stethoscope,
  Star,
  Check,
  Phone,
  Clock,
  Sparkles,
  ShoppingBag,
  Heart,
  Dog,
  Cat,
  Bird,
  Bone,
  Scissors,
  Package,
  Tag,
  Zap,
} from "lucide-react";

const CATEGORY_STYLE_MAP = {
  dog: {
    icon: Dog,
    bg: "bg-[#FFF7ED]",
    text: "text-[#F97316]",
    border: "border-[#FED7AA]",
    label: "Dog Care",
  },
  cat: {
    icon: Cat,
    bg: "bg-[#FEFCE8]",
    text: "text-[#D97706]",
    border: "border-[#FEF08A]",
    label: "Cat Care",
  },
  bird: {
    icon: Bird,
    bg: "bg-sky-50",
    text: "text-[#0284C7]",
    border: "border-sky-200",
    label: "Birds & Aviary",
  },
  "pet-food": {
    icon: Bone,
    bg: "bg-[#FFF1F2]",
    text: "text-[#4A0A0F]",
    border: "border-rose-200",
    label: "Pet Food & Nutrition",
  },
  grooming: {
    icon: Scissors,
    bg: "bg-purple-50",
    text: "text-[#7C3AED]",
    border: "border-purple-200",
    label: "Grooming & Hygiene",
  },
  healthcare: {
    icon: Stethoscope,
    bg: "bg-emerald-50",
    text: "text-[#059669]",
    border: "border-emerald-200",
    label: "Veterinary Healthcare",
  },
};

export default function HomePage() {
  const { addToCart } = useCart();
  const { data: user } = useUser();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [addedIds, setAddedIds] = useState({});
  const [buyAgainItems, setBuyAgainItems] = useState([]);
  const [primaryPetName, setPrimaryPetName] = useState("");
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [pantryAlerts, setPantryAlerts] = useState([]);

  // Live delivery zone settings from localStorage or serviceability API
  const [deliveryInfo, setDeliveryInfo] = useState({
    pincode: "500039",
    areaName: "Uppal",
    serviceable: true,
    estimatedDeliveryTime: "30-60 mins",
    freeDeliveryThreshold: 499,
  });

  useEffect(() => {
    const loadDeliveryInfo = () => {
      try {
        const raw = localStorage.getItem("usha_delivery_info");
        if (raw) {
          setDeliveryInfo(JSON.parse(raw));
        } else {
          const pin = localStorage.getItem("usha_delivery_pincode") || "500039";
          fetch(`/api/serviceability?pincode=${pin}&subtotal=500`)
            .then((r) => r.json())
            .then((d) => {
              if (d) {
                setDeliveryInfo({
                  pincode: pin,
                  areaName: d.areaName || "Uppal",
                  serviceable: Boolean(d.serviceable),
                  estimatedDeliveryTime: d.estimatedDeliveryTime || "30-60 mins",
                  freeDeliveryThreshold: d.freeDeliveryThreshold || 499,
                });
              }
            })
            .catch(() => {});
        }
      } catch {}
    };
    loadDeliveryInfo();
    window.addEventListener("delivery-info-updated", loadDeliveryInfo);
    return () => window.removeEventListener("delivery-info-updated", loadDeliveryInfo);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("usha_recently_viewed");
        if (raw) setRecentlyViewed(JSON.parse(raw).slice(0, 4));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setBuyAgainItems([]);
      setPantryAlerts([]);
      return;
    }
    Promise.all([
      fetch("/api/orders").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/pets").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/pantry").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([ordData, petData, pantryData]) => {
        if (petData?.pets?.length > 0) {
          setPrimaryPetName(petData.pets[0].name || "");
        }
        if (pantryData?.pantry?.length > 0) {
          setPantryAlerts(pantryData.pantry.filter((item) => item.running_low).slice(0, 2));
        } else {
          setPantryAlerts([]);
        }
        const seen = new Map();
        for (const ord of ordData?.orders || []) {
          for (const it of ord.items || []) {
            if (it.product_id && !seen.has(it.product_id)) {
              seen.set(it.product_id, {
                id: it.product_id,
                product_id: it.product_id,
                variant_id: it.variant_id || null,
                variant_name: it.variant_name || null,
                name: it.product_name || it.name,
                price: it.price,
                image_url: it.product_image || it.image_url,
                stock_quantity: 99,
              });
            }
          }
        }
        setBuyAgainItems(Array.from(seen.values()).slice(0, 4));
      })
      .catch(() => {});
  }, [user]);

  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetch("/api/categories").then((res) => res.json()),
  });

  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["featuredProducts"],
    queryFn: () => fetch("/api/products?limit=8").then((res) => res.json()),
  });

  const categories = categoriesData?.categories || [];
  const featuredProducts = productsData?.products || [];

  const handleQuickAdd = async (product, e) => {
    e.preventDefault();
    e.stopPropagation();
    await addToCart(product, 1);
    setAddedIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [product.id]: false }));
    }, 1600);
  };

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819]">
      <Header />

      {/* 1. Slim Real Delivery Zone Bar (Shown once under Header on Home Page) */}
      <div className="bg-[#FAF7F2] border-b border-[#EADBCC] py-2 px-3 sm:px-6">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 truncate">
            <span className="flex h-2 w-2 rounded-full bg-[#F97316] animate-pulse shrink-0" />
            <span className="truncate text-[#4A0A0F] font-medium">
              Delivering to <strong className="font-bold">{deliveryInfo.areaName} ({deliveryInfo.pincode})</strong> in {deliveryInfo.estimatedDeliveryTime} • Free delivery above ₹{deliveryInfo.freeDeliveryThreshold}
            </span>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-location-modal"))}
            className="shrink-0 text-xs font-bold text-[#F97316] hover:text-[#EA580C] hover:underline"
          >
            Change
          </button>
        </div>
      </div>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#FFFDF9] via-[#FAF7F2] to-white border-b border-stone-200/80 py-12 sm:py-20">
        {/* Soft Warm Brand Glow */}
        <div className="absolute top-0 right-1/4 -z-10 h-96 w-96 rounded-full bg-orange-100/40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -z-10 h-72 w-72 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Copy */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-3.5 py-1.5 text-xs font-bold text-[#4A0A0F] shadow-2xs">
                <span className="flex h-2 w-2 rounded-full bg-[#F97316] animate-pulse" />
                <span>Hyderabad&apos;s Local Pet &amp; Veterinary Store</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#4A0A0F] leading-tight">
                Pure Nutrition &amp; Loving Care for Your Pets
              </h1>

              <p className="mt-5 max-w-2xl text-base sm:text-lg text-stone-600 leading-relaxed mx-auto lg:mx-0">
                Premium food, veterinary medicines, grooming essentials, and prescription nutrition. Fast, same-day delivery across Hyderabad.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                <a
                  href="/products"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#4A0A0F] px-7 py-3.5 text-sm font-bold text-white shadow-md hover:bg-[#360509] hover:shadow-lg transition-all"
                >
                  <ShoppingBag size={18} strokeWidth={1.75} />
                  <span>Shop Best Sellers</span>
                  <ArrowRight size={16} strokeWidth={1.75} />
                </a>
                <a
                  href="/products?category=dog"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[#EADBCC] bg-white px-6 py-3.5 text-sm font-bold text-[#4A0A0F] shadow-2xs hover:bg-[#FAF7F2] hover:border-[#D6C5B3] transition-all"
                >
                  Explore Dog Care
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="mt-10 pt-6 border-t border-stone-200/80 grid grid-cols-3 gap-4 text-center lg:text-left">
                <div>
                  <div className="text-2xl font-black text-[#4A0A0F]">10,000+</div>
                  <div className="text-xs text-stone-500 font-medium">Happy Pets Served</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-[#F97316]">30-60m</div>
                  <div className="text-xs text-stone-500 font-medium">Local Quick Delivery</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-[#4A0A0F]">Hyderabad</div>
                  <div className="text-xs text-stone-500 font-medium">Uppal Store Dispatch</div>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Card */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white p-3 shadow-xl">
                  <img
                    src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80"
                    alt="Happy Dog with Loving Pet Parent"
                    width={800}
                    height={500}
                    className="h-80 w-full object-cover rounded-2xl"
                  />
                  <div className="p-4 bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#F97316] uppercase tracking-wider">
                          Verified Care
                        </div>
                        <div className="text-base font-bold text-[#4A0A0F]">
                          Quality Pet Food &amp; Essentials
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-[#FEFCE8] border border-[#FEF08A] rounded-full px-2.5 py-1 text-xs font-bold text-amber-800">
                        <Star size={13} className="fill-[#FACC15] text-[#FACC15]" />
                        <span>4.9 / 5</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating pill badge */}
                <div className="absolute -bottom-4 -left-4 rounded-2xl bg-white border border-stone-200 p-3 shadow-lg flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#F97316]">
                    <Truck size={20} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#4A0A0F]">Express Local Delivery</div>
                    <div className="text-[11px] text-stone-500">Free over ₹499 in {deliveryInfo.areaName}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Value Proposition Highlights */}
      <section className="border-b border-stone-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#4A0A0F]">
                <ShieldCheck size={24} strokeWidth={1.75} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#4A0A0F]">Verified Quality</h4>
                <p className="text-xs text-stone-500">Fresh stock direct from brands</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316]">
                <Truck size={24} strokeWidth={1.75} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#4A0A0F]">30-60m Delivery</h4>
                <p className="text-xs text-stone-500">Quick dispatch in Hyderabad</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Stethoscope size={24} strokeWidth={1.75} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#4A0A0F]">Veterinary Advice</h4>
                <p className="text-xs text-stone-500">Diet and wellness guidance</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FEFCE8] text-[#D97706]">
                <HeartHandshake size={24} strokeWidth={1.75} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#4A0A0F]">Cash on Delivery</h4>
                <p className="text-xs text-stone-500">Pay safely at your doorstep</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Quick Category Icons Row (Rounded circles with brand tint backgrounds) */}
      <section className="py-8 bg-[#FFFDF9] border-b border-stone-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F97316]">
              Quick Categories
            </h3>
            <a href="/products" className="text-xs font-bold text-[#4A0A0F] hover:text-[#F97316]">
              All Categories →
            </a>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4 text-center">
            {[
              { slug: "dog", label: "Dog", icon: Dog, bg: "bg-[#FFF7ED]", text: "text-[#F97316]", border: "border-[#FED7AA]" },
              { slug: "cat", label: "Cat", icon: Cat, bg: "bg-[#FEFCE8]", text: "text-[#D97706]", border: "border-[#FEF08A]" },
              { slug: "bird", label: "Birds", icon: Bird, bg: "bg-sky-50", text: "text-[#0284C7]", border: "border-sky-200" },
              { slug: "pet-food", label: "Pet Food", icon: Bone, bg: "bg-[#FFF1F2]", text: "text-[#4A0A0F]", border: "border-rose-200" },
              { slug: "grooming", label: "Grooming", icon: Scissors, bg: "bg-purple-50", text: "text-[#7C3AED]", border: "border-purple-200" },
              { slug: "healthcare", label: "Vet Health", icon: Stethoscope, bg: "bg-emerald-50", text: "text-[#059669]", border: "border-emerald-200" },
            ].map((cat) => {
              const IconComp = cat.icon;
              return (
                <a
                  key={cat.slug}
                  href={`/products?category=${cat.slug}`}
                  className="group flex flex-col items-center p-2 rounded-2xl hover:bg-[#FAF7F2] transition-colors"
                >
                  <div
                    className={`h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center ${cat.bg} border ${cat.border} ${cat.text} shadow-2xs group-hover:scale-108 transition-transform duration-200`}
                  >
                    <IconComp size={26} strokeWidth={1.75} />
                  </div>
                  <span className="mt-2 text-xs font-bold text-[#4A0A0F] group-hover:text-[#F97316] transition-colors">
                    {cat.label}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Shop by Category with Real Photos */}
      <section className="py-12 sm:py-16 border-b border-stone-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#F97316]">
                Explore Departments
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#4A0A0F] tracking-tight">
                Shop by Pet &amp; Care Needs
              </h2>
            </div>
            <a
              href="/products"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#F97316] hover:text-[#EA580C] transition-colors"
            >
              <span>View All Products</span>
              <ArrowRight size={16} strokeWidth={1.75} />
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
            {isLoadingCategories
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-stone-200 bg-[#FAF7F2] p-4 animate-pulse"
                  >
                    <div className="aspect-square rounded-xl bg-stone-200 mb-3" />
                    <div className="h-4 w-3/4 rounded bg-stone-200 mb-2" />
                    <div className="h-3 w-1/2 rounded bg-stone-100" />
                  </div>
                ))
              : categories.slice(0, 6).map((cat) => {
                  const style = CATEGORY_STYLE_MAP[cat.slug] || {
                    icon: Tag,
                    bg: "bg-amber-50",
                    text: "text-[#F97316]",
                    border: "border-amber-200",
                    label: cat.name,
                  };
                  const IconComp = style.icon;
                  return (
                    <a
                      key={cat.id}
                      href={`/products?category=${cat.slug}`}
                      className="group rounded-2xl border border-stone-200/80 bg-[#FFFDF9] p-3.5 shadow-2xs hover:border-[#F97316] hover:shadow-md transition-all duration-200 flex flex-col"
                    >
                      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-stone-100 mb-3">
                        <img
                          src={
                            cat.image_url ||
                            "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80"
                          }
                          alt={cat.name}
                          width={400}
                          height={400}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-108"
                        />
                        <div
                          className={`absolute top-2 right-2 h-7 w-7 rounded-full flex items-center justify-center ${style.bg} border ${style.border} ${style.text} shadow-xs`}
                        >
                          <IconComp size={14} strokeWidth={1.75} />
                        </div>
                      </div>
                      <h3 className="text-sm font-bold text-[#4A0A0F] group-hover:text-[#F97316] transition-colors">
                        {cat.name}
                      </h3>
                      <p className="mt-1 text-xs text-stone-500 line-clamp-2">
                        {cat.description || "Browse collection"}
                      </p>
                    </a>
                  );
                })}
          </div>
        </div>
      </section>

      {/* 6. Pet Pantry Low-Stock Reminder Banner */}
      {pantryAlerts.length > 0 && (
        <section className="py-5 bg-[#FFF7ED] border-b border-[#FED7AA]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-[#FED7AA] text-[#F97316]">
                <Package size={20} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#4A0A0F]">
                  {pantryAlerts[0].pet_name ? `${pantryAlerts[0].pet_name}'s ` : "Your "}
                  {pantryAlerts[0].product_name} is ~{pantryAlerts[0].percent_consumed}% used
                  {pantryAlerts[0].estimated_days_remaining > 0
                    ? ` (about ${pantryAlerts[0].estimated_days_remaining} days left)`
                    : " — time to restock!"}
                </p>
                <p className="text-xs text-stone-600">
                  Predicted from your order history. 1-tap reorder or subscribe for 5% off.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleQuickAdd({
                    id: pantryAlerts[0].product_id,
                    product_id: pantryAlerts[0].product_id,
                    variant_id: pantryAlerts[0].variant_id,
                    variant_name: pantryAlerts[0].variant_name,
                    name: pantryAlerts[0].product_name,
                    price: pantryAlerts[0].price,
                    image_url: pantryAlerts[0].image_url,
                  })
                }
                className="rounded-xl bg-[#4A0A0F] px-4 py-2 text-xs font-bold text-white hover:bg-[#360509] shadow-xs"
              >
                1-Tap Reorder
              </button>
              <a
                href="/account"
                className="rounded-xl border border-[#FED7AA] bg-white px-3.5 py-2 text-xs font-bold text-[#4A0A0F] hover:bg-[#FAF7F2]"
              >
                Open Pet Pantry
              </a>
            </div>
          </div>
        </section>
      )}

      {/* 7. Buy Again (Real Previous Order Items) & Recently Viewed */}
      {(buyAgainItems.length > 0 || recentlyViewed.length > 0) && (
        <section className="py-10 bg-[#FFFDF9] border-b border-stone-200/80">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
            {buyAgainItems.length > 0 && (
              <div>
                <div className="flex items-end justify-between mb-5">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                      Quick Reorder
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[#4A0A0F]">
                      {primaryPetName
                        ? `${primaryPetName}'s usual supplies may be running low — Buy again?`
                        : "Buy Again from Your Previous Orders"}
                    </h2>
                  </div>
                  <a href="/account?tab=orders" className="text-xs font-bold text-[#F97316] hover:underline">
                    View Past Orders →
                  </a>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {buyAgainItems.map((item) => (
                    <div
                      key={`${item.product_id}-${item.variant_id || "base"}`}
                      className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-2xs flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-14 rounded-xl object-contain bg-stone-50 p-1 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#4A0A0F] line-clamp-2">{item.name}</p>
                          <p className="text-xs font-extrabold text-[#F97316] mt-1">
                            ₹{parseFloat(item.price || 0).toFixed(0)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleQuickAdd(item, e)}
                        className="mt-3 w-full rounded-xl bg-[#4A0A0F] py-2 text-xs font-bold text-white hover:bg-[#360509] transition-colors"
                      >
                        {addedIds[item.id] ? (
                          <span className="flex items-center justify-center gap-1">
                            <Check size={13} strokeWidth={2.5} />
                            <span>Added</span>
                          </span>
                        ) : (
                          "+ Buy Again"
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentlyViewed.length > 0 && (
              <div>
                <h2 className="text-lg font-extrabold text-[#4A0A0F] mb-4">Recently Viewed</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {recentlyViewed.map((item) => (
                    <a
                      key={item.id}
                      href={`/products/${item.slug}`}
                      className="rounded-2xl border border-stone-200 bg-white p-3 flex items-center gap-3 hover:border-[#F97316] transition-colors"
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        className="h-12 w-12 rounded-lg object-contain bg-stone-50 p-1 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#4A0A0F] truncate">{item.name}</p>
                        <p className="text-xs font-bold text-stone-600 mt-0.5">
                          ₹{parseFloat(item.price || 0).toFixed(0)}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 8. Featured Products */}
      <section className="py-14 sm:py-20 bg-[#FAF7F2] border-b border-stone-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#F97316]">
                Customer Favorites
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#4A0A0F] tracking-tight">
                Featured Products
              </h2>
            </div>
            <a
              href="/products"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#F97316] hover:text-[#EA580C]"
            >
              <span>See Complete Catalog</span>
              <ArrowRight size={16} strokeWidth={1.75} />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoadingProducts
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse"
                  >
                    <div className="aspect-square rounded-xl bg-stone-200 mb-4" />
                    <div className="h-4 w-20 rounded bg-stone-200 mb-2" />
                    <div className="h-5 w-3/4 rounded bg-stone-200 mb-3" />
                    <div className="h-6 w-1/3 rounded bg-stone-200" />
                  </div>
                ))
              : featuredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    deliveryBadge="30-60m Delivery"
                  />
                ))}
          </div>
        </div>
      </section>

      {/* 9. Veterinary Advice Spotlight */}
      <section className="py-16 sm:py-20 border-b border-stone-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-[#4A0A0F] to-[#241819] text-white p-8 sm:p-12 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 text-amber-200 border border-white/20 px-3 py-1 text-xs font-bold mb-4">
                  <Stethoscope size={14} strokeWidth={1.75} />
                  <span>Licensed Veterinary Guidance</span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  Have Questions About Your Pet&apos;s Diet or Health?
                </h3>
                <p className="mt-3 text-sm sm:text-base text-stone-200 max-w-xl">
                  Our in-store veterinary team helps you select suitable prescription diets, supplements, and wellness essentials for your pet.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3.5 py-2">
                    <Clock size={16} strokeWidth={1.75} className="text-[#FACC15]" />
                    <span>Mon - Sun: 9:00 AM - 9:30 PM</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3.5 py-2">
                    <Phone size={16} strokeWidth={1.75} className="text-[#FACC15]" />
                    <span>Store Support: +91 98765 43210</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 text-center lg:text-right">
                <a
                  href="tel:+919876543210"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#F97316] px-6 py-4 text-sm font-bold text-white shadow-lg hover:bg-[#EA580C] transition-all"
                >
                  <Phone size={18} strokeWidth={1.75} />
                  <span>Call Store Vet</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Customer Testimonials */}
      <section className="py-14 sm:py-20 bg-[#FAF7F2] border-b border-stone-200/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-wider text-[#F97316]">
              Real Pet Parents in Hyderabad
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#4A0A0F] tracking-tight mt-1">
              What Our Customers Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-1 text-[#FACC15] mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} className="fill-current" />
                ))}
              </div>
              <p className="text-sm text-stone-700 leading-relaxed italic">
                &ldquo;Sri Usha has been a lifesaver for my Golden Retriever. Genuine food delivered to my home in Uppal within an hour!&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-stone-100 pt-3">
                <div className="h-9 w-9 rounded-full bg-[#FFF1F2] text-[#4A0A0F] flex items-center justify-center font-bold text-xs">
                  KV
                </div>
                <div>
                  <div className="text-xs font-bold text-[#4A0A0F]">Kavita Verma</div>
                  <div className="text-[11px] text-stone-500">Uppal, Hyderabad</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-1 text-[#FACC15] mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} className="fill-current" />
                ))}
              </div>
              <p className="text-sm text-stone-700 leading-relaxed italic">
                &ldquo;The staff is very knowledgeable about puppy food and digestive supplements. Extremely polite and helpful team.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-stone-100 pt-3">
                <div className="h-9 w-9 rounded-full bg-[#FFF7ED] text-[#F97316] flex items-center justify-center font-bold text-xs">
                  RS
                </div>
                <div>
                  <div className="text-xs font-bold text-[#4A0A0F]">Rahul Sharma</div>
                  <div className="text-[11px] text-stone-500">Habsiguda, Hyderabad</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-1 text-[#FACC15] mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} className="fill-current" />
                ))}
              </div>
              <p className="text-sm text-stone-700 leading-relaxed italic">
                &ldquo;Ordering online was completely seamless. Opted for Cash on Delivery and received fresh packs with long shelf life.&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-stone-100 pt-3">
                <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  SR
                </div>
                <div>
                  <div className="text-xs font-bold text-[#4A0A0F]">Sneha Reddy</div>
                  <div className="text-[11px] text-stone-500">LB Nagar, Hyderabad</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. Footer with Client Logo-Full and Brand Styling */}
      <footer className="border-t border-stone-200 bg-[#241819] text-stone-300 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img
                  src="/brand/logo-full.webp"
                  onError={(e) => {
                    e.currentTarget.src = "/brand/logo-full.png";
                  }}
                  alt="Sri Usha Vet & Pet Stores"
                  width={180}
                  height={54}
                  className="h-11 w-auto object-contain brightness-110"
                />
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                Your trusted neighborhood pet care store in Uppal, Hyderabad. Delivering genuine food, medicines, toys, and grooming essentials.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">Quick Navigation</h4>
              <ul className="space-y-2 text-xs text-stone-400">
                <li>
                  <a href="/products" className="hover:text-white transition-colors">
                    All Products
                  </a>
                </li>
                <li>
                  <a href="/products?category=dog" className="hover:text-white transition-colors">
                    Dog Care &amp; Nutrition
                  </a>
                </li>
                <li>
                  <a href="/products?category=cat" className="hover:text-white transition-colors">
                    Cat Food &amp; Litter
                  </a>
                </li>
                <li>
                  <a href="/products?category=bird" className="hover:text-white transition-colors">
                    Birds &amp; Aviary
                  </a>
                </li>
                <li>
                  <a href="/orders" className="hover:text-white transition-colors">
                    Track Orders
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">Store Location</h4>
              <p className="text-xs text-stone-400 leading-relaxed">
                Sri Usha Vet &amp; Pet Stores<br />
                Main Road, Uppal,<br />
                Hyderabad, Telangana - 500039
              </p>
              <div className="mt-3 text-xs text-stone-400">
                <div className="flex items-center gap-1.5 text-stone-300 font-semibold">
                  <Phone size={13} strokeWidth={1.75} className="text-[#F97316]" />
                  <span>+91 98765 43210</span>
                </div>
                <div className="mt-1">Hours: 9:00 AM - 9:30 PM (Daily)</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">Payment &amp; Trust</h4>
              <p className="text-xs text-stone-400 mb-3">
                Secure checkout with UPI, Cards, and Cash on Delivery at your doorstep.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#F97316] font-semibold">
                <Sparkles size={14} strokeWidth={1.75} />
                <span>Local Hyderabad Store</span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-stone-800 text-center text-xs text-stone-500">
            © {new Date().getFullYear()} Sri Usha Vet &amp; Pet Stores. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
