/**
 * Sri Usha Pet Store - Authenticated API Client Helper
 * Ensures all /api requests carry the authoritative Clerk session token
 * and implements strict request timeouts so UI never hangs infinitely.
 */

let originalFetch = null;

export async function getClerkToken(timeoutMs = 3000) {
  if (typeof window === "undefined") return null;

  // If window.Clerk has session, fetch token
  if (window.Clerk?.session?.getToken) {
    try {
      return await window.Clerk.session.getToken();
    } catch (e) {
      console.warn("[apiClient] Failed to get Clerk session token:", e);
      return null;
    }
  }

  // If Clerk is still loading, wait up to timeoutMs
  if (window.Clerk && !window.Clerk.loaded && typeof window.__initClerk === "function") {
    try {
      await Promise.race([
        window.__initClerk(),
        new Promise((r) => setTimeout(r, timeoutMs)),
      ]);
      if (window.Clerk?.session?.getToken) {
        return await window.Clerk.session.getToken();
      }
    } catch {}
  }

  return null;
}

export async function authFetch(url, options = {}) {
  const { timeout = 10000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request to ${url} timed out after ${timeout}ms`));
  }, timeout);

  try {
    const headers = new Headers(fetchOptions.headers || {});
    
    // Check if token needs to be added
    if (!headers.has("Authorization")) {
      const token = await getClerkToken(2500);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal || controller.signal,
    });

    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Patches window.fetch on the client to automatically inject Authorization header
 * for any request targeting /api routes when a Clerk session is active.
 */
export function setupGlobalAuthFetch() {
  if (typeof window === "undefined" || originalFetch) return;

  originalFetch = window.fetch;
  window.fetch = async function (input, init = {}) {
    const url = typeof input === "string" ? input : input?.url || "";

    if (typeof url === "string" && (url.startsWith("/api/") || url === "/api")) {
      try {
        let token = null;
        if (window.Clerk?.session?.getToken) {
          token = await window.Clerk.session.getToken();
        }

        if (token) {
          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : {})
          );

          if (!headers.has("Authorization")) {
            headers.set("Authorization", `Bearer ${token}`);
          }

          if (input instanceof Request) {
            return originalFetch(new Request(input, { headers }));
          }

          return originalFetch(input, { ...init, headers });
        }
      } catch (err) {
        console.warn("[GlobalAuthFetch] Error injecting token:", err);
      }
    }

    return originalFetch(input, init);
  };
}

export default authFetch;

