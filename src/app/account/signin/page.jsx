import { useState, useEffect } from "react";
import useAuth from "@/utils/useAuth";
import { useSession } from "@auth/create/react";
import { Lock, ArrowRight } from "lucide-react";

export default function SignInPage() {
  const { data: session, status } = useSession();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { signInWithCredentials } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (status === "authenticated" && session) {
      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get("callbackUrl") || "/";
      window.location.href = callbackUrl;
    }
  }, [status, session]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#FDFDFD]">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#2563EB] border-t-transparent mb-2" />
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Please fill in both email and password.");
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams(window.location.search);
      const callbackUrl = params.get("callbackUrl") || "/";
      await signInWithCredentials({
        email: email.trim(),
        password: password.trim(),
        callbackUrl,
        redirect: true,
      });
    } catch (err) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
    }
  };


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
            Sign in to access your orders, saved addresses &amp; pet care benefits
          </p>
        </div>

        {/* Sign In Form */}
        <form
          noValidate
          onSubmit={onSubmit}
          className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs"
        >
          <div className="space-y-4">
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
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {error}
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
