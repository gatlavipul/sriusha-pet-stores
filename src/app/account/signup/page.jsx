import { useState } from "react";
import useAuth from "@/utils/useAuth";
import { ArrowRight, AlertCircle, CheckCircle } from "lucide-react";

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

export default function SignUpPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const { signInWithCredentials } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setError("Please fill in all fields.");
      setLoading(false);
      return;
    }

    if (cleanName.length < 2) {
      setError("Name must be at least 2 characters long.");
      setLoading(false);
      return;
    }

    if (cleanPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    try {
      // Call dedicated Customer Signup API which strictly creates role = 'customer'
      const response = await fetch("/api/account/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      // Automatically sign in the newly registered customer
      const params = new URLSearchParams(window.location.search);
      const rawCallback = params.get("callbackUrl");
      const safeCallback = getSafeCallback(rawCallback);

      try {
        const signinRes = await signInWithCredentials({
          email: cleanEmail,
          password: cleanPassword,
          redirect: false,
        });

        if (signinRes?.error) {
          // If auto sign-in was blocked, redirect to signin page with message
          window.location.href = `/account/signin?registered=true&callbackUrl=${encodeURIComponent(safeCallback)}`;
          return;
        }

        window.location.href = safeCallback;
      } catch (authErr) {
        window.location.href = `/account/signin?registered=true&callbackUrl=${encodeURIComponent(safeCallback)}`;
      }
    } catch (err) {
      console.error("Signup submission error:", err);
      setError("Network or server error. Please try again later.");
      setLoading(false);
    }
  };

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
            Join thousands of happy pet parents in Hyderabad
          </p>
        </div>

        <form
          noValidate
          onSubmit={onSubmit}
          className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Full Name
              </label>
              <input
                required
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs sm:text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
              />
            </div>

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
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Password
              </label>
              <input
                required
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500">
            Already have an account?{" "}
            <a
              href="/account/signin"
              className="font-bold text-[#2563EB] hover:underline"
            >
              Sign In
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
