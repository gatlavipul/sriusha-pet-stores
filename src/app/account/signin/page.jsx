import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@auth/create/react";
import { Shield, CheckCircle, ExternalLink } from "lucide-react";
import { getLocalCart } from "@/utils/useCart";

function resolveSafeRedirect(rawCallbackUrl, role) {
  const roleDefaults = {
    admin: "/admin",
    delivery_partner: "/delivery",
    customer: "/account",
  };
  const fallback = roleDefaults[role] || "/";

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

  // Prevent redirect loops back to auth pages
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

export default function SignInPage() {
  const { data: session, status } = useSession();
  const [infoMessage, setInfoMessage] = useState(null);
  const [clerkLoaded, setClerkLoaded] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [mountFallback, setMountFallback] = useState(false);
  const clerkMountRef = useRef(null);
  const isRedirectingRef = useRef(false);
  const isMountedWidgetRef = useRef(false);

  const hostedDomain = getClerkHostedDomain();
  const hostedSignInUrl = hostedDomain ? `https://${hostedDomain}/sign-in` : null;

  // Check for registration success notice
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("registered") === "true") {
        setInfoMessage("Your customer account was created successfully! Please sign in to continue.");
      }
    }
  }, []);

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

      // 2. Merge guest cart if items are saved in local storage
      const localItems = getLocalCart();
      if (localItems && localItems.length > 0) {
        try {
          await fetch("/api/cart/merge", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body: JSON.stringify({ items: localItems }),
          });
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
      window.location.href = "/";
    }
  }, [session?.user?.role]);

  // Redirect immediately if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      handlePostLoginRedirect();
    }
  }, [status, session, handlePostLoginRedirect]);

  // Mount Clerk's official Sign-In widget directly (never show custom forms)
  useEffect(() => {
    if (typeof window === "undefined") return;

    let unsubscribeListener = null;
    let pollTimer = null;
    let fallbackTimer = null;

    const mountClerkWidget = async () => {
      if (!window.Clerk) return false;

      try {
        if (!window.Clerk.isReady && typeof window.__initClerk === "function") {
          await window.__initClerk();
        } else if (!window.Clerk.isReady) {
          await window.Clerk.load();
        }

        if (!window.Clerk.isReady) return false;

        setClerkLoaded(true);
        setMountFallback(false);

        // If user already signed into Clerk, perform role check & redirect immediately
        if (window.Clerk.user && window.Clerk.session) {
          handlePostLoginRedirect();
          return true;
        }

        // Listen for completion of Clerk Sign-In
        if (typeof window.Clerk.addListener === "function") {
          unsubscribeListener = window.Clerk.addListener((resources) => {
            if (resources?.user && resources?.session) {
              handlePostLoginRedirect();
            }
          });
        }

        // Mount Clerk <SignIn /> component directly into container
        if (clerkMountRef.current && !isMountedWidgetRef.current) {
          isMountedWidgetRef.current = true;
          const params = new URLSearchParams(window.location.search);
          const rawCallback = params.get("callbackUrl") || "/account";

          window.Clerk.mountSignIn(clerkMountRef.current, {
            signUpUrl: "/account/signup",
            fallbackRedirectUrl: rawCallback,
            appearance: {
              elements: {
                rootBox: "mx-auto w-full",
                card: "rounded-3xl border border-gray-200 shadow-xs w-full",
              },
            },
          });
        }

        return true;
      } catch (err) {
        console.warn("[Clerk] Mount SignIn warning:", err);
        return false;
      }
    };

    const onClerkReady = () => {
      mountClerkWidget();
    };

    window.addEventListener("clerk:ready", onClerkReady);

    // Attempt immediate mount, or poll briefly while Clerk JS downloads
    mountClerkWidget().then((mounted) => {
      if (!mounted) {
        let attempts = 0;
        pollTimer = setInterval(async () => {
          attempts += 1;
          const ok = await mountClerkWidget();
          if (ok || attempts >= 50) {
            clearInterval(pollTimer);
          }
        }, 150);

        fallbackTimer = setTimeout(() => {
          if (!isMountedWidgetRef.current) {
            setMountFallback(true);
          }
        }, 5000);
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

  if (status === "loading" || redirecting) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#FDFDFD] p-4">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mb-3" />
        <p className="text-xs font-semibold text-gray-600">
          {redirecting ? "Verifying store access & redirecting..." : "Checking authentication..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col justify-center bg-gradient-to-b from-gray-50 to-white p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md">
        {/* Logo and Brand */}
        <div className="text-center mb-6">
          <a href="/" className="inline-flex items-center gap-2 mb-2">
            <img
              src="https://ucarecdn.com/1ba9ff02-d14c-447c-b424-734247393bdd/-/format/auto/"
              alt="Sri Usha"
              className="h-12 w-auto mx-auto"
            />
          </a>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Welcome to Sri Usha
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Sign in securely with Clerk to access your orders &amp; store portal
          </p>
        </div>

        {/* Info Message */}
        {infoMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 shadow-2xs">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Direct Clerk Sign-In Widget Container */}
        <div className="flex flex-col items-center justify-center">
          {!clerkLoaded && !mountFallback && (
            <div className="w-full rounded-3xl border border-gray-200 bg-white p-8 shadow-xs flex flex-col items-center justify-center text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mb-3" />
              <p className="text-sm font-semibold text-gray-800">
                Connecting to Clerk Sign-In...
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Securing your authentication session
              </p>
            </div>
          )}

          {/* Clerk mounts its official SignIn component directly here */}
          <div
            ref={clerkMountRef}
            id="clerk-signin-container"
            className="w-full flex justify-center"
          />

          {/* Hosted Clerk Fallback if third-party scripts are blocked */}
          {mountFallback && hostedSignInUrl && (
            <div className="w-full rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
                <Shield size={24} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Continue to Clerk Sign-In
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Click below to sign in directly via Clerk&apos;s secure authentication portal.
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
        </div>

        {/* Helpful footer link to Create Account or Return Home */}
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="text-xs text-gray-500">
            New to Sri Usha?{" "}
            <a
              href="/account/signup"
              className="font-bold text-[#2563EB] hover:underline"
            >
              Create Account with Clerk
            </a>
          </p>
          <a
            href="/"
            className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Back to Store Home
          </a>
        </div>
      </div>
    </div>
  );
}
