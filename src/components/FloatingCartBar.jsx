import { useState, useEffect } from "react";
import { ShoppingBag, ArrowRight, Zap } from "lucide-react";
import useCart from "@/utils/useCart";

export default function FloatingCartBar() {
  const { totalCount, subtotal } = useCart();
  const [currentPath, setCurrentPath] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname || "/");
    }
  }, []);

  // Do not show on cart or checkout pages, delivery, admin, or when cart is empty
  if (
    totalCount <= 0 ||
    currentPath.startsWith("/cart") ||
    currentPath.startsWith("/checkout") ||
    currentPath.startsWith("/admin") ||
    currentPath.startsWith("/delivery")
  ) {
    return null;
  }

  return (
    <aside
      aria-label="Active cart summary bar"
      className="fixed left-0 right-0 z-40 px-3 sm:px-6 pointer-events-none"
      style={{
        bottom: "calc(64px + max(env(safe-area-inset-bottom, 0px), 8px))",
      }}
    >
      <div className="mx-auto max-w-lg pointer-events-auto">
        <a
          href="/cart"
          className="flex items-center justify-between gap-3 rounded-2xl bg-[#4A0A0F] px-4 py-2.5 sm:py-3 text-white shadow-2xl shadow-[#4A0A0F]/30 border border-[#701A20] hover:bg-[#360509] transition-all transform active:scale-[0.99]"
          aria-label={`View Cart, ${totalCount} items, total ₹${Number(subtotal || 0).toLocaleString("en-IN")}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F97316] text-white shadow-xs shrink-0">
              <ShoppingBag size={18} strokeWidth={2} />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#FACC15]">
                  {totalCount} {totalCount === 1 ? "Item" : "Items"}
                </span>
                <span className="text-stone-300">•</span>
                <span className="text-sm font-black text-white">
                  ₹{Number(subtotal || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <p className="flex items-center gap-1 text-[11px] text-amber-100/90 truncate font-medium">
                <Zap size={11} className="fill-[#FACC15] text-[#FACC15]" />
                <span>30-60m delivery in Uppal, Hyderabad</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-[#F97316] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#EA580C] transition-colors shrink-0">
            <span>View Cart</span>
            <ArrowRight size={14} />
          </div>
        </a>
      </div>
    </aside>
  );
}
