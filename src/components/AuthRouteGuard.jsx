import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { useUser } from "@clerk/clerk-react";
import { AlertCircle, RotateCcw } from "lucide-react";

export function getClerkPublishableKey() {
  return (
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
        process.env.VITE_CLERK_PUBLISHABLE_KEY ||
        process.env.CLERK_PUBLISHABLE_KEY)) ||
    (typeof import.meta !== "undefined" &&
      import.meta.env &&
      (import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
        import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
        import.meta.env.CLERK_PUBLISHABLE_KEY)) ||
    ""
  );
}

export function LoadingScreen({ onRetry, showRetry = false }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FFFDF9] px-6 text-center select-none">
      <div className="relative mb-6 flex items-center justify-center">
        {/* Animated outer ring */}
        <div className="h-24 w-24 rounded-full border-4 border-[#FED7AA] border-t-[#F97316] animate-spin" />
        
        {/* Centered Brand Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/brand/logo-mark.webp"
            onError={(e) => {
              e.currentTarget.src = "/brand/logo-mark.png";
            }}
            alt="Sri Usha Pet Store"
            width={48}
            height={48}
            className="h-12 w-12 object-contain"
          />
        </div>
      </div>

      <h1 className="text-xl font-black tracking-tight text-[#4A0A0F]">
        Sri Usha Pet Store
      </h1>
      <p className="mt-1 text-xs font-semibold text-stone-500">
        Hyderabad&apos;s Veterinary &amp; Pet Care Destination
      </p>

      {showRetry ? (
        <div className="mt-8 flex flex-col items-center gap-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>Something went wrong loading the store</span>
          </div>
          <button
            type="button"
            onClick={onRetry || (() => window.location.reload())}
            className="inline-flex items-center gap-2 rounded-xl bg-[#4A0A0F] px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-[#360509] min-h-[44px] transition-transform active:scale-95"
          >
            <RotateCcw size={14} />
            <span>Tap to retry</span>
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F97316] animate-ping" />
          <p className="text-[11px] font-medium text-stone-400">
            Loading your pet store...
          </p>
        </div>
      )}
    </div>
  );
}

export default function AuthRouteGuard({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useUser();
  const [loadTimeout, setLoadTimeout] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const publishableKey = getClerkPublishableKey();
  const pathname = location?.pathname || "/";
  const isAuthRoute =
    pathname.startsWith("/account/signin") ||
    pathname.startsWith("/account/signup");

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Set timeout if loading takes longer than 9 seconds
  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => {
      setLoadTimeout(true);
    }, 9000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  // Handle route protection transitions
  useEffect(() => {
    if (!isLoaded || !isClient) return;

    if (!isSignedIn && !isAuthRoute) {
      // Redirect signed-out users to sign in
      const search = location?.search || "";
      const currentFull = pathname + search;
      const callbackParam =
        currentFull !== "/" && currentFull !== ""
          ? `?callbackUrl=${encodeURIComponent(currentFull)}`
          : "";
      navigate(`/account/signin${callbackParam}`, { replace: true });
    } else if (isSignedIn && isAuthRoute) {
      // Redirect signed-in users away from sign-in to home
      navigate("/", { replace: true });
    }
  }, [isLoaded, isSignedIn, isAuthRoute, pathname, isClient, navigate, location?.search]);

  // Missing publishable key error
  if (!publishableKey) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white p-8 shadow-xl">
          <img
            src="/brand/logo-mark.webp"
            onError={(e) => {
              e.currentTarget.src = "/brand/logo-mark.png";
            }}
            alt="Sri Usha Pet Store"
            className="mx-auto h-16 w-16 object-contain mb-4"
          />
          <h2 className="text-xl font-extrabold text-[#4A0A0F]">
            Authentication Configuration Error
          </h2>
          <p className="mt-2 text-xs text-stone-600 leading-relaxed">
            The Clerk publishable key environment variable is not configured.
          </p>
          <div className="mt-4 rounded-xl bg-stone-100 p-3 text-left font-mono text-[11px] text-stone-800">
            <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>
            <br />
            <code>VITE_CLERK_PUBLISHABLE_KEY</code>
          </div>
          <p className="mt-3 text-[11px] text-stone-500">
            Please add this environment variable in your Netlify site settings.
          </p>
        </div>
      </div>
    );
  }

  // 1. Initial hydration or Clerk loading state: show centered spinner with logo
  if (!isLoaded && isClient) {
    return (
      <LoadingScreen
        showRetry={loadTimeout}
        onRetry={() => {
          setLoadTimeout(false);
          window.location.reload();
        }}
      />
    );
  }

  // 2. Signed out but trying to access a protected route: keep loading spinner during redirect
  if (isLoaded && !isSignedIn && !isAuthRoute) {
    return <LoadingScreen />;
  }

  // 3. Signed in but on signin/signup: keep loading spinner during redirect to home
  if (isLoaded && isSignedIn && isAuthRoute) {
    return <LoadingScreen />;
  }

  // 4. Render children normally
  return <>{children}</>;
}

