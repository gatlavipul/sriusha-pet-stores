import { ShoppingBag, Plus, Minus, Check, AlertCircle, Clock, Heart, Star } from "lucide-react";
import useCart from "@/utils/useCart";
import { useWishlist } from "@/utils/useWishlist";

export default function ProductCard({ product, deliveryBadge = "⚡ 30-60m Delivery" }) {
  const { items, addToCart, updateQuantity, removeFromCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const productId = product.product_id || product.id;
  const isWishlisted = isInWishlist(productId);

  // Find if and how many are in the cart
  const cartItem = items.find((i) => (i.product_id || i.id) === productId);
  const cartQty = cartItem ? Number(cartItem.quantity || 0) : 0;

  const stock = typeof product.stock_quantity === "number" ? product.stock_quantity : 99;
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= 5;
  const isBestSeller = Boolean(product.is_bestseller || (product.id && product.id <= 4));

  const hasDiscount =
    product.compare_price &&
    parseFloat(product.compare_price) > 0 &&
    parseFloat(product.price) > 0;
  const discountPercent = hasDiscount
    ? Math.round(
        (parseFloat(product.compare_price) /
          (parseFloat(product.price) + parseFloat(product.compare_price))) *
          100
      )
    : null;

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock) return;
    addToCart(product, 1);
  };

  const handleIncrement = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartQty >= stock) return;
    if (cartItem) {
      updateQuantity(cartItem.id, cartQty + 1);
    } else {
      addToCart(product, 1);
    }
  };

  const handleDecrement = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartQty <= 1) {
      removeFromCart(cartItem ? cartItem.id : productId);
    } else if (cartItem) {
      updateQuantity(cartItem.id, cartQty - 1);
    }
  };

  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-3.5 sm:p-4 shadow-xs hover:border-[#2563EB] hover:shadow-lg transition-all duration-200 relative">
      <div>
        {/* Top Badges & Image */}
        <div className="relative block aspect-square overflow-hidden rounded-xl bg-gray-50 mb-3">
          <a href={`/products/${product.slug || product.id}`} className="block h-full w-full">
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
            />
          </a>

          {/* Quick-Commerce Fast Delivery Pill */}
          {deliveryBadge && (
            <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
              <span className="rounded-md bg-[#0F172A]/90 backdrop-blur-xs px-2 py-0.5 text-[9px] font-black uppercase text-amber-300 tracking-wider shadow-xs">
                {deliveryBadge}
              </span>
              {isBestSeller && (
                <span className="rounded-md bg-amber-500 text-white font-extrabold text-[9px] px-1.5 py-0.5 uppercase tracking-wider shadow-xs">
                  ★ Bestseller
                </span>
              )}
            </div>
          )}

          {/* Wishlist Button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product);
            }}
            title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            className={`absolute top-2 right-2 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full shadow-xs transition-colors ${
              isWishlisted
                ? "bg-rose-50 text-rose-600 border border-rose-200"
                : "bg-white/90 text-gray-400 hover:text-rose-500 border border-gray-200"
            }`}
          >
            <Heart size={13} className={isWishlisted ? "fill-rose-500" : ""} />
          </button>

          {/* Discount / Low Stock tags */}
          {discountPercent && discountPercent > 0 && (
            <span className="absolute bottom-2 left-2 rounded-md bg-[#DC2626] px-1.5 py-0.5 text-[10px] font-black text-white shadow-xs">
              {discountPercent}% OFF
            </span>
          )}

          {isOutOfStock ? (
            <span className="absolute bottom-2 right-2 rounded-md bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-bold flex items-center gap-0.5">
              <AlertCircle size={10} /> Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="absolute bottom-2 right-2 rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-bold flex items-center gap-0.5">
              <Clock size={10} /> Only {stock} left
            </span>
          ) : (
            <span className="absolute bottom-2 right-2 rounded-md bg-white/90 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
              In Stock
            </span>
          )}
        </div>

        {/* Brand & Category */}
        <div className="flex items-center gap-1.5 mb-1 text-[10px]">
          {product.brand && (
            <span className="font-extrabold uppercase tracking-wider text-gray-500 truncate">
              {product.brand}
            </span>
          )}
          {product.category_name && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 font-medium truncate">
              {product.category_name}
            </span>
          )}
        </div>

        {/* Product Title */}
        <a
          href={`/products/${product.slug || product.id}`}
          className="text-xs sm:text-sm font-bold text-gray-900 group-hover:text-[#2563EB] transition-colors line-clamp-2 leading-snug"
        >
          {product.name}
        </a>

        {/* Rating */}
        <div className="mt-1 flex items-center gap-1 text-[11px] text-amber-500">
          <Star size={12} className="fill-amber-400 text-amber-400" />
          <span className="font-bold text-gray-700">4.8</span>
          <span className="text-gray-400">({product.review_count || 36})</span>
        </div>
      </div>

      {/* Bottom: Pricing & Quick Add / Quantity Stepper */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
        <div>
          <div className="text-base sm:text-lg font-black text-gray-900 leading-none">
            ₹{product.price}
          </div>
          {product.compare_price && (
            <div className="text-[11px] text-gray-400 line-through mt-0.5">
              ₹{(parseFloat(product.price) + parseFloat(product.compare_price)).toFixed(0)}
            </div>
          )}
        </div>

        {/* Interactive Add Button / Quantity Stepper */}
        {isOutOfStock ? (
          <button
            disabled
            className="rounded-xl border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-400 cursor-not-allowed"
          >
            Sold Out
          </button>
        ) : cartQty > 0 ? (
          <div className="inline-flex items-center rounded-xl border border-[#2563EB] bg-[#EFF6FF] shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={handleDecrement}
              className="p-1.5 sm:p-2 text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
              title="Decrease quantity"
            >
              <Minus size={13} strokeWidth={2.5} />
            </button>
            <span className="min-w-6 text-center text-xs font-black text-[#1E40AF]">
              {cartQty}
            </span>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={cartQty >= stock}
              className="p-1.5 sm:p-2 text-[#2563EB] hover:bg-[#DBEAFE] transition-colors disabled:opacity-30"
              title="Increase quantity"
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-all"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>ADD</span>
          </button>
        )}
      </div>
    </div>
  );
}
