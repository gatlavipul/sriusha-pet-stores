import { useState, useEffect } from "react";
import { ShieldAlert, ArrowRight, Store, Lock } from "lucide-react";

export function useAdminAccess(callbackUrl = "/admin") {
  const [status, setStatus] = useState("checking"); // checking | unauthenticated | forbidden | authorized
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState(null);

  useEffect(() => {
    let active = true;

    async function verify() {
      try {
        const headers = {};
        if (typeof window !== "undefined" && window.Clerk?.session) {
          try {
            const token = await window.Clerk.session.getToken();
            if (token) headers["Authorization"] = `Bearer ${token}`;
          } catch {
            // fallback
          }
        }

        const res = await fetch("/api/admin/check-role", { headers });
        const data = await res.json();
        if (!active) return;

        if (!res.ok || !data?.authenticated) {
          setStatus("unauthenticated");
          if (typeof window !== "undefined") {
            window.location.href = `/account/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
          }
          return;
        }

        if (!data.isAdmin) {
          setRole(data.role || "customer");
          setEmail(data.email || null);
          setStatus("forbidden");
          return;
        }

        setRole("admin");
        setEmail(data.email || null);
        setStatus("authorized");
      } catch (err) {
        console.error("Admin verification error:", err);
        if (active) setStatus("forbidden");
      }
    }

    verify();
    return () => {
      active = false;
    };
  }, [callbackUrl]);

  return { status, role, email };
}

export function AdminAccessRestricted({ role = "customer", email = null }) {
  const isDeliveryRole = role === "delivery_partner" || role === "delivery";
  const targetPath = isDeliveryRole ? "/delivery" : "/";
  const targetLabel = isDeliveryRole ? "Go to Delivery Portal" : "Return to Home";
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (typeof window !== "undefined") {
            window.location.href = targetPath;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetPath]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-red-100 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 border border-red-100">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-700 mb-3">
          <Lock className="h-3 w-3" /> Access Restricted
        </div>

        <h1 className="text-2xl font-black text-gray-900">
          Administrator Access Only
        </h1>

        <p className="mt-2.5 text-sm text-gray-600 leading-relaxed">
          Your signed-in account
          {email ? (
            <span className="font-semibold text-gray-900"> ({email})</span>
          ) : null}{" "}
          has the{" "}
          <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-bold text-gray-800">
            {role}
          </span>{" "}
          role. Only verified Sri Usha administrators can open this workspace.
        </p>

        <div className="mt-5 rounded-xl bg-amber-50/70 border border-amber-200 px-4 py-3 text-xs font-medium text-amber-800">
          Redirecting you safely to your{" "}
          {role === "delivery_partner" ? "Delivery Portal" : "Customer Account"}{" "}
          in <span className="font-black tabular-nums">{secondsLeft}s</span>...
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <a
            href={targetPath}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0066CC] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0052A3] transition-colors"
          >
            {targetLabel}
            <ArrowRight className="h-4 w-4" />
          </a>

          <a
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Store className="h-3.5 w-3.5" />
            Back to Sri Usha Store
          </a>
        </div>
      </div>
    </div>
  );
}

export function AdminAuthChecking() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="text-center">
        <div className="h-9 w-9 mx-auto animate-spin rounded-full border-4 border-[#0066CC] border-t-transparent mb-3" />
        <p className="text-xs font-bold text-gray-500">
          Verifying administrator access...
        </p>
      </div>
    </div>
  );
}

export default function AdminAccessGuard({ callbackUrl = "/admin", children }) {
  const { status, role, email } = useAdminAccess(callbackUrl);

  if (status === "checking" || status === "unauthenticated") {
    return <AdminAuthChecking />;
  }

  if (status === "forbidden") {
    return <AdminAccessRestricted role={role} email={email} />;
  }

  return typeof children === "function"
    ? children({ role, email })
    : children;
}

