import { useState, useEffect, useCallback } from "react";
import useUser from "@/utils/useUser";

export function useWishlist() {
  const { data: user } = useUser();
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  // Load wishlist IDs
  const loadWishlist = useCallback(async () => {
    try {
      if (!user) {
        const local = JSON.parse(localStorage.getItem("usha_wishlist") || "[]");
        const ids = new Set(local.map((i) => i.id));
        setWishlistIds(ids);
      } else {
        const res = await fetch("/api/wishlist");
        if (res.ok) {
          const data = await res.json();
          setWishlistIds(new Set(data.productIds || []));
        }
      }
    } catch (err) {
      console.error("Wishlist error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  const toggleWishlist = async (product) => {
    const pid = product.id;
    const isCurrentlySaved = wishlistIds.has(pid);

    // Optimistic update
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlySaved) next.delete(pid);
      else next.add(pid);
      return next;
    });

    if (!user) {
      // LocalStorage for guests
      const local = JSON.parse(localStorage.getItem("usha_wishlist") || "[]");
      let nextLocal;
      if (isCurrentlySaved) {
        nextLocal = local.filter((i) => i.id !== pid);
      } else {
        nextLocal = [...local, product];
      }
      localStorage.setItem("usha_wishlist", JSON.stringify(nextLocal));
      return !isCurrentlySaved;
    }

    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: pid }),
      });
      const data = await res.json();
      return data.inWishlist;
    } catch (err) {
      console.error(err);
      loadWishlist(); // Rollback on error
    }
  };

  const isInWishlist = (productId) => wishlistIds.has(productId);

  return {
    wishlistIds,
    isInWishlist,
    toggleWishlist,
    loading,
    count: wishlistIds.size,
  };
}
