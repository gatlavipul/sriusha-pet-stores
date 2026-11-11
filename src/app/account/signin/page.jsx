import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@auth/create/react";
import {
  ShieldCheck,
  CheckCircle,
  ExternalLink,
  Package,
  Heart,
  Sparkles,
  ArrowLeft,
  Lock,
  Truck,
} from "lucide-react";
import { getLocalCart, setLocalCart } from "@/utils/useCart";

function resolveSafeRedirect(rawCallbackUrl, role) {
  const roleDefaults = {
    admin: "/admin",
    delivery_partner: "/delivery",
    customer: "/account",
  };
  const fallback = roleDefaults[role] || "/account";

  if (!rawCallbackUrl || typeof rawCallbackUrl !== "string") {
    return fallback;
  }

  const url = rawCallbackUrl.trim();

  // Validate internal path safety (prevent open redirect attacks)
  if (
    !url.startsWith("/") ||
    url.startsWith("//") ||
    url.includes("\\") ||
    url.includes(":")
  ) {
    return fallback;
  }

  // Prevent redirect loops back to auth pages or root override
  if (
    url.startsWith("/account/signin") ||
    url.startsWith("/account/signup") ||
    url.startsWith("/account/logout") ||
    url === "/"
  ) {
    return fallback;
  }

  // Role boundaries on redirect URL
  if (url.startsWith("/admin") && role !== "admin") {
    return fallback;
  }
  if (url.startsWith("/delivery") && role !== "delivery_partner") {
    return fallback;
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

export default function SignInPage() {
  const { data: session, status } = useSession();
  const [infoMessage, setInfoMessage] = useState(null);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [clerkLoaded, setClerkLoaded] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [mountFallback, setMountFallback] = useState(false);
  const clerkMountRef = useRef(null);
  const isRedirectingRef = useRef(false);
  const isMountedWidgetRef = useRef(false);

  const hostedDomain = getClerkHostedDomain();
  const returnToOrigin =
    typeof window !== "undefined" ? `${window.location.origin}/account/signin` : "";
  const hostedSignInUrl = hostedDomain
    ? `https://${hostedDomain}/sign-in${returnToOrigin ? `?redirect_url=${encodeURIComponent(returnToOrigin)}` : ""}`
    : null;

  // Read registration notice & callbackUrl on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cb = params.get("callbackUrl") || "";
      setCallbackUrl(cb);
      if (params.get("registered") === "true") {
        setInfoMessage("Your customer account was created successfully! Please sign in to continue.");
      } else if (cb.startsWith("/checkout")) {
        setInfoMessage("Sign in to keep your shopping cart and complete checkout seamlessly.");
      }
    }
  }, []);

  const signUpHref = callbackUrl
    ? `/account/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/account/signup";

  const handlePostLoginRedirect = useCallback(async () => {
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
          // fallback to fetch interceptor
        }
      }

      // 1. Fetch verified role directly from server Neon database
      const roleRes = await fetch("/api/admin/check-role", { headers });
      const roleData = await roleRes.json();
      const verifiedRole = roleData?.role || session?.user?.role || "customer";

      // 2. Merge ONLY unmerged guest cart items once and sync localStorage cleanly
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
          console.warn("Cart merge during signin warning:", e);
        }
      }

      // 3. Resolve safe destination URL based on authoritative Neon role
      const params = new URLSearchParams(window.location.search);
      const rawCallbackUrl = params.get("callbackUrl");
      const targetUrl = resolveSafeRedirect(rawCallbackUrl, verifiedRole);

      window.location.href = targetUrl;
    } catch (e) {
      console.error("Redirect resolution error:", e);
      window.location.href = "/account";
    }
  }, [session?.user?.role]);

  // Redirect immediately if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      handlePostLoginRedirect();
    }
  }, [status, session, handlePostLoginRedirect]);

  // Mount Clerk's official <SignIn /> widget directly
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
          handlePostLoginRedirect();
          return true;
        }

        if (!unsubscribeListener && typeof window.Clerk.addListener === "function") {
          unsubscribeListener = window.Clerk.addListener((resources) => {
            if (resources?.user && resources?.session) {
              handlePostLoginRedirect();
            }
          });
        }

        if (clerkMountRef.current && !isMountedWidgetRef.current) {
          isMountedWidgetRef.current = true;
          const params = new URLSearchParams(window.location.search);
          const rawCallback = params.get("callbackUrl") || "/account";

          window.Clerk.mountSignIn(clerkMountRef.current, {
            signUpUrl: rawCallback && rawCallback !== "/account"
              ? `/account/signup?callbackUrl=${encodeURIComponent(rawCallback)}`
              : "/account/signup",
            fallbackRedirectUrl: rawCallback,
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
        console.warn("[Clerk] Mount SignIn warning:", err);
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
      if (clerkMountRef.current && isMountedWidgetRef.current && window.Clerk?.unmountSignIn) {
        try {
          window.Clerk.unmountSignIn(clerkMountRef.current);
        } catch {
          // noop
        }
        isMountedWidgetRef.current = false;
      }
    };
  }, [handlePostLoginRedirect]);

  if (redirecting) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#FDFDFD] p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent mb-4" />
        <p className="text-sm font-bold text-slate-800">
          Verifying your Sri Usha store account...
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Syncing cart items &amp; preparing your dashboard
        </p>
      </div>
    );
  }

  const benefits = [
    {
      emoji: "📦",
      icon: Package,
      title: "Track Your Orders",
      desc: "Follow live packing and doorstep delivery status across Hyderabad.",
      accent: "bg-blue-50 text-[#2563EB] border-blue-100",
    },
    {
      emoji: "❤️",
      icon: Heart,
      title: "Save Your Favourite Products",
      desc: "Keep veterinary nutrition, medicines, and pet treats one click away.",
      accent: "bg-rose-50 text-rose-600 border-rose-100",
    },
    {
      emoji: "🐾",
      icon: Sparkles,
      title: "Shop Trusted Pet Care",
      desc: "100% genuine veterinarian-approved essentials for dogs, cats & birds.",
      accent: "bg-amber-50 text-[#EA580C] border-amber-100",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#F8FAFC] via-[#EFF6FF]/40 to-[#FFF7ED]/70 text-[#0F172A] flex flex-col">
      {/* Minimal Top Bar */}
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

      {/* Main Two-Column Authentication Experience */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT COLUMN — Sri Usha Brand Experience */}
          <section className="lg:col-span-6 relative overflow-hidden rounded-3xl border border-blue-100/90 bg-gradient-to-br from-white via-[#F0F7FF] to-[#FFF4E8] p-6 sm:p-10 shadow-sm">
            {/* Decorative Subtle Paw & Care SVG Background Elements */}
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
              className="pointer-events-none absolute right-5 bottom-5 h-28 w-28 text-[#2563EB]/[0.06]"
              fill="currentColor"
            >
              <ellipse cx="60" cy="76" rx="22" ry="18" />
              <circle cx="34" cy="48" r="9" />
              <circle cx="51" cy="35" r="9.5" />
              <circle cx="71" cy="35" r="9.5" />
              <circle cx="88" cy="48" r="9" />
            </svg>

            <div className="relative z-10 space-y-6">
              {/* Brand Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/90 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-[#EA580C] shadow-2xs">
                <span>🐾</span>
                <span>Your Pet Care Journey Starts Here</span>
              </div>

              {/* Welcome Heading & Copy */}
              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  Welcome Back to Your Pet Care Family 🐾
                </h1>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  Manage your veterinary prescriptions, repeat pet food orders, wishlist
                  favourites, and fast doorstep delivery across Hyderabad—all in one place.
                </p>
              </div>

              {/* Three Small Benefit Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 pt-1">
                {benefits.map((b) => (
                  <div
                    key={b.title}
                    className="flex items-start gap-3.5 rounded-2xl border border-white/90 bg-white/85 backdrop-blur-xs p-3.5 shadow-2xs transition-transform hover:-translate-y-0.5"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base ${b.accent}`}
                    >
                      <span aria-hidden="true">{b.emoji}</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-sm font-bold text-slate-900">
                        {b.title}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">
                        {b.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Clinic Trust Footer */}
              <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  100% Authentic Vet Pharmacy
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Truck size={14} className="text-[#2563EB]" />
                  Uppal Hub • Same-Day Dispatch
                </span>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN — Clean Clerk Sign-In Card */}
          <section className="lg:col-span-6 w-full max-w-md mx-auto lg:max-w-lg">
            {/* Security Assurance Pill */}
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-800">
                <Lock size={12} className="text-emerald-600" />
                <span>Secure Sign-In • Powered by Clerk</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                256-bit SSL
              </span>
            </div>

            {infoMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 shadow-2xs">
                <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 shadow-xl shadow-slate-200/50">
              {!clerkLoaded && !mountFallback && (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mb-3" />
                  <p className="text-sm font-bold text-slate-800">
                    Connecting to Clerk Secure Sign-In...
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Loading your protected authentication options
                  </p>
                </div>
              )}

              {/* Clerk mounts its official <SignIn /> component here */}
              <div
                ref={clerkMountRef}
                id="clerk-signin-container"
                className="w-full flex justify-center"
              />

              {/* Hosted Fallback if script is blocked */}
              {mountFallback && !clerkLoaded && hostedSignInUrl && (
                <div className="py-6 text-center space-y-4">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Continue to Clerk Sign-In
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Open Clerk&apos;s verified portal to sign in securely to your Sri Usha account.
                    </p>
                  </div>
                  <a
                    href={hostedSignInUrl}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-all"
                  >
                    <span>Sign In with Clerk</span>
                    <ExternalLink size={15} />
                  </a>
                </div>
              )}

              {/* Clear Sign-Up Path & Back to Store */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <p className="text-slate-500">
                  New pet parent?{" "}
                  <a
                    href={signUpHref}
                    className="font-bold text-[#2563EB] hover:underline"
                  >
                    Create Free Account →
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
