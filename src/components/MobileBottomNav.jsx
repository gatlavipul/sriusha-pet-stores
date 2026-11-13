import { useState, useEffect } from "react";
import { Home, Grid, Package, ShoppingCart, User } from "lucide-react";
import useCart from "@/utils/useCart";

export default function MobileBottomNav() {
  const { totalCount } = useCart();
  const [currentPath, setCurrentPath] = useState("/");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Categories", href: "/products", icon: Grid },
    {
      label: "Cart",
      href: "/cart",
      icon: ShoppingCart,
      badge: totalCount > 0 ? totalCount : null,
      badgeColor: "bg-[#2563EB]",
    },
    {
      label: "Orders",
      href: "/account?tab=orders",
      icon: Package,
    },
    { label: "Account", href: "/account", icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-lg safe-area-bottom">
      <nav className="flex items-center justify-around h-15 px-2">
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
                isActive ? "text-[#2563EB] font-bold" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {item.badge !== null && item.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2 min-w-4.5 h-4.5 px-1 rounded-full ${item.badgeColor} text-[10px] font-black text-white flex items-center justify-center leading-none shadow-xs`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}

