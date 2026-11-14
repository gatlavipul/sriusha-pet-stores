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

  // Live delivery zone settings from database (Rule 7)
  const [deliveryZone, setDeliveryZone] = useState({
    checked: false,
    pincode: null,
    areaName: null,
    deliveryCharge: null,
    freeDeliveryThreshold: null,
    estimatedDeliveryTime: null,
    prompt: "Enter pincode to see delivery fee",
  });

  const refreshCart = useCallback(async () => {
    if (user) {
      const local = getLocalCart();
      const guestItems = local.filter(
        (i) => typeof i.id === "string" && i.id.startsWith("local_")
      );

      // Merge any unmerged guest items atomically BEFORE reading server cart
      if (guestItems.length > 0) {
        try {
          const mergeRes = await fetch("/api/cart/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: guestItems }),
          });
          if (mergeRes.ok) {
            const mergeData = await mergeRes.json();
            if (mergeData.success && Array.isArray(mergeData.cartItems)) {
              const merged = mergeData.cartItems.map((ci) => ({
                id: ci.id,
                product_id: ci.product_id,
                variant_id: ci.variant_id || null,
                variant_name: ci.variant_name || null,
                requires_prescription: Boolean(ci.requires_prescription),
                name: ci.name,
                price: parseFloat(ci.price || 0),
                compare_price: ci.compare_price ? parseFloat(ci.compare_price) : null,
                image_url: ci.image_url,
                quantity: ci.quantity,
                stock_quantity: ci.stock_quantity ?? 0,
              }));
              setItems(merged);
              setLocalCart(merged);
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.error("Cart merge error:", err);
        }
      }

      try {
        const res = await fetch("/api/cart");
        if (res.ok) {
          const data = await res.json();
          const serverItems = (data.cartItems || []).map((ci) => ({
            id: ci.id,
            product_id: ci.product_id,
            variant_id: ci.variant_id || null,
            variant_name: ci.variant_name || null,
            requires_prescription: Boolean(ci.requires_prescription),
            name: ci.name,
            price: parseFloat(ci.price || 0),
            compare_price: ci.compare_price ? parseFloat(ci.compare_price) : null,
            image_url: ci.image_url,
            quantity: ci.quantity,
            stock_quantity: ci.stock_quantity ?? 0,
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

  const totalCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (parseFloat(item.price) || 0) * (item.quantity || 1),
    0
  );

  // Rule 7: Fetch live delivery fee and threshold only from delivery_serviceability_zones in DB
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedPin =
      localStorage.getItem("usha_delivery_pincode") ||
      (user?.shipping_pincode ? String(user.shipping_pincode) : null);

    if (savedPin && savedPin.trim().length === 6) {
      const pin = savedPin.trim();
      fetch(`/api/serviceability?pincode=${pin}&subtotal=${subtotal}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.serviceable) {
            setDeliveryZone({
              checked: true,
              pincode: pin,
              areaName: d.areaName || "Hyderabad",
              deliveryCharge: Number(d.deliveryCharge ?? 30),
              freeDeliveryThreshold: Number(d.freeDeliveryThreshold ?? 300),
              estimatedDeliveryTime: d.estimatedDeliveryTime || "1-2 hours",
              prompt: null,
            });
          } else {
            setDeliveryZone({
              checked: true,
              pincode: pin,
              areaName: null,
              deliveryCharge: null,
              freeDeliveryThreshold: null,
              estimatedDeliveryTime: null,
              prompt: "Doorstep delivery is currently not serviceable to this pincode",
            });
          }
        })
        .catch(() => {});
    } else {
      // Pincode not entered yet
      setDeliveryZone({
        checked: false,
        pincode: null,
        areaName: null,
        deliveryCharge: null,
        freeDeliveryThreshold: null,
        estimatedDeliveryTime: null,
        prompt: "Enter pincode to see delivery fee",
      });
    }
  }, [subtotal, user]);

  /**
   * Rule 1: Optimistic ADD with server sync and rollback on rejection
   */
  const addToCart = async (product, quantity = 1) => {
    const productId = product.id || product.product_id;
    const variantId = product.variant_id || null;
    const variantName = product.variant_name || null;
    const previousCart = getLocalCart();

    const existingIndex = previousCart.findIndex(
      (i) =>
        (i.product_id || i.id) === productId &&
        (i.variant_id || null) === variantId
    );

    let updated;
    if (existingIndex > -1) {
      updated = [...previousCart];
      const maxStock = product.stock_quantity ?? updated[existingIndex].stock_quantity ?? 99;
      const targetQty = updated[existingIndex].quantity + quantity;
      if (targetQty > maxStock) {
        const errorMsg = `Only ${maxStock} unit(s) available in stock.`;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sriusha_cart_error", { detail: errorMsg }));
        }
        return { success: false, error: errorMsg };
      }
      updated[existingIndex].quantity = targetQty;
    } else {
      const maxStock = product.stock_quantity ?? 99;
      if (quantity > maxStock) {
        const errorMsg = `Only ${maxStock} unit(s) available in stock.`;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sriusha_cart_error", { detail: errorMsg }));
        }
        return { success: false, error: errorMsg };
      }

      updated = [
        ...previousCart,
        {
          id: `local_${productId}_${variantId || "base"}_${Date.now()}`,
          product_id: productId,
          variant_id: variantId,
          variant_name: variantName,
          requires_prescription: Boolean(product.requires_prescription),
          name: product.name,
          price: parseFloat(product.price || 0),
          compare_price: product.compare_price ? parseFloat(product.compare_price) : null,
          image_url: product.image_url,
          quantity,
          stock_quantity: maxStock,
        },
      ];
    }

    // Instant optimistic update
    setLocalCart(updated);
    setItems(updated);

    if (user) {
      try {
        const res = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: productId,
            variant_id: variantId,
            variant_name: variantName,
            quantity,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          // Rollback to previous state on server rejection
          setLocalCart(previousCart);
          setItems(previousCart);
          const errorMsg = errData.error || "Cannot add item to cart.";
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sriusha_cart_error", { detail: errorMsg }));
          }
          return { success: false, error: errorMsg };
        }

        refreshCart();
        return { success: true };
      } catch (err) {
        // Rollback on network failure
        setLocalCart(previousCart);
        setItems(previousCart);
        const errorMsg = "Network error. Please try again.";
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sriusha_cart_error", { detail: errorMsg }));
        }
        return { success: false, error: errorMsg };
      }
    }

    return { success: true };
  };

  /**
   * Rule 1: Optimistic Stepper update with server sync and rollback on rejection
   */
  const updateQuantity = async (itemId, newQuantity) => {
    const previousCart = getLocalCart();
    if (newQuantity <= 0) {
      return await removeFromCart(itemId);
    }

    // Find the item and check its stock limit
    const targetItem = previousCart.find((i) => i.id === itemId || i.product_id === itemId);
    if (targetItem && targetItem.stock_quantity && newQuantity > targetItem.stock_quantity) {
      const errorMsg = `Only ${targetItem.stock_quantity} unit(s) available in stock.`;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sriusha_cart_error", { detail: errorMsg }));
      }
      return { success: false, error: errorMsg };
    }

    const updated = previousCart.map((i) =>
      i.id === itemId || i.product_id === itemId
        ? { ...i, quantity: newQuantity }
        : i
    );

    // Instant optimistic update
    setLocalCart(updated);
    setItems(updated);

    if (user && typeof itemId === "number") {
      try {
        const res = await fetch("/api/cart", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: itemId, quantity: newQuantity }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          // Rollback on server rejection
          setLocalCart(previousCart);
          setItems(previousCart);
          const errorMsg = errData.error || "Quantity could not be updated.";
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("sriusha_cart_error", { detail: errorMsg }));
          }
          return { success: false, error: errorMsg };
        }

        return { success: true };
      } catch (err) {
        setLocalCart(previousCart);
        setItems(previousCart);
        const errorMsg = "Network error. Please try again.";
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sriusha_cart_error", { detail: errorMsg }));
        }
        return { success: false, error: errorMsg };
      }
    }

    return { success: true };
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
    return { success: true };
  };

  const clearCart = async () => {
    setLocalCart([]);
    setItems([]);
  };

  // Free delivery calculations based strictly on live DB delivery zone (Rule 7)
  const isFreeShipping =
    deliveryZone.freeDeliveryThreshold !== null
      ? subtotal >= deliveryZone.freeDeliveryThreshold
      : false;

  const amountForFreeShipping =
    deliveryZone.freeDeliveryThreshold !== null
      ? Math.max(0, deliveryZone.freeDeliveryThreshold - subtotal)
      : null;

  return {
    items,
    loading: userLoading || loading,
    totalCount,
    subtotal,
    deliveryZone,
    isFreeShipping,
    amountForFreeShipping,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart,
  };
}

export { useCart };
