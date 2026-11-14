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
  PawPrint,
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
                colorPrimary: "#4A0A0F",
                colorText: "#241819",
                colorTextSecondary: "#57534E",
                borderRadius: "1rem",
                fontFamily: "inherit",
              },
              elements: {
                rootBox: "w-full mx-auto",
                card: "w-full shadow-none border-0 bg-transparent p-0",
                cardBox: "w-full shadow-none border-0 bg-transparent",
                headerTitle: "text-xl font-extrabold text-stone-900",
                headerSubtitle: "text-xs text-stone-500",
                socialButtonsBlockButton:
                  "rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors",
                formButtonPrimary:
                  "rounded-xl bg-[#4A0A0F] hover:bg-[#360509] text-sm font-bold shadow-xs",
                formFieldInput:
                  "rounded-xl border-stone-300 focus:border-[#F97316] focus:ring-[#F97316]",
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
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#FFFDF9] p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#4A0A0F] border-t-transparent mb-4" />
        <p className="text-sm font-bold text-stone-800">
          Verifying your Sri Usha store account...
        </p>
        <p className="text-xs text-stone-500 mt-1">
          Syncing cart items &amp; preparing your dashboard
        </p>
      </div>
    );
  }

  const benefits = [
    {
      icon: Package,
      title: "Track Your Orders",
      desc: "Follow live packing and doorstep delivery status across Hyderabad.",
      accent: "bg-[#FFF7ED] text-[#F97316] border-[#FED7AA]",
    },
    {
      icon: Heart,
      title: "Save Your Favourite Products",
      desc: "Keep veterinary nutrition, medicines, and pet treats one click away.",
      accent: "bg-rose-50 text-rose-600 border-rose-100",
    },
    {
      icon: Sparkles,
      title: "Shop Trusted Pet Care",
      desc: "Genuine veterinarian-approved essentials for dogs, cats & birds.",
      accent: "bg-[#FEFCE8] text-[#D97706] border-[#FEF08A]",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] text-[#241819] flex flex-col">
      {/* Minimal Top Bar */}
      <header className="w-full border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <img
              src="/brand/logo-full.webp"
              onError={(e) => {
                e.currentTarget.src = "/brand/logo-full.png";
              }}
              alt="Sri Usha Vet & Pet Stores"
              width={160}
              height={48}
              className="h-9 sm:h-10 w-auto transition-transform group-hover:scale-105"
            />
          </a>

          <a
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-bold text-[#4A0A0F] shadow-2xs hover:border-[#F97316] hover:text-[#F97316] transition-colors"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            <span>Back to Store</span>
          </a>
        </div>
      </header>

      {/* Main Two-Column Authentication Experience */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* LEFT COLUMN — Sri Usha Brand Experience */}
          <section className="lg:col-span-6 relative overflow-hidden rounded-3xl border border-[#FED7AA] bg-gradient-to-br from-white via-[#FFFDF9] to-[#FFF7ED] p-6 sm:p-10 shadow-sm">
            {/* Decorative Subtle Elements */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full bg-orange-100/40 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-amber-100/50 blur-2xl"
            />

            <div className="relative z-10 space-y-6">
              {/* Brand Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FED7AA] bg-white/90 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-[#F97316] shadow-2xs">
                <PawPrint size={13} strokeWidth={1.75} className="text-[#F97316]" />
                <span>Your Pet Care Journey Starts Here</span>
              </div>

              {/* Welcome Heading & Copy */}
              <div className="space-y-3">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#4A0A0F] leading-tight">
                  Welcome Back to Your Pet Care Family
                </h1>
                <p className="text-sm sm:text-base text-stone-600 leading-relaxed">
                  Manage your veterinary prescriptions, repeat pet food orders, wishlist
                  favourites, and fast doorstep delivery across Hyderabad—all in one place.
                </p>
              </div>

              {/* Three Small Benefit Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 pt-1">
                {benefits.map((b) => {
                  const IconComp = b.icon;
                  return (
                    <div
                      key={b.title}
                      className="flex items-start gap-3.5 rounded-2xl border border-white/90 bg-white/90 backdrop-blur-xs p-3.5 shadow-2xs transition-transform hover:-translate-y-0.5"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base ${b.accent}`}
                      >
                        <IconComp size={18} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xs sm:text-sm font-bold text-[#4A0A0F]">
                          {b.title}
                        </h2>
                        <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 leading-snug">
                          {b.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Clinic Trust Footer */}
              <div className="pt-2 border-t border-stone-200/80 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-stone-600">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={14} strokeWidth={1.75} className="text-emerald-600" />
                  Authentic Veterinary Supplies
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Truck size={14} strokeWidth={1.75} className="text-[#F97316]" />
                  Uppal Hub • Quick Dispatch
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

            <div className="rounded-3xl border border-stone-200/90 bg-white p-5 sm:p-8 shadow-xl shadow-stone-200/50">
              {!clerkLoaded && !mountFallback && (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#4A0A0F] border-t-transparent mb-3" />
                  <p className="text-sm font-bold text-stone-800">
                    Connecting to Clerk Secure Sign-In...
                  </p>
                  <p className="text-xs text-stone-500 mt-1">
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
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF7ED] text-[#F97316]">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-stone-900">
                      Continue to Clerk Sign-In
                    </h2>
                    <p className="text-xs text-stone-500 mt-1">
                      Open Clerk&apos;s verified portal to sign in securely to your Sri Usha account.
                    </p>
                  </div>
                  <a
                    href={hostedSignInUrl}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#4A0A0F] py-3 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#360509] transition-all"
                  >
                    <span>Sign In with Clerk</span>
                    <ExternalLink size={15} />
                  </a>
                </div>
              )}

              {/* Clear Sign-Up Path & Back to Store */}
              <div className="mt-6 pt-5 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <p className="text-stone-500">
                  New pet parent?{" "}
                  <a
                    href={signUpHref}
                    className="font-bold text-[#F97316] hover:underline"
                  >
                    Create Free Account →
                  </a>
                </p>
                <a
                  href="/"
                  className="inline-flex items-center gap-1 font-medium text-stone-500 hover:text-stone-900 transition-colors"
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
