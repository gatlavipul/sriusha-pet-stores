import { useState, useEffect } from "react";
import { ShoppingBag, ArrowRight } from "lucide-react";
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
          className="flex items-center justify-between gap-3 rounded-2xl bg-[#0F172A] px-4 py-2.5 sm:py-3 text-white shadow-2xl shadow-blue-950/40 border border-slate-700/80 hover:bg-slate-900 transition-all transform active:scale-[0.99]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EA580C] text-white shadow-xs shrink-0">
              <ShoppingBag size={18} />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  {totalCount} {totalCount === 1 ? "Item" : "Items"}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-sm font-black text-white">
                  ₹{Number(subtotal || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <p className="text-[11px] text-gray-300 truncate font-medium">
                ⚡ 30-60m delivery in Uppal, Hyderabad
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-colors shrink-0">
            <span>View Cart</span>
            <ArrowRight size={14} />
          </div>
        </a>
      </div>
    </aside>
  );
}
