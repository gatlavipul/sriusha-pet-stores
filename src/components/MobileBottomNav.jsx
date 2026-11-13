import { useState, useEffect } from "react";
import { Home, Grid, PawPrint, ShoppingCart, User } from "lucide-react";
import useCart from "@/utils/useCart";

export default function MobileBottomNav() {
  const { totalCount } = useCart();
  const [currentPath, setCurrentPath] = useState("/");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname || "/");
    }
  }, []);

  // NEVER render customer bottom nav on admin or delivery partner portals
  if (
    currentPath.startsWith("/admin") ||
    currentPath.startsWith("/delivery")
  ) {
    return null;
  }

  // Exactly 5 navigation items as specified in Phase 2
  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Browse", href: "/products", icon: Grid },
    { label: "My Pets", href: "/pets", icon: PawPrint },
    {
      label: "Cart",
      href: "/cart",
      icon: ShoppingCart,
      badge: totalCount > 0 ? totalCount : null,
      badgeColor: "bg-[#EA580C]",
    },
    { label: "Account", href: "/account", icon: User },
  ];

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 6px)" }}
    >
      <div className="flex items-center justify-around h-14 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.href.split("?")[0]);
          return (
            <a
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1 relative transition-colors ${
                isActive
                  ? "text-[#2563EB] font-bold"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? "text-[#2563EB]" : "text-gray-500"}
                />
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full ${item.badgeColor} text-[10px] font-black text-white flex items-center justify-center leading-none shadow-xs`}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight leading-none ${
                  isActive ? "font-bold text-[#2563EB]" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
