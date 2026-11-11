import * as React from 'react';
import { useSession } from "@auth/create/react";

const waitForClerkIfConfigured = async (maxWaitMs = 2500) => {
  if (typeof window === "undefined") return;

  const hasClerkScript = Boolean(
    document.querySelector('script[data-clerk-publishable-key]') ||
    window.Clerk ||
    typeof window.__initClerk === "function"
  );

  if (!hasClerkScript) return;
  if (window.Clerk?.isReady) return;

  if (window.Clerk && typeof window.__initClerk === "function") {
    try {
      await window.__initClerk();
      if (window.Clerk?.isReady) return;
    } catch {
      // continue to event wait
    }
  }

  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("clerk:ready", done);
      clearInterval(poll);
      clearTimeout(timer);
      resolve();
    };

    window.addEventListener("clerk:ready", done);

    const poll = setInterval(() => {
      if (window.Clerk?.isReady) {
        done();
      } else if (window.Clerk && typeof window.__initClerk === "function") {
        window.__initClerk().then(() => {
          if (window.Clerk?.isReady) done();
        });
      }
    }, 100);

    const timer = setTimeout(done, maxWaitMs);
  });
};

const useUser = () => {
  const { data: session, status } = useSession();
  const [user, setUser] = React.useState(session?.user ?? null);
  const [loading, setLoading] = React.useState(true);

  const fetchDbUser = React.useCallback(async () => {
    try {
      if (!session?.user) {
        await waitForClerkIfConfigured();
      }

      // First check if Clerk is loaded on window
      const clerkToken =
        typeof window !== "undefined" && window.Clerk?.session
          ? await window.Clerk.session.getToken()
          : null;

      const headers = {};
      if (clerkToken) {
        headers["Authorization"] = `Bearer ${clerkToken}`;
      }

      const res = await fetch("/api/account/me", { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          return data.user;
        }
      }
      if (session?.user) {
        setUser(session.user);
        return session.user;
      }
      setUser(null);
      return null;
    } catch (e) {
      if (session?.user) setUser(session.user);
      else setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [session]);

  React.useEffect(() => {
    fetchDbUser();

    if (typeof window === "undefined") return;

    let unsubscribe = null;
    const attachClerkListener = () => {
      if (!unsubscribe && window.Clerk && typeof window.Clerk.addListener === "function") {
        unsubscribe = window.Clerk.addListener(() => {
          fetchDbUser();
        });
      }
    };

    const handleClerkReady = () => {
      attachClerkListener();
      fetchDbUser();
    };

    window.addEventListener("clerk:ready", handleClerkReady);
    attachClerkListener();

    return () => {
      window.removeEventListener("clerk:ready", handleClerkReady);
      if (typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch {
          // noop
        }
      }
    };
  }, [fetchDbUser]);

  return {
    user: user || session?.user || null,
    data: user || session?.user || null,
    loading: loading || status === 'loading',
    refetch: fetchDbUser,
  };
};

export { useUser };
export default useUser;
