import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@auth/create/react";
import {
  ShieldCheck,
  ExternalLink,
  ArrowLeft,
  Lock,
  Zap,
  Package,
  Heart,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { getLocalCart, setLocalCart } from "@/utils/useCart";

function getSafeCallback(raw) {
  if (!raw || typeof raw !== "string") return "/account";
  const url = raw.trim();
  if (
    !url.startsWith("/") ||
    url.startsWith("//") ||
    url.includes("\\") ||
    url.includes(":") ||
    url.startsWith("/account/signup") ||
    url.startsWith("/account/signin") ||
    url.startsWith("/admin") ||
    url.startsWith("/delivery")
  ) {
    return "/account";
  }
  return url;
}

function getClerkHostedDomain() {
  try {
    const pk =
      (typeof import.meta !== "undefined" && import.meta.env?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ||
      (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ||
      "";
    if (!pk.startsWith("pk_")) return null;
    const raw = pk.replace(/^pk_(test|live)_/, "");
    const decoded = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    const domain = decoded.endsWith("$") ? decoded.slice(0, -1) : decoded;
    return domain.includes(".") ? domain : null;
  } catch {
    return null;
  }
}

function isClerkLoaded() {
  return Boolean(
    typeof window !== "undefined" &&
      window.Clerk &&
      (window.Clerk.loaded || window.Clerk.status === "ready")
  );
}

export default function SignUpPage() {
  const { data: session, status } = useSession();
  const [callbackUrl, setCallbackUrl] = useState("");
  const [clerkLoaded, setClerkLoaded] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [mountFallback, setMountFallback] = useState(false);
  const clerkMountRef = useRef(null);
  const isRedirectingRef = useRef(false);
  const isMountedWidgetRef = useRef(false);

  const hostedDomain = getClerkHostedDomain();
  const returnToOrigin =
    typeof window !== "undefined" ? `${window.location.origin}/account` : "";
  const hostedSignUpUrl = hostedDomain
    ? `https://${hostedDomain}/sign-up${returnToOrigin ? `?redirect_url=${encodeURIComponent(returnToOrigin)}` : ""}`
    : null;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setCallbackUrl(params.get("callbackUrl") || "");
    }
  }, []);

  const signInHref = callbackUrl
    ? `/account/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/account/signin";

  const handlePostSignupRedirect = useCallback(async () => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    setRedirecting(true);

    try {
      const headers = {};
      if (typeof window !== "undefined" && window.Clerk?.session) {
        try {
          const token = await window.Clerk.session.getToken();
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        } catch {
          // fallback
        }
      }

      // Sync customer profile into Neon PostgreSQL (strictly defaults to role = 'customer')
      try {
        await fetch("/api/account/me", { headers });
      } catch (e) {
        console.warn("Customer sync during signup warning:", e);
      }

      // Merge ONLY unmerged guest items once and update localStorage cleanly
      const localItems = getLocalCart();
      const guestItems = localItems.filter(
        (i) => typeof i.id === "string" && i.id.startsWith("local_")
      );
      if (guestItems.length > 0) {
        try {
          const mergeRes = await fetch("/api/cart/merge", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({ items: guestItems }),
          });
          if (mergeRes.ok) {
            const mergeData = await mergeRes.json();
            if (mergeData.success && Array.isArray(mergeData.cartItems)) {
              const merged = mergeData.cartItems.map((ci) => ({
                id: ci.id,
                product_id: ci.product_id,
                name: ci.name,
                price: parseFloat(ci.price || 0),
                image_url: ci.image_url,
                quantity: ci.quantity,
                stock_quantity: ci.stock_quantity ?? 99,
              }));
              setLocalCart(merged);
            }
          }
        } catch (e) {
          console.warn("Cart merge during signup warning:", e);
        }
      }

      const params = new URLSearchParams(window.location.search);
      const rawCallback = params.get("callbackUrl");
      window.location.href = getSafeCallback(rawCallback);
    } catch (e) {
      console.error("Signup redirect error:", e);
      window.location.href = "/account";
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      handlePostSignupRedirect();
    }
  }, [status, session, handlePostSignupRedirect]);

  // Mount Clerk's official <SignUp /> widget directly
  useEffect(() => {
    if (typeof window === "undefined") return;

    let unsubscribeListener = null;
    let pollTimer = null;
    let fallbackTimer = null;

    const mountClerkWidget = async () => {
      if (!window.Clerk) return false;

      try {
        if (!isClerkLoaded() && typeof window.__initClerk === "function") {
          await window.__initClerk();
        } else if (!isClerkLoaded()) {
          await window.Clerk.load({
            signInUrl: "/account/signin",
            signUpUrl: "/account/signup",
          });
        }

        if (!isClerkLoaded()) return false;

        setClerkLoaded(true);
        setMountFallback(false);

        if (window.Clerk.user && window.Clerk.session) {
          handlePostSignupRedirect();
          return true;
        }

        if (!unsubscribeListener && typeof window.Clerk.addListener === "function") {
          unsubscribeListener = window.Clerk.addListener((resources) => {
            if (resources?.user && resources?.session) {
              handlePostSignupRedirect();
            }
          });
        }

        if (clerkMountRef.current && !isMountedWidgetRef.current) {
          isMountedWidgetRef.current = true;
          const params = new URLSearchParams(window.location.search);
          const safeCallback = getSafeCallback(params.get("callbackUrl"));

          window.Clerk.mountSignUp(clerkMountRef.current, {
            signInUrl: safeCallback !== "/account"
              ? `/account/signin?callbackUrl=${encodeURIComponent(safeCallback)}`
              : "/account/signin",
            fallbackRedirectUrl: safeCallback,
            appearance: {
              variables: {
                colorPrimary: "#2563EB",
                colorText: "#0F172A",
                colorTextSecondary: "#475569",
                borderRadius: "1rem",
                fontFamily: "inherit",
              },
              elements: {
                rootBox: "w-full mx-auto",
                card: "w-full shadow-none border-0 bg-transparent p-0",
                cardBox: "w-full shadow-none border-0 bg-transparent",
                headerTitle: "text-xl font-extrabold text-slate-900",
                headerSubtitle: "text-xs text-slate-500",
                socialButtonsBlockButton:
                  "rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors",
                formButtonPrimary:
                  "rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-sm font-bold shadow-xs",
                formFieldInput:
                  "rounded-xl border-slate-300 focus:border-[#2563EB] focus:ring-[#2563EB]",
                footer: "hidden",
              },
            },
          });
        }

        return isMountedWidgetRef.current;
      } catch (err) {
        console.warn("[Clerk] Mount SignUp warning:", err);
        return false;
      }
    };

    const onClerkReady = () => {
      mountClerkWidget();
    };

    window.addEventListener("clerk:ready", onClerkReady);

    mountClerkWidget().then((mounted) => {
      if (!mounted) {
        let attempts = 0;
        pollTimer = setInterval(async () => {
          attempts += 1;
          const ok = await mountClerkWidget();
          if (ok || attempts >= 60) {
            clearInterval(pollTimer);
          }
        }, 150);

        fallbackTimer = setTimeout(() => {
          if (!isMountedWidgetRef.current) {
            setMountFallback(true);
          }
        }, 8000);
      }
    });

    return () => {
      window.removeEventListener("clerk:ready", onClerkReady);
      if (pollTimer) clearInterval(pollTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (typeof unsubscribeListener === "function") {
        try {
          unsubscribeListener();
        } catch {
          // noop
        }
      }
      if (clerkMountRef.current && isMountedWidgetRef.current && window.Clerk?.unmountSignUp) {
        try {
          window.Clerk.unmountSignUp(clerkMountRef.current);
        } catch {
          // noop
        }
        isMountedWidgetRef.current = false;
      }
    };
  }, [handlePostSignupRedirect]);

  if (redirecting) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#FDFDFD] p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent mb-4" />
        <p className="text-sm font-bold text-slate-800">
          Setting up your customer account...
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Saving your cart &amp; preparing your Sri Usha pet care portal
        </p>
      </div>
    );
  }

  const benefits = [
    {
      icon: Zap,
      title: "Faster checkout",
      desc: "Speed through express checkout with prefilled customer details.",
      accent: "bg-amber-50 text-[#EA580C] border-amber-100",
    },
    {
      icon: Package,
      title: "Order tracking",
      desc: "Watch your pet supplies move from our Uppal vet hub to your door.",
      accent: "bg-blue-50 text-[#2563EB] border-blue-100",
    },
    {
      icon: Heart,
      title: "Wishlist",
      desc: "Save vet diets, treats & grooming favourites to reorder anytime.",
      accent: "bg-rose-50 text-rose-600 border-rose-100",
    },
    {
      icon: MapPin,
      title: "Saved delivery addresses",
      desc: "Store home & clinic drop-off pins across Hyderabad & Secunderabad.",
      accent: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF]/40 to-[#FFF7ED]/70 text-[#0F172A] flex flex-col">
      {/* Top Bar */}
      <header className="w-full border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <img
              src="https://ucarecdn.com/1ba9ff02-d14c-447c-b424-734247393bdd/-/format/auto/"
              alt="Sri Usha Vet & Pet Stores"
              className="h-9 sm:h-10 w-auto transition-transform group-hover:scale-105"
            />
            <div>
              <div className="text-sm font-extrabold tracking-tight text-slate-900 leading-tight">
                Sri Usha
              </div>
              <div className="text-[10px] font-bold tracking-wider text-[#EA580C] uppercase">
                Vet &amp; Pet Stores
              </div>
            </div>
          </a>

          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to Store</span>
          </a>
        </div>
      </header>

      {/* Main Two-Column Sign-Up Layout */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT COLUMN — Onboarding Benefits */}
          <section className="lg:col-span-6 relative overflow-hidden rounded-3xl border border-blue-100/90 bg-gradient-to-br from-white via-[#F0F7FF] to-[#FFF4E8] p-6 sm:p-10 shadow-sm">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full bg-blue-100/50 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-amber-100/60 blur-2xl"
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 120 120"
              className="pointer-events-none absolute right-5 bottom-5 h-28 w-28 text-[#EA580C]/[0.07]"
              fill="currentColor"
            >
              <ellipse cx="60" cy="76" rx="22" ry="18" />
              <circle cx="34" cy="48" r="9" />
              <circle cx="51" cy="35" r="9.5" />
              <circle cx="71" cy="35" r="9.5" />
              <circle cx="88" cy="48" r="9" />
            </svg>

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/90 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-[#2563EB] shadow-2xs">
                <span>✨</span>
                <span>Your Pet Care Journey Starts Here</span>
              </div>

              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  Join the Sri Usha Pet Care Family 🐾
                </h1>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Create your free customer account in seconds for genuine veterinary products,
                  effortless repeat orders, and local Hyderabad delivery.
                </p>
              </div>

              {/* Four Member Benefits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {benefits.map((b) => {
                  const Icon = b.icon;
                  return (
                    <div
                      key={b.title}
                      className="flex flex-col gap-2 rounded-2xl border border-white/90 bg-white/85 backdrop-blur-xs p-4 shadow-2xs transition-transform hover:-translate-y-0.5"
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border ${b.accent}`}
                      >
                        <Icon size={17} />
                      </div>
                      <div>
                        <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                          {b.title}
                        </h2>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          {b.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-200/70 flex items-center gap-2 text-[11px] font-medium text-slate-600">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>
                  Standard Customer Account • Verified by Clerk &amp; Protected by Sri Usha
                </span>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN — Clerk <SignUp /> Card */}
          <section className="lg:col-span-6 w-full max-w-md mx-auto lg:max-w-lg">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-800">
                <Lock size={12} className="text-emerald-600" />
                <span>Protected Customer Registration • Clerk</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                Free Forever
              </span>
            </div>

            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 shadow-xl shadow-slate-200/50">
              {!clerkLoaded && !mountFallback && (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mb-3" />
                  <p className="text-sm font-bold text-slate-800">
                    Connecting to Clerk Registration...
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Preparing your secure customer account setup
                  </p>
                </div>
              )}

              <div
                ref={clerkMountRef}
                id="clerk-signup-container"
                className="w-full flex justify-center"
              />

              {mountFallback && !clerkLoaded && hostedSignUpUrl && (
                <div className="py-6 text-center space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Continue to Clerk Sign-Up
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Click below to create your customer account securely on Clerk.
                    </p>
                  </div>
                  <a
                    href={hostedSignUpUrl}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-all"
                  >
                    <span>Create Account with Clerk</span>
                    <ExternalLink size={15} />
                  </a>
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <p className="text-slate-500">
                  Already have an account?{" "}
                  <a
                    href={signInHref}
                    className="font-bold text-[#2563EB] hover:underline"
                  >
                    Sign In →
                  </a>
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <span>← Back to Store</span>
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
