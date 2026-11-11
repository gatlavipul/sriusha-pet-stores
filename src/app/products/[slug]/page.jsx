import { useState, useEffect } from "react";
import Header from "@/components/Header";
import useCart from "@/utils/useCart";
import {
  ShoppingCart,
  Zap,
  ShieldCheck,
  Truck,
  RotateCcw,
  Check,
  Star,
  Package,
  Heart,
  ChevronRight,
  Info,
} from "lucide-react";

export default function ProductDetailPage({ params }) {
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("description");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products/${params.slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.product) {
          setProduct(data.product);

          // Try parsing weight variants
          if (data.product.weight) {
            try {
              // JSON array case
              const parsed = JSON.parse(data.product.weight);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSelectedVariant(parsed[0].title || parsed[0]);
              }
            } catch {
              // Comma separated case
              const parts = data.product.weight.split(",").map((s) => s.trim());
              if (parts.length > 0) {
                setSelectedVariant(parts[0]);
              }
            }
          }

          // Fetch related products in same category
          if (data.product.category_id) {
            fetch(`/api/products?limit=4&category_id=${data.product.category_id}`)
              .then((r) => r.json())
              .then((relData) => {
                setRelatedProducts(
                  (relData.products || []).filter((p) => p.id !== data.product.id)
                );
              })
              .catch(() => {});
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.slug]);

  // Extract variants helper
  const parsedVariants = () => {
    if (!product?.weight) return [];
    try {
      const parsed = JSON.parse(product.weight);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => (typeof v === "object" ? v.title : v));
      }
    } catch {
      return product.weight.split(",").map((v) => v.trim()).filter(Boolean);
    }
    return [];
  };

  const handleAddToCart = async () => {
    if (!product) return;
    setAddingToCart(true);
    await addToCart(
      {
        ...product,
        name: selectedVariant
          ? `${product.name} (${selectedVariant})`
          : product.name,
      },
      quantity
    );
    setAddingToCart(false);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2000);
  };

  const handleBuyNow = async () => {
    if (!product) return;
    await addToCart(
      {
        ...product,
        name: selectedVariant
          ? `${product.name} (${selectedVariant})`
          : product.name,
      },
      quantity
    );
    window.location.href = "/checkout";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mx-auto mb-4" />
          <p className="text-xs text-gray-500 font-medium">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Product Not Found</h2>
          <p className="text-xs text-gray-500 mt-1 mb-6">
            The product you are looking for may have been removed or is temporarily unavailable.
          </p>
          <a
            href="/products"
            className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-xs font-semibold text-white shadow-xs"
          >
            Back to All Products
          </a>
        </div>
      </div>
    );
  }

  const variants = parsedVariants();
  const hasDiscount =
    product.compare_price &&
    parseFloat(product.compare_price) > 0 &&
    parseFloat(product.price) > 0;
  const originalPrice = hasDiscount
    ? (parseFloat(product.price) + parseFloat(product.compare_price)).toFixed(0)
    : null;
  const discountPercent = hasDiscount
    ? Math.round(
        (parseFloat(product.compare_price) /
          (parseFloat(product.price) + parseFloat(product.compare_price))) *
          100
      )
    : null;

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#0F172A]">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-1.5 text-xs text-gray-500 font-medium">
          <a href="/" className="hover:text-[#2563EB]">Home</a>
          <ChevronRight size={13} />
          <a href="/products" className="hover:text-[#2563EB]">Products</a>
          {product.category_name && (
            <>
              <ChevronRight size={13} />
              <a
                href={`/products?category_id=${product.category_id}`}
                className="hover:text-[#2563EB]"
              >
                {product.category_name}
              </a>
            </>
          )}
          <ChevronRight size={13} />
          <span className="text-gray-900 font-semibold truncate max-w-xs">
            {product.name}
          </span>
        </div>

        {/* Main Product Showcase Grid */}
        <div className="grid gap-10 lg:grid-cols-12 items-start">
          {/* Product Image Gallery Column (5 cols) */}
          <div className="lg:col-span-5">
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-xs">
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-contain transition-transform duration-300 hover:scale-105"
              />
              {discountPercent && discountPercent > 0 && (
                <span className="absolute top-4 left-4 rounded-lg bg-[#DC2626] px-2.5 py-1 text-xs font-bold text-white shadow-xs">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            {/* Trust highlights under image */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-2xs">
                <ShieldCheck size={20} className="mx-auto text-emerald-600 mb-1" />
                <div className="text-[11px] font-bold text-gray-900">100% Genuine</div>
                <div className="text-[10px] text-gray-500">Authorized batch</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-2xs">
                <Truck size={20} className="mx-auto text-[#2563EB] mb-1" />
                <div className="text-[11px] font-bold text-gray-900">Fast Delivery</div>
                <div className="text-[10px] text-gray-500">Same-day Uppal</div>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-2xs">
                <RotateCcw size={20} className="mx-auto text-amber-600 mb-1" />
                <div className="text-[11px] font-bold text-gray-900">COD Available</div>
                <div className="text-[10px] text-gray-500">Pay at doorstep</div>
              </div>
            </div>
          </div>

          {/* Product Details Column (7 cols) */}
          <div className="lg:col-span-7">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {product.brand && (
                <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-gray-700">
                  {product.brand}
                </span>
              )}
              {product.category_name && (
                <span className="rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-[#2563EB]">
                  {product.category_name}
                </span>
              )}
              <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                In Stock &amp; Ready to Ship
              </span>
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-snug">
              {product.name}
            </h1>

            {/* Reviews / Rating */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={15} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-xs font-bold text-gray-700">4.8</span>
              <span className="text-xs text-gray-400">• 38 customer ratings</span>
            </div>

            {/* Pricing Section */}
            <div className="mt-5 rounded-2xl bg-gray-50/70 border border-gray-200/80 p-4">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#0F172A]">
                  ₹{product.price}
                </span>
                {originalPrice && (
                  <span className="text-base sm:text-lg text-gray-400 line-through">
                    ₹{originalPrice}
                  </span>
                )}
                {discountPercent && discountPercent > 0 && (
                  <span className="rounded-md bg-red-100 text-red-700 px-2 py-0.5 text-xs font-bold">
                    Save {discountPercent}%
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Inclusive of all taxes. Free shipping on orders over ₹499.
              </div>
            </div>

            {/* Variant / Weight Selector (if available) */}
            {variants.length > 0 && (
              <div className="mt-6">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Select Pack Size / Weight:
                </div>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v}
                      onClick={() => setSelectedVariant(v)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        selectedVariant === v
                          ? "border-2 border-[#2563EB] bg-blue-50/50 text-[#2563EB] shadow-2xs"
                          : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selector and CTA Buttons */}
            <div className="mt-8 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Quantity Control */}
                <div className="flex items-center rounded-xl border border-gray-300 bg-white shadow-2xs">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3.5 py-2.5 text-base font-bold text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-extrabold text-gray-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() =>
                      setQuantity(
                        Math.min(product.stock_quantity || 99, quantity + 1)
                      )
                    }
                    className="px-3.5 py-2.5 text-base font-bold text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    +
                  </button>
                </div>

                {/* Add to Cart */}
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className={`flex-1 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-xs transition-all ${
                    addedSuccess
                      ? "bg-emerald-600 text-white"
                      : "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                  }`}
                >
                  {addedSuccess ? (
                    <>
                      <Check size={17} />
                      <span>Added to Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={17} />
                      <span>{addingToCart ? "Adding..." : "Add to Cart"}</span>
                    </>
                  )}
                </button>

                {/* Instant Buy Now Button */}
                <button
                  onClick={handleBuyNow}
                  className="flex-1 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#EA580C] px-6 py-3 text-sm font-bold text-white shadow-xs hover:bg-[#C2410C] transition-all"
                >
                  <Zap size={17} />
                  <span>Buy Now</span>
                </button>
              </div>

              {addedSuccess && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between text-xs text-emerald-800">
                  <span>✓ Item added to cart successfully</span>
                  <a href="/cart" className="font-bold underline hover:text-emerald-950">
                    View Cart &amp; Checkout →
                  </a>
                </div>
              )}
            </div>

            {/* Product Details Tabs */}
            <div className="mt-10 border-t border-gray-200 pt-6">
              <div className="flex border-b border-gray-200 text-xs font-bold gap-6">
                <button
                  onClick={() => setActiveTab("description")}
                  className={`pb-3 transition-colors ${
                    activeTab === "description"
                      ? "border-b-2 border-[#2563EB] text-[#2563EB]"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Description &amp; Benefits
                </button>
                <button
                  onClick={() => setActiveTab("feeding")}
                  className={`pb-3 transition-colors ${
                    activeTab === "feeding"
                      ? "border-b-2 border-[#2563EB] text-[#2563EB]"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Feeding &amp; Usage
                </button>
                <button
                  onClick={() => setActiveTab("safety")}
                  className={`pb-3 transition-colors ${
                    activeTab === "safety"
                      ? "border-b-2 border-[#2563EB] text-[#2563EB]"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Veterinary Note
                </button>
              </div>

              <div className="py-4 text-xs sm:text-sm text-gray-600 leading-relaxed">
                {activeTab === "description" && (
                  <p>{product.description || "Premium formula enriched with vital vitamins and minerals to maintain the optimal vitality, coat health, and immune support of your beloved pets."}</p>
                )}
                {activeTab === "feeding" && (
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>Provide fresh drinking water at all times alongside meals.</li>
                    <li>Refer to the feeding chart on the pack according to your pet&apos;s age and body weight.</li>
                    <li>Gradually transition new food over 7 days by mixing with previous diet.</li>
                  </ul>
                )}
                {activeTab === "safety" && (
                  <div className="space-y-2">
                    <p>
                      Store in a cool, dry place away from direct sunlight. Reseal pouch tightly after opening.
                    </p>
                    <p className="font-medium text-gray-800">
                      For any special medical concerns or dietary sensitivities, consult our in-store vet at +91 98765 43210.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 border-t border-gray-200 pt-10">
            <h3 className="text-xl font-extrabold text-gray-900 mb-6">
              Similar Pet Essentials You May Like
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map((rel) => (
                <a
                  key={rel.id}
                  href={`/products/${rel.slug}`}
                  className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-2xs hover:border-[#2563EB] hover:shadow-md transition-all group"
                >
                  <div className="aspect-square w-full rounded-xl bg-gray-50 mb-2.5 overflow-hidden">
                    <img
                      src={rel.image_url}
                      alt={rel.name}
                      className="h-full w-full object-contain p-2 group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="text-xs font-semibold text-gray-900 group-hover:text-[#2563EB] line-clamp-2">
                    {rel.name}
                  </div>
                  <div className="text-sm font-bold text-gray-900 mt-2">
                    ₹{rel.price}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
