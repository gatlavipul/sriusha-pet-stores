import { useState, useEffect } from "react";
import { Home, Search, PawPrint, ShoppingCart, User } from "lucide-react";
import useCart from "@/utils/useCart";
import useUser from "@/utils/useUser";

export default function MobileBottomNav() {
  const { totalCount } = useCart();
  const { data: user } = useUser();
  const [currentPath, setCurrentPath] = useState("/");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname || "/");
    }
  }, []);

  // NEVER render customer bottom nav on admin, delivery portals, or auth pages
  if (
    currentPath.startsWith("/admin") ||
    currentPath.startsWith("/delivery") ||
    currentPath.startsWith("/account/signin") ||
    currentPath.startsWith("/account/signup")
  ) {
    return null;
  }

  // Exactly 5 navigation items as specified in Phase 2 & Brand guidelines:
  // Home, Search (Browse), PawPrint (My Pets), ShoppingCart (Cart), Account
  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Browse", href: "/products", icon: Search },
    { label: "My Pets", href: "/pets", icon: PawPrint },
    {
      label: "Cart",
      href: "/cart",
      icon: ShoppingCart,
      badge: totalCount > 0 ? totalCount : null,
      badgeColor: "bg-[#F97316]",
    },
    {
      label: "Account",
      href: "/account",
      icon: User,
      isAccount: true,
    },
  ];

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFDF9]/95 backdrop-blur-md border-t border-[#EADBCC] shadow-[0_-4px_16px_rgba(74,10,15,0.06)]"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
    >
      <div className="flex items-center justify-around h-14 px-1 max-w-lg mx-auto">
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
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] relative transition-colors select-none ${
                isActive
                  ? "text-[#4A0A0F] font-bold"
                  : "text-stone-500 hover:text-stone-800"
              }`}
              aria-label={item.label}
            >
              <div className="relative flex items-center justify-center">
                {item.isAccount && user?.image ? (
                  <img
                    src={user.image}
                    alt={user.name || "User"}
                    className="h-5 w-5 rounded-full object-cover border border-[#4A0A0F]/30"
                  />
                ) : (
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    className={isActive ? "text-[#4A0A0F]" : "text-stone-500"}
                    fill={
                      isActive
                        ? item.label === "Cart" || item.label === "Account" || item.label === "Home"
                          ? "currentColor"
                          : "none"
                        : "none"
                    }
                  />
                )}
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full ${item.badgeColor} text-[10px] font-black text-white flex items-center justify-center leading-none shadow-xs`}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] tracking-tight mt-0.5 line-clamp-1 ${
                  isActive ? "font-bold text-[#4A0A0F]" : "font-medium text-stone-500"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-[#4A0A0F]" />
              )}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
