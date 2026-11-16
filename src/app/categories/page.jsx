import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { ArrowRight, Layers, Sparkles, AlertCircle, RotateCcw } from "lucide-react";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCategories = () => {
    setLoading(true);
    setError(false);
    fetch("/api/categories")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load categories");
        return res.json();
      })
      .then((data) => {
        setCategories(data.categories || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Categories fetch error:", err);
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819] flex flex-col pb-20 md:pb-12">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {/* Breadcrumb / Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 mb-1">
            <a href="/" className="hover:text-[#4A0A0F] transition-colors">
              Home
            </a>
            <span>/</span>
            <span className="text-[#4A0A0F]">Categories</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#4A0A0F] tracking-tight">
                Explore Pet Categories
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-stone-600">
                Veterinary essentials, premium foods, grooming and accessories for your pets
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-xs font-bold text-[#F97316]">
              <Sparkles size={14} />
              <span>Hyderabad Express Delivery</span>
            </div>
          </div>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl bg-stone-100 border border-stone-200/80 p-4 h-56 flex flex-col justify-end"
              >
                <div className="h-4 bg-stone-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-stone-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12 px-4 rounded-3xl bg-red-50 border border-red-200 max-w-md mx-auto my-8">
            <AlertCircle size={36} className="mx-auto text-red-600 mb-3" />
            <h2 className="text-base font-bold text-red-900 mb-1">
              Could not load categories
            </h2>
            <p className="text-xs text-red-700 mb-4">
              Please check your connection and tap below to retry.
            </p>
            <button
              type="button"
              onClick={fetchCategories}
              className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-4 py-2 text-xs font-bold text-white hover:bg-[#360509]"
            >
              <RotateCcw size={14} />
              <span>Tap to retry</span>
            </button>
          </div>
        )}

        {/* Categories Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-5">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/products?category=${encodeURIComponent(cat.slug || cat.name)}`}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl bg-white border border-[#EADBCC] p-4 sm:p-5 shadow-xs transition-all hover:shadow-md hover:border-[#F97316] active:scale-[0.98]"
              >
                <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl bg-stone-100 mb-3">
                  {cat.image_url ? (
                    <img
                      src={cat.image_url}
                      alt={cat.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-stone-300">
                      <Layers size={36} />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm sm:text-base font-bold text-[#4A0A0F] group-hover:text-[#F97316] transition-colors">
                      {cat.name}
                    </h2>
                    <ArrowRight
                      size={15}
                      className="text-stone-400 group-hover:text-[#F97316] group-hover:translate-x-1 transition-all"
                    />
                  </div>
                  {cat.description && (
                    <p className="mt-1 text-[11px] sm:text-xs text-stone-500 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
