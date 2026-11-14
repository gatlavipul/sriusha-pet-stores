import { useState, useEffect } from "react";
import { SignUp, useUser } from "@clerk/clerk-react";
import { AlertCircle, PawPrint, ShieldCheck } from "lucide-react";

function getClerkPublishableKey() {
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

export default function SignUpPage() {
  const { isLoaded, isSignedIn } = useUser();
  const publishableKey = getClerkPublishableKey();

  // If already signed in, go straight to home
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    }
  }, [isLoaded, isSignedIn]);

  return (
    <div className="min-h-screen w-full bg-[#FAF7F2] text-[#241819] flex flex-col items-center justify-center px-4 py-8 select-none">
      {/* Background warm aesthetic glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-24 -right-24 h-96 w-96 rounded-full bg-orange-100/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-24 -left-24 h-96 w-96 rounded-full bg-amber-100/50 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-[340px] sm:max-w-md mx-auto flex flex-col items-center">
        {/* Brand Logo & Title */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-2xl bg-white shadow-md border border-[#EADBCC] flex items-center justify-center p-2 mb-3">
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
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#4A0A0F]">
            Create Your Account
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-stone-600 max-w-xs">
            Join Sri Usha Pet Store to save your pet&apos;s prescriptions, track deliveries, and reorder favorites.
          </p>
        </div>

        {/* Missing Publishable Key Warning */}
        {!publishableKey ? (
          <div className="w-full rounded-2xl border border-red-200 bg-white p-6 shadow-md text-center">
            <AlertCircle size={32} className="mx-auto text-red-600 mb-2" />
            <h2 className="text-base font-extrabold text-[#4A0A0F]">
              Missing Clerk Publishable Key
            </h2>
            <p className="mt-1 text-xs text-stone-600">
              Please configure <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> in your Netlify site settings.
            </p>
          </div>
        ) : (
          /* Clerk SignUp Widget */
          <div className="w-full flex justify-center">
            <SignUp
              routing="hash"
              fallbackRedirectUrl="/"
              signInUrl="/account/signin"
              appearance={{
                elements: {
                  rootBox: "w-full max-w-md",
                  card: "rounded-2xl border border-[#EADBCC] bg-white shadow-lg p-6",
                  headerTitle: "text-lg font-black text-[#4A0A0F]",
                  headerSubtitle: "text-xs text-stone-500",
                  socialButtonsBlockButton:
                    "rounded-xl border border-stone-300 hover:border-[#F97316] font-bold text-xs min-h-[44px]",
                  formButtonPrimary:
                    "rounded-xl bg-[#4A0A0F] hover:bg-[#360509] text-white font-bold text-xs min-h-[44px]",
                  formFieldInput:
                    "rounded-xl border border-stone-300 text-xs min-h-[42px] focus:border-[#F97316]",
                  footerActionLink: "text-[#F97316] hover:text-[#EA580C] font-bold text-xs",
                },
              }}
            />
          </div>
        )}

        {/* Trust Badges */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] font-bold text-stone-500">
          <span className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>100% Genuine Pet Care</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <PawPrint size={14} className="text-[#F97316]" />
            <span>Trusted Vet Pharmacy</span>
          </span>
        </div>
      </div>
    </div>
  );
}
