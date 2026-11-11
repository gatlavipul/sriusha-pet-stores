import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import useCart from "@/utils/useCart";
import { useWishlist } from "@/utils/useWishlist";
import {
  Search,
  SlidersHorizontal,
  Star,
  Check,
  ShoppingBag,
  X,
  Package,
  Heart,
  AlertCircle,
  Clock,
} from "lucide-react";

export default function ProductsPage() {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [addedIds, setAddedIds] = useState({});

  // Sync with URL parameters on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get("category");
      const search = params.get("search");
      if (cat) setSelectedCategory(cat);
      if (search) setSearchQuery(search);
    }
  }, []);

  // Fetch categories
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch(console.error);
  }, []);

  // Fetch products
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategory) params.append("category", selectedCategory);
    if (searchQuery) params.append("search", searchQuery);

    fetch(`/api/products?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedCategory, searchQuery]);

  // Extract unique brands for brand filter
  const availableBrands = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.brand && p.brand.trim()) set.add(p.brand.trim());
    });
    return Array.from(set);
  }, [products]);

  // Filter and sort products on client
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (selectedBrand) {
      result = result.filter(
        (p) => (p.brand || "").trim().toLowerCase() === selectedBrand.toLowerCase()
      );
    }

    if (sortBy === "price_asc") {
      result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sortBy === "price_desc") {
      result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    } else if (sortBy === "name_asc") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }

    return result;
  }, [products, selectedBrand, sortBy]);

  const handleQuickAdd = async (product, e) => {
    e.preventDefault();
    e.stopPropagation();
    await addToCart(product, 1);
    setAddedIds((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAddedIds((prev) => ({ ...prev, [product.id]: false }));
    }, 1600);
  };

  const handleClearFilters = () => {
    setSelectedCategory("");
    setSelectedBrand("");
    setSearchQuery("");
    setSortBy("featured");
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/products");
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#0F172A]">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb & Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500 font-medium mb-1">
              <a href="/" className="hover:text-[#2563EB]">Home</a>
              {" / "}
              <span className="text-gray-900 font-semibold">Products</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              {selectedCategory
                ? `${
                    categories.find((c) => c.slug === selectedCategory)?.name ||
                    selectedCategory
                  }`
                : "All Products"}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Showing {filteredProducts.length} premium products available for same-day delivery
            </p>
          </div>

          {/* Search bar within catalog */}
          <div className="relative w-full sm:w-72">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in products..."
              className="w-full rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-8 text-xs sm:text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Filters and Sorting Row */}
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs space-y-4">
          {/* Category Pills */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Filter by Category
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory("")}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  selectedCategory === ""
                    ? "bg-[#2563EB] text-white shadow-xs"
                    : "border border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100"
                }`}
              >
                All Categories
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.slug)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                    selectedCategory === category.slug
                      ? "bg-[#2563EB] text-white shadow-xs"
                      : "border border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Brands and Sort row */}
          <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
            {/* Brands */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mr-1">
                Brand:
              </span>
              <button
                onClick={() => setSelectedBrand("")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedBrand === ""
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All Brands
              </button>
              {availableBrands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => setSelectedBrand(brand)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    selectedBrand === brand
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>

            {/* Sorting */}
            <div className="flex items-center gap-2 ml-auto">
              <SlidersHorizontal size={14} className="text-gray-400" />
              <span className="text-xs text-gray-500 font-medium">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white py-1 px-2.5 text-xs font-semibold text-gray-700 outline-none focus:border-[#2563EB]"
              >
                <option value="featured">Featured / Default</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name_asc">Name: A to Z</option>
              </select>

              {(selectedCategory || selectedBrand || searchQuery) && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-red-600 hover:underline font-semibold ml-2"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-200 bg-white p-4 animate-pulse"
              >
                <div className="aspect-square rounded-xl bg-gray-200 mb-4" />
                <div className="h-4 w-20 rounded bg-gray-200 mb-2" />
                <div className="h-5 w-3/4 rounded bg-gray-200 mb-3" />
                <div className="h-6 w-1/3 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <Package size={48} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-900 mb-1">
              No products found
            </h3>
            <p className="text-xs text-gray-500 mb-5 max-w-sm mx-auto">
              We couldn&apos;t find any products matching your current filters. Try adjusting your search query or category filter.
            </p>
            <button
              onClick={handleClearFilters}
              className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#1D4ED8]"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const isAdded = addedIds[product.id];
              const hasDiscount =
                product.compare_price &&
                parseFloat(product.compare_price) > 0 &&
                parseFloat(product.price) > 0;
              const discountPercent = hasDiscount
                ? Math.round(
                    (parseFloat(product.compare_price) /
                      (parseFloat(product.price) +
                        parseFloat(product.compare_price))) *
                      100
                  )
                : null;

              const isWishlisted = isInWishlist(product.id);
              const stock = product.stock_quantity !== undefined ? product.stock_quantity : 15;
              const isOutOfStock = stock <= 0;
              const isLowStock = stock > 0 && stock <= 5;

              return (
                <div
                  key={product.id}
                  className="group flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-4 shadow-xs hover:border-[#2563EB] hover:shadow-lg transition-all duration-200 relative"
                >
                  <div>
                    {/* Image */}
                    <div className="relative block aspect-square overflow-hidden rounded-xl bg-gray-50 mb-3.5">
                      <a href={`/products/${product.slug}`} className="block h-full w-full">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                        />
                      </a>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleWishlist(product);
                        }}
                        title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                        className={`absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full shadow-xs transition-colors ${
                          isWishlisted
                            ? "bg-rose-50 text-rose-600 border border-rose-200"
                            : "bg-white/90 text-gray-400 hover:text-rose-500 border border-gray-200"
                        }`}
                      >
                        <Heart size={14} className={isWishlisted ? "fill-rose-500" : ""} />
                      </button>

                      {discountPercent && discountPercent > 0 && (
                        <span className="absolute top-2 left-2 rounded-md bg-[#DC2626] px-2 py-0.5 text-[11px] font-bold text-white shadow-xs">
                          {discountPercent}% OFF
                        </span>
                      )}

                      {/* Stock indicator badge */}
                      {isOutOfStock ? (
                        <span className="absolute bottom-2 right-2 rounded-md bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-bold flex items-center gap-0.5">
                          <AlertCircle size={10} />
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="absolute bottom-2 right-2 rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-bold flex items-center gap-0.5">
                          <Clock size={10} />
                          Only {stock} left
                        </span>
                      ) : (
                        <span className="absolute bottom-2 right-2 rounded-md bg-white/95 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          In Stock
                        </span>
                      )}
                    </div>

                    {/* Brand / Category */}
                    <div className="flex items-center gap-2 mb-1.5">
                      {product.brand && (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          {product.brand}
                        </span>
                      )}
                      {product.category_name && (
                        <span className="text-[10px] rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 font-medium">
                          {product.category_name}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <a
                      href={`/products/${product.slug}`}
                      className="text-sm font-semibold text-gray-900 group-hover:text-[#2563EB] transition-colors line-clamp-2 leading-snug"
                    >
                      {product.name}
                    </a>

                    {/* Rating */}
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-500">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      <span className="font-bold text-gray-700">4.8</span>
                      <span className="text-gray-400">(28 reviews)</span>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-lg font-bold text-gray-900 leading-none">
                        ₹{product.price}
                      </div>
                      {product.compare_price && (
                        <div className="text-xs text-gray-400 line-through mt-0.5">
                          ₹
                          {(
                            parseFloat(product.price) +
                            parseFloat(product.compare_price)
                          ).toFixed(0)}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => !isOutOfStock && handleQuickAdd(product, e)}
                      disabled={isOutOfStock}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs transition-all ${
                        isOutOfStock
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                          : isAdded
                          ? "bg-emerald-600 text-white"
                          : "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                      }`}
                    >
                      {isOutOfStock ? (
                        <span>Out of Stock</span>
                      ) : isAdded ? (
                        <>
                          <Check size={14} />
                          <span>Added</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag size={14} />
                          <span>Add</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
