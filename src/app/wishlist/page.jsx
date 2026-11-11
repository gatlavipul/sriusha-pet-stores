import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { Heart, ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import useUser from "@/utils/useUser";
import { useCart } from "@/utils/useCart";

export default function WishlistPage() {
  const { data: user, loading: userLoading } = useUser();
  const { addToCart } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWishlist();
  }, [user]);

  const fetchWishlist = async () => {
    try {
      if (!user) {
        // Guest: load from localStorage
        const local = JSON.parse(localStorage.getItem("usha_wishlist") || "[]");
        setItems(local);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/wishlist");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (productId) => {
    try {
      setItems((prev) => prev.filter((i) => i.id !== productId));

      if (user) {
        await fetch(`/api/wishlist?product_id=${productId}`, { method: "DELETE" });
      } else {
        const local = JSON.parse(localStorage.getItem("usha_wishlist") || "[]");
        const filtered = local.filter((i) => i.id !== productId);
        localStorage.setItem("usha_wishlist", JSON.stringify(filtered));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToCart = async (product) => {
    await addToCart(product, 1);
  };

  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD]">
        <Header />
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mx-auto mb-4" />
          <p className="text-xs text-gray-500 font-medium">Loading your saved items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#0F172A]">
      <Header />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 border-b border-gray-200 pb-4">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
            <Heart size={24} className="text-rose-500 fill-rose-500" />
            <span>My Wishlist</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Products you saved for future purchases
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-12 text-center shadow-xs max-w-md mx-auto">
            <Heart size={48} className="mx-auto text-gray-300 mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">Your Wishlist is Empty</h2>
            <p className="text-xs text-gray-500 mb-6">
              Tap the heart icon on any product in our store to save it here for later.
            </p>
            <a
              href="/products"
              className="rounded-xl bg-[#2563EB] px-6 py-3 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8]"
            >
              Explore Products
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((prod) => (
              <div
                key={prod.id}
                className="group flex flex-col justify-between rounded-3xl border border-gray-200 bg-white p-4 shadow-xs hover:shadow-md transition-all"
              >
                <div>
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-gray-50 p-2">
                    <img
                      src={
                        prod.image_url ||
                        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=400&q=80"
                      }
                      alt={prod.name}
                      className="h-full w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                    <button
                      onClick={() => handleRemove(prod.id)}
                      title="Remove from wishlist"
                      className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-400 hover:text-red-600 shadow-xs"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      {prod.brand || prod.category_name || "Pet Essentials"}
                    </div>
                    <a
                      href={`/products/${prod.slug}`}
                      className="text-sm font-bold text-gray-900 hover:text-[#2563EB] line-clamp-2 mt-0.5"
                    >
                      {prod.name}
                    </a>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="text-base font-extrabold text-gray-900">
                      ₹{parseFloat(prod.sale_price || prod.price).toFixed(0)}
                    </div>
                    {prod.compare_price && (
                      <div className="text-[11px] text-gray-400 line-through">
                        ₹{parseFloat(prod.compare_price).toFixed(0)}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleAddToCart(prod)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-colors"
                  >
                    <ShoppingBag size={13} />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

