import { useState, useEffect } from "react";
import useAuth from "@/utils/useAuth";
import { useSession } from "@auth/create/react";
import { Lock, ArrowRight, Shield, CheckCircle, AlertCircle } from "lucide-react";
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

export default function SignInPage() {
  const { data: session, status } = useSession();
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { signInWithCredentials } = useAuth();

  // Check for registration success notice
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("registered") === "true") {
        setInfoMessage("Your customer account was created successfully! Please sign in to continue.");
      }
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      handlePostLoginRedirect();
    }
  }, [status, session]);

  const handlePostLoginRedirect = async () => {
    try {
      // 1. Fetch verified role directly from server database
      const roleRes = await fetch("/api/admin/check-role");
      const roleData = await roleRes.json();
      const verifiedRole = roleData?.role || session?.user?.role || "customer";

      // 2. Merge guest cart if items are saved in local storage
      const localItems = getLocalCart();
      if (localItems && localItems.length > 0) {
        try {
          await fetch("/api/cart/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: localItems }),
          });
        } catch (e) {
          console.warn("Cart merge during signin warning:", e);
        }
      }

      // 3. Resolve safe destination URL
      const params = new URLSearchParams(window.location.search);
      const rawCallbackUrl = params.get("callbackUrl");
      const targetUrl = resolveSafeRedirect(rawCallbackUrl, verifiedRole);

      window.location.href = targetUrl;
    } catch (e) {
      console.error("Redirect resolution error:", e);
      window.location.href = "/";
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Please fill in both email and password.");
      setLoading(false);
      return;
    }

    try {
      const res = await signInWithCredentials({
        email: cleanEmail,
        password: cleanPassword,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password. Please verify your credentials and try again.");
        setLoading(false);
        return;
      }

      // On successful credentials authentication, perform cart merge and safe role routing
      await handlePostLoginRedirect();
    } catch (err) {
      console.error("Sign in error:", err);
      setError("Invalid email or password. Please check your credentials and try again.");
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FDFDFD]">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mb-2" />
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
            Sign in to access your orders, account details &amp; store portal
          </p>
        </div>

        {/* Info Message (e.g. Registered) */}
        {infoMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 shadow-2xs">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form
          noValidate
          onSubmit={onSubmit}
          className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs"
        >
          <div className="space-y-4">
            {typeof window !== "undefined" && window.Clerk && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (window.Clerk?.openSignIn) {
                      window.Clerk.openSignIn({
                        afterSignInUrl: "/account",
                      });
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-xs sm:text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition-all mb-4"
                >
                  <Shield size={15} className="text-[#2563EB]" />
                  <span>Sign In with Clerk SSO</span>
                </button>
                <div className="flex items-center gap-3 my-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[11px] font-medium text-gray-400">OR USE CREDENTIALS</span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Email Address
              </label>
              <input
                required
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-700">
                  Password
                </label>
              </div>
              <input
                required
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                <AlertCircle size={15} className="shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] py-3 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#1D4ED8] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500">
            Don&apos;t have an account?{" "}
            <a
              href="/account/signup"
              className="font-bold text-[#2563EB] hover:underline"
            >
              Create Account
            </a>
          </div>
        </form>

        <div className="mt-6 text-center">
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
