import { useState, useEffect } from "react";
import Header from "@/components/Header";
import useCart from "@/utils/useCart";
import { useWishlist } from "@/utils/useWishlist";
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
  Clock,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

export default function ProductDetailPage({ params }) {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedVariantObj, setSelectedVariantObj] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("description");

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(5.0);
  const [reviewCount, setReviewCount] = useState(0);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products/${params.slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.product) {
          const prod = data.product;
          setProduct(prod);

          // Track in Recently Viewed
          try {
            const raw = localStorage.getItem("usha_recently_viewed");
            let viewed = raw ? JSON.parse(raw) : [];
            viewed = viewed.filter((p) => p.id !== prod.id);
            viewed.unshift({
              id: prod.id,
              name: prod.name,
              slug: prod.slug,
              price: prod.price,
              image_url: prod.image_url,
              brand: prod.brand,
            });
            if (viewed.length > 6) viewed = viewed.slice(0, 6);
            localStorage.setItem("usha_recently_viewed", JSON.stringify(viewed));
            setRecentlyViewed(viewed.filter((p) => p.id !== prod.id));
          } catch (e) {
            console.error("Recently viewed error:", e);
          }

          // Variants
          if (Array.isArray(prod.variants) && prod.variants.length > 0) {
            const firstAvailable =
              prod.variants.find((v) => Number(v.stock_quantity) > 0) || prod.variants[0];
            setSelectedVariantObj(firstAvailable);
            setSelectedVariant(firstAvailable.label);
          } else if (prod.weight) {
            try {
              const parsed = JSON.parse(prod.weight);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSelectedVariant(parsed[0].title || parsed[0]);
              }
            } catch {
              const parts = prod.weight.split(",").map((s) => s.trim());
              if (parts.length > 0) setSelectedVariant(parts[0]);
            }
          }

          // Fetch related products
          if (prod.category_id) {
            fetch(`/api/products?limit=4&category_id=${prod.category_id}`)
              .then((r) => r.json())
              .then((relData) => {
                setRelatedProducts(
                  (relData.products || []).filter((p) => p.id !== prod.id)
                );
              })
              .catch(() => {});
          }

          // Fetch reviews
          fetchReviews(params.slug);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.slug]);

  const fetchReviews = async (slug) => {
    try {
      const res = await fetch(`/api/products/${slug}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setReviewRating(data.rating || 5.0);
        setReviewCount(data.count || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/products/${params.slug}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: newRating,
          title: newTitle.trim(),
          comment: newComment.trim(),
          customer_name: reviewerName.trim(),
        }),
      });

      if (res.ok) {
        const resData = await res.json();
        setReviewSuccess(
          resData.message ||
            "Thank you for your review! It will be published after moderation."
        );
        setNewComment("");
        setNewTitle("");
        setShowReviewForm(false);
        fetchReviews(params.slug);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingReview(false);
    }
  };

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

  const structuredVariants = Array.isArray(product?.variants) ? product.variants : [];
  const activePrice = selectedVariantObj
    ? parseFloat(selectedVariantObj.price)
    : parseFloat(product?.sale_price || product?.price || 0);
  const activeComparePrice = selectedVariantObj?.compare_price
    ? parseFloat(selectedVariantObj.compare_price)
    : product?.compare_price
    ? parseFloat(product.compare_price)
    : null;

  const stock = selectedVariantObj
    ? Number(selectedVariantObj.stock_quantity ?? 0)
    : product
    ? product.stock_quantity !== undefined
      ? product.stock_quantity
      : 15
    : 0;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock <= 5;

  const handleAddToCart = async () => {
    if (!product || isOutOfStock) return;
    setAddingToCart(true);
    await addToCart(
      {
        ...product,
        variant_id: selectedVariantObj?.id || null,
        variant_name: selectedVariantObj?.label || selectedVariant || null,
        price: activePrice,
        stock_quantity: stock,
        requires_prescription: Boolean(product.requires_prescription),
        name: selectedVariant
          ? `${product.name} (${selectedVariant})`
          : product.name,
      },
      quantity
    );
    setAddingToCart(false);
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2500);
  };

  const handleBuyNow = async () => {
    if (!product || isOutOfStock) return;
    await addToCart(
      {
        ...product,
        variant_id: selectedVariantObj?.id || null,
        variant_name: selectedVariantObj?.label || selectedVariant || null,
        price: activePrice,
        stock_quantity: stock,
        requires_prescription: Boolean(product.requires_prescription),
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
      <div className="min-h-screen bg-[#FFFDF9]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4A0A0F] border-t-transparent mx-auto mb-4" />
          <p className="text-xs text-stone-500 font-medium">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FFFDF9]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <Package size={48} className="mx-auto text-stone-300 mb-3" />
          <h2 className="text-lg font-bold text-stone-900">Product Not Found</h2>
          <p className="text-xs text-stone-500 mt-1 mb-6">
            The product you are looking for may have been removed or is temporarily unavailable.
          </p>
          <a
            href="/products"
            className="rounded-xl bg-[#4A0A0F] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#360509]"
          >
            Back to All Products
          </a>
        </div>
      </div>
    );
  }

  const variants = parsedVariants();
  const isWishlisted = isInWishlist(product.id);

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#241819]">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-1.5 text-xs text-stone-500 font-medium">
          <a href="/" className="hover:text-[#4A0A0F]">Home</a>
          <ChevronRight size={13} />
          <a href="/products" className="hover:text-[#4A0A0F]">Products</a>
          {product.category_name && (
            <>
              <ChevronRight size={13} />
              <a
                href={`/products?category_id=${product.category_id}`}
                className="hover:text-[#4A0A0F]"
              >
                {product.category_name}
              </a>
            </>
          )}
          <ChevronRight size={13} />
          <span className="text-stone-900 font-semibold truncate max-w-xs">
            {product.name}
          </span>
        </div>

        {/* Main Product Showcase Grid */}
        <div className="grid gap-10 lg:grid-cols-12 items-start">
          {/* Product Image Column (5 cols) */}
          <div className="lg:col-span-5">
            <div className="relative aspect-square overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-xs">
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-contain transition-transform duration-300 hover:scale-105"
              />
              <button
                onClick={() => toggleWishlist(product)}
                title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                className={`absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full shadow-xs transition-colors ${
                  isWishlisted
                    ? "bg-rose-50 text-rose-600 border border-rose-200"
                    : "bg-white/90 text-gray-400 hover:text-rose-500 border border-gray-200"
                }`}
              >
                <Heart size={18} className={isWishlisted ? "fill-rose-500" : ""} />
              </button>
            </div>

            {/* Trust highlights */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-2xs">
                <ShieldCheck size={20} className="mx-auto text-emerald-600 mb-1" />
                <div className="text-[11px] font-bold text-gray-900">100% Genuine</div>
                <div className="text-[10px] text-stone-500">Authorized batch</div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-2xs">
                <Truck size={20} className="mx-auto text-[#F97316] mb-1" />
                <div className="text-[11px] font-bold text-stone-900">Fast Delivery</div>
                <div className="text-[10px] text-stone-500">Same-day Uppal</div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-2xs">
                <RotateCcw size={20} className="mx-auto text-amber-600 mb-1" />
                <div className="text-[11px] font-bold text-stone-900">COD Available</div>
                <div className="text-[10px] text-stone-500">Pay at doorstep</div>
              </div>
            </div>
          </div>

          {/* Product Details Column (7 cols) */}
          <div className="lg:col-span-7">
            {/* Badges row with stock indicator */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {product.brand && (
                <span className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-stone-700">
                  {product.brand}
                </span>
              )}
              {product.category_name && (
                <span className="rounded-lg bg-[#FFF7ED] border border-[#FED7AA] px-2.5 py-1 text-xs font-semibold text-[#F97316]">
                  {product.category_name}
                </span>
              )}

              {/* Dynamic Stock Indicator Badges */}
              {isOutOfStock ? (
                <span className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-bold text-red-700 flex items-center gap-1">
                  <AlertCircle size={13} />
                  <span>Out of Stock</span>
                </span>
              ) : isLowStock ? (
                <span className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-800 flex items-center gap-1">
                  <Clock size={13} />
                  <span>Only {stock} left in stock - order soon!</span>
                </span>
              ) : (
                <span className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Check size={13} />
                  <span>In Stock (Uppal Store)</span>
                </span>
              )}
              {product.requires_prescription && (
                <span className="rounded-lg bg-[#FEFCE8] border border-[#FEF08A] px-2.5 py-1 text-xs font-bold text-[#B45309]">
                  Rx Prescription Required
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight leading-snug">
              {product.name}
            </h1>

            {/* Reviews / Rating - only shown when review data genuinely exists */}
            {reviewCount > 0 ? (
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex items-center gap-1 text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={15}
                      className={
                        i < Math.floor(reviewRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-stone-300"
                      }
                    />
                  ))}
                </div>
                <span className="text-xs font-bold text-stone-700">{reviewRating}</span>
                <button
                  onClick={() => setActiveTab("reviews")}
                  className="text-xs text-[#F97316] hover:underline"
                >
                  • {reviewCount} verified reviews
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                <button
                  onClick={() => setActiveTab("reviews")}
                  className="text-xs font-medium text-[#F97316] hover:underline"
                >
                  Be the first to review this product
                </button>
              </div>
            )}

            {/* Pricing Section */}
            <div className="mt-5 rounded-2xl bg-stone-50 border border-stone-200/80 p-4">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#0F172A]">
                  ₹{activePrice.toFixed(0)}
                </span>
                {activeComparePrice && activeComparePrice > activePrice && (
                  <span className="text-base sm:text-lg text-gray-400 line-through">
                    ₹{activeComparePrice.toFixed(0)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                Inclusive of all taxes. Free delivery in Hyderabad on orders over ₹500.
              </div>
            </div>

            {/* Variants */}
            {(structuredVariants.length > 0 || variants.length > 0) && (
              <div className="mt-6">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Select Pack Size / Weight:
                </div>
                <div className="flex flex-wrap gap-2">
                  {structuredVariants.length > 0
                    ? structuredVariants.map((v) => {
                        const isSelected = selectedVariantObj?.id === v.id;
                        const vOut = Number(v.stock_quantity) <= 0;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setSelectedVariantObj(v);
                              setSelectedVariant(v.label);
                              setQuantity(1);
                            }}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all text-left ${
                              isSelected
                                ? "border-2 border-[#4A0A0F] bg-[#FFF7ED] text-[#4A0A0F] shadow-2xs"
                                : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300"
                            } ${vOut ? "opacity-55" : ""}`}
                          >
                            <div>{v.label}</div>
                            <div className="text-[11px] font-semibold text-stone-500">
                              ₹{parseFloat(v.price).toFixed(0)} • {vOut ? "Out" : `${v.stock_quantity} left`}
                            </div>
                          </button>
                        );
                      })
                    : variants.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setSelectedVariant(v)}
                          className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                            selectedVariant === v
                              ? "border-2 border-[#4A0A0F] bg-[#FFF7ED] text-[#4A0A0F] shadow-2xs"
                              : "border border-stone-200 bg-white text-stone-700 hover:border-stone-300"
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
                {!isOutOfStock && (
                  <div className="flex items-center rounded-xl border border-stone-300 bg-white shadow-2xs">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="px-3.5 py-2.5 text-base font-bold text-stone-500 hover:text-stone-900 transition-colors"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-extrabold text-stone-900">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(Math.min(stock, quantity + 1))}
                      className="px-3.5 py-2.5 text-base font-bold text-stone-500 hover:text-stone-900 transition-colors"
                    >
                      +
                    </button>
                  </div>
                )}

                {/* Add to Cart */}
                <button
                  onClick={handleAddToCart}
                  disabled={addingToCart || isOutOfStock}
                  className={`flex-1 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shadow-xs transition-all ${
                    isOutOfStock
                      ? "bg-stone-200 text-stone-500 cursor-not-allowed"
                      : addedSuccess
                      ? "bg-emerald-600 text-white"
                      : "bg-[#4A0A0F] text-white hover:bg-[#360509]"
                  }`}
                >
                  {isOutOfStock ? (
                    <span>Out of Stock</span>
                  ) : addedSuccess ? (
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

                {/* Buy Now Button */}
                {!isOutOfStock && (
                  <button
                    onClick={handleBuyNow}
                    className="flex-1 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#F97316] px-6 py-3 text-sm font-bold text-white shadow-xs hover:bg-[#EA580C] transition-all"
                  >
                    <Zap size={17} />
                    <span>Buy Now</span>
                  </button>
                )}
              </div>

              {addedSuccess && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between text-xs text-emerald-800">
                  <span className="inline-flex items-center gap-1.5 font-bold">
                    <Check size={14} strokeWidth={2.5} className="text-emerald-600" />
                    <span>Item added to cart</span>
                  </span>
                  <a href="/cart" className="font-bold underline hover:text-emerald-950">
                    View Cart &amp; Checkout →
                  </a>
                </div>
              )}
            </div>

            {/* Product Details Tabs */}
            <div className="mt-10 border-t border-stone-200 pt-6">
              <div className="flex border-b border-stone-200 text-xs font-bold gap-6">
                <button
                  onClick={() => setActiveTab("description")}
                  className={`pb-3 transition-colors ${
                    activeTab === "description"
                      ? "border-b-2 border-[#F97316] text-[#4A0A0F]"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  Description &amp; Benefits
                </button>
                <button
                  onClick={() => setActiveTab("reviews")}
                  className={`pb-3 transition-colors ${
                    activeTab === "reviews"
                      ? "border-b-2 border-[#F97316] text-[#4A0A0F]"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  Customer Reviews ({reviewCount})
                </button>
                <button
                  onClick={() => setActiveTab("safety")}
                  className={`pb-3 transition-colors ${
                    activeTab === "safety"
                      ? "border-b-2 border-[#F97316] text-[#4A0A0F]"
                      : "text-stone-500 hover:text-stone-900"
                  }`}
                >
                  Veterinary Advisory
                </button>
              </div>

              <div className="py-4 text-xs sm:text-sm text-stone-600 leading-relaxed">
                {activeTab === "description" && (
                  <p>
                    {product.description ||
                      "Premium veterinary-approved nutrition crafted to meet the daily biological needs of healthy pets. Contains essential proteins, minerals, and antioxidants."}
                  </p>
                )}

                {activeTab === "reviews" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-stone-900">
                          Overall Rating: {reviewRating} out of 5
                        </div>
                        <div className="text-xs text-stone-500">Based on {reviewCount} reviews</div>
                      </div>
                      <button
                        onClick={() => setShowReviewForm(!showReviewForm)}
                        className="rounded-xl border border-[#FED7AA] bg-[#FFF7ED] px-3.5 py-1.5 text-xs font-bold text-[#F97316] hover:bg-[#FED7AA]/40"
                      >
                        {showReviewForm ? "Cancel" : "Write a Review"}
                      </button>
                    </div>

                    {reviewSuccess && (
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
                        {reviewSuccess}
                      </div>
                    )}

                    {showReviewForm && (
                      <form onSubmit={handleReviewSubmit} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 space-y-3">
                        <div className="font-bold text-xs text-stone-900">Share your feedback</div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-600 mb-1">Your Name</label>
                          <input
                            type="text"
                            value={reviewerName}
                            onChange={(e) => setReviewerName(e.target.value)}
                            placeholder="e.g. Ramesh K."
                            className="w-full rounded-lg border border-stone-300 p-2 text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-600 mb-1">Rating</label>
                          <select
                            value={newRating}
                            onChange={(e) => setNewRating(Number(e.target.value))}
                            className="rounded-lg border border-stone-300 p-2 text-xs bg-white"
                          >
                            <option value={5}>⭐⭐⭐⭐⭐ 5 Stars - Excellent</option>
                            <option value={4}>⭐⭐⭐⭐ 4 Stars - Very Good</option>
                            <option value={3}>⭐⭐⭐ 3 Stars - Average</option>
                            <option value={2}>⭐⭐ 2 Stars - Below Average</option>
                            <option value={1}>⭐ 1 Star - Poor</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-stone-600 mb-1">Review</label>
                          <textarea
                            required
                            rows={3}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Tell pet parents about your experience with this product..."
                            className="w-full rounded-lg border border-stone-300 p-2 text-xs bg-white"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submittingReview}
                          className="rounded-xl bg-[#4A0A0F] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#360509]"
                        >
                          {submittingReview ? "Submitting..." : "Post Review"}
                        </button>
                      </form>
                    )}

                    {reviews.length === 0 ? (
                      <div className="text-xs text-stone-400 py-4 text-center">
                        No reviews yet. Be the first to share your experience!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reviews.map((r) => (
                          <div key={r.id} className="rounded-2xl border border-stone-100 bg-white p-3.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-stone-900">{r.customer_name}</span>
                              <div className="flex items-center text-amber-400 text-xs">
                                {[...Array(r.rating || 5)].map((_, idx) => (
                                  <Star key={idx} size={12} className="fill-amber-400" />
                                ))}
                              </div>
                            </div>
                            {r.title && <div className="text-xs font-semibold text-stone-800 mt-1">{r.title}</div>}
                            <p className="text-xs text-stone-600 mt-1">{r.comment}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "safety" && (
                  <div className="space-y-2">
                    <p>
                      Store in a dry, ventilated area. For any special prescription concerns, our Hyderabad clinic team is available at +91 98765 43210.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 border-t border-stone-200 pt-10">
            <h3 className="text-xl font-extrabold text-stone-900 mb-6">
              Similar Pet Essentials You May Like
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {relatedProducts.map((rel) => (
                <a
                  key={rel.id}
                  href={`/products/${rel.slug}`}
                  className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-2xs hover:border-[#F97316] hover:shadow-md transition-all group"
                >
                  <div className="aspect-square w-full rounded-xl bg-stone-50 mb-2.5 overflow-hidden">
                    <img
                      src={rel.image_url}
                      alt={rel.name}
                      className="h-full w-full object-contain p-2 group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="text-xs font-semibold text-stone-900 group-hover:text-[#4A0A0F] line-clamp-2">
                    {rel.name}
                  </div>
                  <div className="text-sm font-bold text-stone-900 mt-2">
                    ₹{parseFloat(rel.price).toFixed(0)}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Recently Viewed Products */}
        {recentlyViewed.length > 0 && (
          <div className="mt-16 border-t border-stone-200 pt-10">
            <h3 className="text-xl font-extrabold text-stone-900 mb-6">
              Recently Viewed Products
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {recentlyViewed.map((rec) => (
                <a
                  key={rec.id}
                  href={`/products/${rec.slug}`}
                  className="rounded-2xl border border-stone-200 bg-white p-3 shadow-2xs hover:border-[#F97316] transition-all group"
                >
                  <div className="aspect-square w-full rounded-xl bg-stone-50 mb-2 overflow-hidden">
                    <img
                      src={rec.image_url}
                      alt={rec.name}
                      className="h-full w-full object-contain p-1 group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="text-[11px] font-semibold text-gray-900 line-clamp-1">
                    {rec.name}
                  </div>
                  <div className="text-xs font-bold text-gray-900 mt-1">
                    ₹{parseFloat(rec.price).toFixed(0)}
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
