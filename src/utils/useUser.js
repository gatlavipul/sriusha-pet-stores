import * as React from 'react';
import { useSession } from "@auth/create/react";

const useUser = () => {
  const { data: session, status } = useSession();
  const [user, setUser] = React.useState(session?.user ?? null);
  const [loading, setLoading] = React.useState(true);

  const fetchDbUser = React.useCallback(async () => {
    try {
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
  }, [fetchDbUser]);

  return {
    user: user || session?.user || null,
    data: user || session?.user || null,
    loading: loading && status === 'loading',
    refetch: fetchDbUser,
  };
};

export { useUser };
export default useUser;
