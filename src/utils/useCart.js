import { useState, useEffect, useCallback } from "react";
import useUser from "@/utils/useUser";

const CART_STORAGE_KEY = "sriusha_cart_items";

// Custom event to synchronize cart across all components in the tab
const notifyCartUpdate = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("sriusha_cart_updated"));
  }
};

export function getLocalCart() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function setLocalCart(items) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    notifyCartUpdate();
  } catch (e) {
    console.error("Failed to save local cart", e);
  }
}

export default function useCart() {
  const { data: user, loading: userLoading } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshCart = useCallback(async () => {
    if (user) {
      try {
        const res = await fetch("/api/cart");
        if (res.ok) {
          const data = await res.json();
          const serverItems = (data.cartItems || []).map((ci) => ({
            id: ci.id,
            product_id: ci.product_id,
            name: ci.name,
            price: parseFloat(ci.price || 0),
            image_url: ci.image_url,
            quantity: ci.quantity,
            stock_quantity: ci.stock_quantity ?? 99,
          }));
          setItems(serverItems);
          setLocalCart(serverItems);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Could not fetch server cart, falling back to local:", err);
      }
    }
    // Guest or server error fallback
    setItems(getLocalCart());
    setLoading(false);
  }, [user]);

  // Initial load & when user changes
  useEffect(() => {
    if (!userLoading) {
      refreshCart();
    }
  }, [user, userLoading, refreshCart]);

  // Listen for local updates across components
  useEffect(() => {
    const handleUpdate = () => {
      setItems(getLocalCart());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("sriusha_cart_updated", handleUpdate);
      return () => {
        window.removeEventListener("sriusha_cart_updated", handleUpdate);
      };
    }
  }, []);

  // When user signs in: merge guest cart atomically into database cart
  useEffect(() => {
    if (user) {
      const local = getLocalCart();
      // Check if there are local guest items to merge
      const hasGuestItems = local.some((i) => typeof i.id === "string" && i.id.startsWith("local_"));
      if (hasGuestItems && local.length > 0) {
        fetch("/api/cart/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: local }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.cartItems) {
              const merged = data.cartItems.map((ci) => ({
                id: ci.id,
                product_id: ci.product_id,
                name: ci.name,
                price: parseFloat(ci.price || 0),
                image_url: ci.image_url,
                quantity: ci.quantity,
                stock_quantity: ci.stock_quantity ?? 99,
              }));
              setLocalCart(merged);
              setItems(merged);
            } else {
              refreshCart();
            }
          })
          .catch((err) => {
            console.error("Cart merge error:", err);
            refreshCart();
          });
      }
    }
  }, [user, refreshCart]);

  const addToCart = async (product, quantity = 1) => {
    const productId = product.id || product.product_id;
    const current = getLocalCart();
    const existingIndex = current.findIndex(
      (i) => (i.product_id || i.id) === productId
    );

    let updated;
    if (existingIndex > -1) {
      updated = [...current];
      updated[existingIndex].quantity += quantity;
    } else {
      updated = [
        ...current,
        {
          id: `local_${productId}_${Date.now()}`,
          product_id: productId,
          name: product.name,
          price: parseFloat(product.price || 0),
          image_url: product.image_url,
          quantity: quantity,
          stock_quantity: product.stock_quantity ?? 99,
        },
      ];
    }

    setLocalCart(updated);
    setItems(updated);

    if (user) {
      try {
        await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: productId, quantity }),
        });
        refreshCart();
      } catch (err) {
        console.error("Server cart update error:", err);
      }
    }
  };

  const updateQuantity = async (itemId, newQuantity) => {
    const current = getLocalCart();
    if (newQuantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    const updated = current.map((i) =>
      i.id === itemId || i.product_id === itemId
        ? { ...i, quantity: newQuantity }
        : i
    );
    setLocalCart(updated);
    setItems(updated);

    if (user && typeof itemId === "number") {
      try {
        await fetch("/api/cart", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: itemId, quantity: newQuantity }),
        });
      } catch (err) {
        console.error("Server cart update error:", err);
      }
    }
  };

  const removeFromCart = async (itemId) => {
    const current = getLocalCart();
    const updated = current.filter(
      (i) => i.id !== itemId && i.product_id !== itemId
    );
    setLocalCart(updated);
    setItems(updated);

    if (user && typeof itemId === "number") {
      try {
        await fetch(`/api/cart?id=${itemId}`, { method: "DELETE" });
      } catch (err) {
        console.error("Server cart delete error:", err);
      }
    }
  };

  const clearCart = async () => {
    setLocalCart([]);
    setItems([]);
  };

  const totalCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (parseFloat(item.price) || 0) * (item.quantity || 1),
    0
  );

  const FREE_SHIPPING_THRESHOLD = 499;
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const amountForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return {
    items,
    loading: userLoading || loading,
    totalCount,
    subtotal,
    isFreeShipping,
    amountForFreeShipping,
    FREE_SHIPPING_THRESHOLD,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart,
  };
}

export { useCart };
