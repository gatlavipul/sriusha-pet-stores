import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@auth/create/react";
import { Shield, ExternalLink } from "lucide-react";
import { getLocalCart } from "@/utils/useCart";

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

export default function SignUpPage() {
  const { data: session, status } = useSession();
  const [clerkLoaded, setClerkLoaded] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [mountFallback, setMountFallback] = useState(false);
  const clerkMountRef = useRef(null);
  const isRedirectingRef = useRef(false);
  const isMountedWidgetRef = useRef(false);

  const hostedDomain = getClerkHostedDomain();
  const hostedSignUpUrl = hostedDomain ? `https://${hostedDomain}/sign-up` : null;

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

      // Merge guest cart if present
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

  // Mount Clerk's official Sign-Up widget directly (never show custom forms)
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

        if (window.Clerk.user && window.Clerk.session) {
          handlePostSignupRedirect();
          return true;
        }

        if (typeof window.Clerk.addListener === "function") {
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
            signInUrl: "/account/signin",
            fallbackRedirectUrl: safeCallback,
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

  if (status === "loading" || redirecting) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#FDFDFD] p-4">
        <div className="h-9 w-9 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mb-3" />
        <p className="text-xs font-semibold text-gray-600">
          {redirecting ? "Setting up your customer account..." : "Loading..."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col justify-center bg-gradient-to-b from-gray-50 to-white p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center mb-6">
          <a href="/" className="inline-flex items-center gap-2 mb-2">
            <img
              src="https://ucarecdn.com/1ba9ff02-d14c-447c-b424-734247393bdd/-/format/auto/"
              alt="Sri Usha"
              className="h-12 w-auto mx-auto"
            />
          </a>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Create Customer Account
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Join thousands of happy pet parents in Hyderabad via Clerk
          </p>
        </div>

        {/* Direct Clerk Sign-Up Widget Container */}
        <div className="flex flex-col items-center justify-center">
          {!clerkLoaded && !mountFallback && (
            <div className="w-full rounded-3xl border border-gray-200 bg-white p-8 shadow-xs flex flex-col items-center justify-center text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mb-3" />
              <p className="text-sm font-semibold text-gray-800">
                Connecting to Clerk Registration...
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Preparing your secure customer signup
              </p>
            </div>
          )}

          <div
            ref={clerkMountRef}
            id="clerk-signup-container"
            className="w-full flex justify-center"
          />

          {mountFallback && hostedSignUpUrl && (
            <div className="w-full rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]">
                <Shield size={24} />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Continue to Clerk Sign-Up
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Click below to create your customer account directly on Clerk.
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
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="text-xs text-gray-500">
            Already have an account?{" "}
            <a
              href="/account/signin"
              className="font-bold text-[#2563EB] hover:underline"
            >
              Sign In with Clerk
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
