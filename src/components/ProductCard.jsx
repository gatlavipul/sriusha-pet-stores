import { useState } from "react";
import { Plus, Minus, AlertCircle, Clock, Heart, Star } from "lucide-react";
import useCart from "@/utils/useCart";
import { useWishlist } from "@/utils/useWishlist";

function formatProductDisplayName(product) {
  if (!product) return "";
  const name = (product.name || "").trim();

  // If name already contains pack info (e.g., "Pack of 60", "60 tabs", "Pack of 2")
  if (/(?:pack of|\bpack\b|\bcount\b|\bpacks\b|\bx\s*\d+)/i.test(name)) {
    return name;
  }

  // Check if product has active/reviewed variants with pack size
  if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
    const multiPack = product.variants.find((v) =>
      /(?:pack|count|pcs|tablets|capsules|strip)/i.test(v.label || "")
    );
    if (multiPack?.label) {
      return `${name} (${multiPack.label})`;
    }
  }

  // Check if product has pack_size or package_size property
  if (product.pack_size && !name.toLowerCase().includes(String(product.pack_size).toLowerCase())) {
    return `${name} (${product.pack_size})`;
  }

  if (product.package_size && !name.toLowerCase().includes(String(product.package_size).toLowerCase())) {
    return `${name} (${product.package_size})`;
  }

  return name;
}

export default function ProductCard({ product }) {
  const { items, addToCart, updateQuantity, removeFromCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const [actionError, setActionError] = useState(null);

  const productId = product.product_id || product.id;
  const isWishlisted = isInWishlist(productId);

  // Find if and how many are in the cart
  const cartItem = items.find((i) => (i.product_id || i.id) === productId);
  const cartQty = cartItem ? Number(cartItem.quantity || 0) : 0;

  const stock = typeof product.stock_quantity === "number" ? product.stock_quantity : 99;
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= 5;
  const isBestSeller = Boolean(product.is_bestseller || (product.id && product.id <= 4));

  // Rule 2: Show discount & MRP ONLY when compare_price > price
  const unitPrice = parseFloat(product.price || 0);
  const comparePrice = product.compare_price ? parseFloat(product.compare_price) : 0;
  const hasValidDiscount = comparePrice > unitPrice && unitPrice > 0;
  const discountPercent = hasValidDiscount
    ? Math.round(((comparePrice - unitPrice) / comparePrice) * 100)
    : null;

  const displayName = formatProductDisplayName(product);

  const handleAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    setActionError(null);
    const res = await addToCart(product, 1);
    if (res && !res.success) {
      setActionError(res.error || "Cannot add more");
      setTimeout(() => setActionError(null), 3000);
    }
  };

  const handleIncrement = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartQty >= stock) {
      setActionError(`Only ${stock} left`);
      setTimeout(() => setActionError(null), 2500);
      return;
    }
    setActionError(null);
    let res;
    if (cartItem) {
      res = await updateQuantity(cartItem.id, cartQty + 1);
    } else {
      res = await addToCart(product, 1);
    }
    if (res && !res.success) {
      setActionError(res.error || "Limit reached");
      setTimeout(() => setActionError(null), 3000);
    }
  };

  const handleDecrement = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActionError(null);
    if (cartQty <= 1) {
      removeFromCart(cartItem ? cartItem.id : productId);
    } else if (cartItem) {
      updateQuantity(cartItem.id, cartQty - 1);
    }
  };

  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-white p-2.5 sm:p-4 shadow-2xs hover:border-[#F97316]/60 hover:shadow-lg transition-all duration-200 relative select-none">
      <div>
        {/* Top Badges & Image (Fixed Aspect-Ratio Square) */}
        <div className="relative block aspect-square w-full overflow-hidden rounded-xl bg-stone-50 mb-2 sm:mb-3">
          <a
            href={`/products/${product.slug || product.id}`}
            className="block h-full w-full"
            aria-label={displayName}
          >
            <img
              src={product.image_url}
              alt={displayName}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            />
          </a>

          {/* Bestseller Badge */}
          {isBestSeller && (
            <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 pointer-events-none">
              <span className="inline-flex items-center gap-0.5 sm:gap-1 rounded-md bg-[#F97316] text-white font-extrabold text-[8px] sm:text-[9px] px-1.5 py-0.5 uppercase tracking-wider shadow-xs">
                <Star size={8} className="fill-white text-white shrink-0" />
                <span>Bestseller</span>
              </span>
            </div>
          )}

          {/* Wishlist Button (Min 44px tap target via padding) */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product);
            }}
            title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            className={`absolute top-1 right-1 sm:top-2 sm:right-2 z-10 flex h-9 w-9 sm:h-9 sm:w-9 items-center justify-center rounded-full shadow-xs transition-colors ${
              isWishlisted
                ? "bg-rose-50 text-rose-600 border border-rose-200"
                : "bg-white/90 text-stone-400 hover:text-rose-500 border border-stone-200/80 backdrop-blur-xs"
            }`}
          >
            <Heart
              size={15}
              className={isWishlisted ? "fill-rose-500 text-rose-500" : "text-stone-400"}
            />
          </button>

          {/* Discount Tag */}
          {discountPercent && discountPercent > 0 && (
            <span className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 rounded-md bg-[#DC2626] px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-white shadow-xs">
              {discountPercent}% OFF
            </span>
          )}

          {/* Stock Badges */}
          {isOutOfStock ? (
            <span className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 rounded-md bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5">
              <AlertCircle size={10} /> Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5">
              <Clock size={10} /> Only {stock} left
            </span>
          ) : null}
        </div>

        {/* Brand & Category */}
        <div className="flex items-center gap-1 sm:gap-1.5 mb-1 text-[9px] sm:text-[10px]">
          {product.brand && (
            <span className="font-extrabold uppercase tracking-wider text-stone-500 truncate max-w-[80px]">
              {product.brand}
            </span>
          )}
          {product.category_name && (
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-600 font-medium truncate max-w-[90px]">
              {product.category_name}
            </span>
          )}
        </div>

        {/* Product Title (Clamped to 2 lines) */}
        <a
          href={`/products/${product.slug || product.id}`}
          className="text-xs sm:text-sm font-bold text-[#241819] group-hover:text-[#4A0A0F] transition-colors line-clamp-2 leading-snug min-h-[2.4rem] block"
          title={displayName}
        >
          {displayName}
        </a>

        {/* Genuine Rating */}
        {product.review_count && product.review_count > 0 ? (
          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-[11px] text-amber-500">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            <span className="font-bold text-stone-700">
              {Number(product.rating || 5).toFixed(1)}
            </span>
            <span className="text-stone-400">({product.review_count})</span>
          </div>
        ) : null}
      </div>

      {/* Bottom: Pricing & Quick Add / Quantity Stepper */}
      <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between gap-1.5 sm:gap-2 relative">
        {/* Error notification */}
        {actionError && (
          <div className="absolute -top-7 right-0 rounded-lg bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 shadow-md z-20 whitespace-nowrap">
            {actionError}
          </div>
        )}

        <div>
          <div className="text-sm sm:text-base lg:text-lg font-black text-[#241819] leading-none">
            ₹{unitPrice.toFixed(0)}
          </div>
          {hasValidDiscount && (
            <div className="text-[10px] sm:text-[11px] text-stone-400 line-through mt-0.5 font-semibold">
              ₹{comparePrice.toFixed(0)}
            </div>
          )}
        </div>

        {/* Interactive Add Button / Quantity Stepper */}
        {isOutOfStock ? (
          <button
            disabled
            className="rounded-lg border border-stone-200 bg-stone-100 px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold text-stone-400 cursor-not-allowed min-h-[36px]"
          >
            Sold Out
          </button>
        ) : cartQty > 0 ? (
          <div className="inline-flex items-center rounded-xl border border-[#4A0A0F] bg-[#FFF7ED] shadow-xs overflow-hidden min-h-[36px]">
            <button
              type="button"
              onClick={handleDecrement}
              className="p-1 sm:p-1.5 text-[#4A0A0F] hover:bg-[#FED7AA] transition-colors min-w-[28px] min-h-[36px] flex items-center justify-center"
              title="Decrease quantity"
              aria-label="Decrease quantity"
            >
              <Minus size={12} strokeWidth={2.5} />
            </button>
            <span className="min-w-5 sm:min-w-6 text-center text-xs font-black text-[#4A0A0F]">
              {cartQty}
            </span>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={cartQty >= stock}
              className="p-1 sm:p-1.5 text-[#4A0A0F] hover:bg-[#FED7AA] transition-colors disabled:opacity-30 min-w-[28px] min-h-[36px] flex items-center justify-center"
              title="Increase quantity"
              aria-label="Increase quantity"
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#4A0A0F] px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold text-white shadow-xs hover:bg-[#360509] transition-all min-h-[36px]"
            aria-label={`Add ${displayName} to cart`}
          >
            <Plus size={12} strokeWidth={2.5} />
            <span>ADD</span>
          </button>
        )}
      </div>
    </div>
  );
}
