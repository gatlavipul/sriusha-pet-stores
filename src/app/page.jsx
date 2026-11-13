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
} from "lucide-react";

export default function HomePage() {
  const { addToCart } = useCart();
  const { data: user } = useUser();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [addedIds, setAddedIds] = useState({});
  const [buyAgainItems, setBuyAgainItems] = useState([]);
  const [primaryPetName, setPrimaryPetName] = useState("");
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [pantryAlerts, setPantryAlerts] = useState([]);

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
    <div className="min-h-screen bg-[#FDFDFD] text-[#0F172A]">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#EFF6FF] via-[#F8FAFC] to-white border-b border-gray-100 py-16 sm:py-24">
        {/* Background glow decoration */}
        <div className="absolute top-0 right-1/4 -z-10 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -z-10 h-72 w-72 rounded-full bg-amber-100/50 blur-3xl pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Copy */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 backdrop-blur-xs px-3.5 py-1.5 text-xs font-semibold text-[#1E40AF] shadow-2xs">
                <span className="flex h-2 w-2 rounded-full bg-[#EA580C] animate-pulse" />
                <span>Hyderabad&apos;s Trusted Vet &amp; Pet Store</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0F172A] leading-tight sm:leading-none">
                Pure Nutrition &amp; Loving Care for Your Pets
              </h1>

              <p className="mt-5 max-w-2xl text-base sm:text-lg text-gray-600 leading-relaxed mx-auto lg:mx-0">
                Premium dog &amp; cat food, certified veterinary pharmaceuticals, grooming essentials, and prescription nutrition. Fast, same-day delivery across Hyderabad.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                <a
                  href="/products"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#2563EB] px-7 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-[#1D4ED8] hover:shadow-lg transition-all focus-visible:outline-2 focus-visible:outline-[#2563EB]"
                >
                  <ShoppingBag size={18} />
                  <span>Shop Best Sellers</span>
                  <ArrowRight size={16} />
                </a>
                <a
                  href="/products?category=dog"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-sm font-semibold text-gray-800 shadow-2xs hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Explore Dog Food
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="mt-10 pt-6 border-t border-gray-200/60 grid grid-cols-3 gap-4 text-center lg:text-left">
                <div>
                  <div className="text-2xl font-bold text-[#0F172A]">10,000+</div>
                  <div className="text-xs text-gray-500 font-medium">Happy Pets Served</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#2563EB]">100%</div>
                  <div className="text-xs text-gray-500 font-medium">Genuine Vet Care</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#EA580C]">Same Day</div>
                  <div className="text-xs text-gray-500 font-medium">Local Dispatch</div>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Visual Card */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-md">
                <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-3 shadow-xl shadow-blue-500/5">
                  <img
                    src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80"
                    alt="Happy Healthy Dog"
                    className="h-80 w-full object-cover rounded-2xl"
                  />
                  <div className="p-4 bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-[#EA580C] uppercase tracking-wider">
                          Veterinary Certified
                        </div>
                        <div className="text-base font-bold text-gray-900">
                          Complete Wellness Guarantee
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 text-xs font-bold text-amber-700">
                        <Star size={13} className="fill-amber-400 text-amber-400" />
                        <span>4.9 / 5</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating pill badge */}
                <div className="absolute -bottom-4 -left-4 rounded-2xl bg-white border border-gray-200 p-3 shadow-lg flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Truck size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">Free Express Delivery</div>
                    <div className="text-[11px] text-gray-500">Orders above ₹499 in Uppal</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition Highlights */}
      <section className="border-b border-gray-200 bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">100% Authentic</h4>
                <p className="text-xs text-gray-500">Authorized brand distributor</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-[#EA580C]">
                <Truck size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Same Day Delivery</h4>
                <p className="text-xs text-gray-500">Fast shipping in Hyderabad</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Stethoscope size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Veterinary Advice</h4>
                <p className="text-xs text-gray-500">Guidance for health &amp; diet</p>
              </div>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <HeartHandshake size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Cash on Delivery</h4>
                <p className="text-xs text-gray-500">Pay safely at your doorstep</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section className="py-14 sm:py-20 border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
                Explore Department
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Shop by Pet &amp; Category
              </h2>
            </div>
            <a
              href="/products"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
            >
              <span>View All Products</span>
              <ArrowRight size={16} />
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
            {isLoadingCategories
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse"
                  >
                    <div className="aspect-square rounded-xl bg-gray-200 mb-3" />
                    <div className="h-4 w-3/4 rounded bg-gray-200 mb-2" />
                    <div className="h-3 w-1/2 rounded bg-gray-100" />
                  </div>
                ))
              : categories.slice(0, 6).map((cat) => (
                  <a
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    className="group rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-xs hover:border-[#2563EB] hover:shadow-md transition-all duration-200 flex flex-col"
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-100 mb-3">
                      <img
                        src={
                          cat.image_url ||
                          "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80"
                        }
                        alt={cat.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-108"
                      />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#2563EB] transition-colors">
                      {cat.name}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                      {cat.description || "Browse collection"}
                    </p>
                  </a>
                ))}
          </div>
        </div>
      </section>

      {/* Pet Pantry Low-Stock Reminder Banner */}
      {pantryAlerts.length > 0 && (
        <section className="py-5 bg-amber-50 border-b border-amber-200">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🥫</span>
              <div>
                <p className="text-sm font-extrabold text-amber-950">
                  {pantryAlerts[0].pet_name ? `${pantryAlerts[0].pet_name}'s ` : "Your "}
                  {pantryAlerts[0].product_name} is ~{pantryAlerts[0].percent_consumed}% used
                  {pantryAlerts[0].estimated_days_remaining > 0
                    ? ` (about ${pantryAlerts[0].estimated_days_remaining} days left)`
                    : " — time to restock!"}
                </p>
                <p className="text-xs text-amber-800">
                  Predicted from your real order history. 1-tap reorder or subscribe for 5% off.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleAddToCart({
                    id: pantryAlerts[0].product_id,
                    product_id: pantryAlerts[0].product_id,
                    variant_id: pantryAlerts[0].variant_id,
                    variant_name: pantryAlerts[0].variant_name,
                    name: pantryAlerts[0].product_name,
                    price: pantryAlerts[0].price,
                    image_url: pantryAlerts[0].image_url,
                  })
                }
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D4ED8] shadow-xs"
              >
                1-Tap Reorder
              </button>
              <a
                href="/account"
                className="rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
              >
                Open Pet Pantry
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Buy Again (Real Previous Order Items) & Recently Viewed */}
      {(buyAgainItems.length > 0 || recentlyViewed.length > 0) && (
        <section className="py-10 bg-white border-b border-gray-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
            {buyAgainItems.length > 0 && (
              <div>
                <div className="flex items-end justify-between mb-5">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#27AE60]">
                      Quick Hyperlocal Reorder
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900">
                      {primaryPetName
                        ? `${primaryPetName}'s usual supplies may be running low — Buy again?`
                        : "Buy Again from Your Previous Orders"}
                    </h2>
                  </div>
                  <a href="/account?tab=orders" className="text-xs font-bold text-[#2563EB] hover:underline">
                    View Past Orders →
                  </a>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {buyAgainItems.map((item) => (
                    <div
                      key={`${item.product_id}-${item.variant_id || "base"}`}
                      className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-2xs flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          className="h-14 w-14 rounded-xl object-contain bg-gray-50 p-1 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 line-clamp-2">{item.name}</p>
                          <p className="text-xs font-extrabold text-[#2563EB] mt-1">
                            ₹{parseFloat(item.price || 0).toFixed(0)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleQuickAdd(item, e)}
                        className="mt-3 w-full rounded-xl bg-[#27AE60] py-2 text-xs font-bold text-white hover:bg-[#219150]"
                      >
                        {addedIds[item.id] ? "✓ Added" : "+ Buy Again"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentlyViewed.length > 0 && (
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 mb-4">Recently Viewed</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {recentlyViewed.map((item) => (
                    <a
                      key={item.id}
                      href={`/products/${item.slug}`}
                      className="rounded-2xl border border-gray-200 bg-white p-3 flex items-center gap-3 hover:border-[#2563EB] transition-colors"
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        decoding="async"
                        className="h-12 w-12 rounded-lg object-contain bg-gray-50 p-1 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs font-bold text-gray-600 mt-0.5">
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

      {/* Featured Products */}
      <section className="py-14 sm:py-20 bg-[#F9FAFB] border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#EA580C]">
                Customer Favorites
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                Featured Products
              </h2>
            </div>
            <a
              href="/products"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8]"
            >
              <span>See Complete Catalog</span>
              <ArrowRight size={16} />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {isLoadingProducts
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse"
                  >
                    <div className="aspect-square rounded-xl bg-gray-200 mb-4" />
                    <div className="h-4 w-20 rounded bg-gray-200 mb-2" />
                    <div className="h-5 w-3/4 rounded bg-gray-200 mb-3" />
                    <div className="h-6 w-1/3 rounded bg-gray-200" />
                  </div>
                ))
              : featuredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    deliveryBadge="⚡ 30-60m Delivery"
                  />
                ))}
          </div>
        </div>
      </section>

      {/* Veterinary Clinic & Advice Spotlight */}
      <section className="py-16 sm:py-20 border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white p-8 sm:p-12 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 text-xs font-semibold mb-4">
                  <Stethoscope size={14} />
                  <span>Licensed Veterinary Consultation</span>
                </div>
                <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                  Have Questions About Your Pet&apos;s Diet or Health?
                </h3>
                <p className="mt-3 text-sm sm:text-base text-gray-300 max-w-xl">
                  Our in-store veterinary professionals are ready to help you choose the ideal prescription food, supplement plan, and vaccination schedule for your pet.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3.5 py-2">
                    <Clock size={16} className="text-[#F59E0B]" />
                    <span>Mon - Sun: 9:00 AM - 9:30 PM</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3.5 py-2">
                    <Phone size={16} className="text-[#F59E0B]" />
                    <span>Call Store: +91 98765 43210</span>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 text-center lg:text-right">
                <a
                  href="tel:+919876543210"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#EA580C] px-6 py-4 text-sm font-bold text-white shadow-lg hover:bg-[#C2410C] transition-all"
                >
                  <Phone size={18} />
                  <span>Consult a Vet Today</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Testimonials */}
      <section className="py-14 sm:py-20 bg-gray-50 border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
              Real Pet Parents Love Us
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
              What Our Hyderabad Customers Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-1 text-amber-400 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} className="fill-current" />
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed italic">
                &ldquo;Sri Usha has been a lifesaver for my Golden Retriever. Genuine Pedigree and Royal Canin food delivered to my home in Uppal within a couple of hours!&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3">
                <div className="h-9 w-9 rounded-full bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-xs">
                  KV
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Kavita Verma</div>
                  <div className="text-[11px] text-gray-500">Uppal, Hyderabad</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-1 text-amber-400 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} className="fill-current" />
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed italic">
                &ldquo;The veterinary guidance here is top-notch. They helped me pick the right puppy loaf and digestive supplements. Extremely polite and knowledgeable staff!&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3">
                <div className="h-9 w-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                  RS
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Rahul Sharma</div>
                  <div className="text-[11px] text-gray-500">Habsiguda, Hyderabad</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-1 text-amber-400 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} className="fill-current" />
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed italic">
                &ldquo;Ordering online was completely seamless. I opted for Cash on Delivery and received fresh packs with long expiry dates. Highly recommend Sri Usha!&rdquo;
              </p>
              <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-3">
                <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  SR
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">Sneha Reddy</div>
                  <div className="text-[11px] text-gray-500">LB Nagar, Hyderabad</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-[#0F172A] text-gray-300 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <img
                  src="https://ucarecdn.com/1ba9ff02-d14c-447c-b424-734247393bdd/-/format/auto/"
                  alt="Sri Usha"
                  className="h-10 w-auto brightness-200"
                />
                <div>
                  <div className="text-base font-bold text-white">Sri Usha</div>
                  <div className="text-[10px] uppercase font-semibold text-[#EA580C]">
                    Vet &amp; Pet Stores
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">
                Your premier veterinary and pet care destination in Hyderabad. Offering genuine pet food, treatments, toys, and grooming gear.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">Quick Navigation</h4>
              <ul className="space-y-2 text-xs text-gray-400">
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
              <p className="text-xs text-gray-400 leading-relaxed">
                Sri Usha Vet &amp; Pet Stores<br />
                Main Road, Uppal,<br />
                Hyderabad, Telangana - 500039
              </p>
              <div className="mt-3 text-xs text-gray-400">
                <div>Phone: +91 98765 43210</div>
                <div>Hours: 9:00 AM - 9:30 PM (Daily)</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">Payment &amp; Trust</h4>
              <p className="text-xs text-gray-400 mb-3">
                Secure checkout with Razorpay, UPI, Credit/Debit cards &amp; Cash on Delivery.
              </p>
              <div className="flex items-center gap-2 text-xs text-[#EA580C] font-semibold">
                <Sparkles size={14} />
                <span>Verified Authentic Products</span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-gray-800 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} Sri Usha Vet &amp; Pet Stores. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
