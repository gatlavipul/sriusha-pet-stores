import { useCallback } from 'react';
import { signIn, signOut as nextAuthSignOut } from "@auth/create/react";

function isDevIframe() {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch { return true; }
}

function devSocialShim(provider, callbackUrl) {
  const params = new URLSearchParams({ provider });
  if (callbackUrl) params.set('callbackUrl', callbackUrl);
  window.location.href = '/__create/social-dev-shim?' + params;
}

function useAuth() {
  const callbackUrl = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('callbackUrl')
    : null;

  const signInWithCredentials = useCallback(async (options) => {
    // 1. If Clerk JS is active and loaded on window, use Clerk sign in
    if (typeof window !== "undefined" && window.Clerk && window.Clerk.isReady && window.Clerk.client?.signIn) {
      try {
        const clerkRes = await window.Clerk.client.signIn.create({
          identifier: options.email,
          password: options.password,
        });

        if (clerkRes.status === "complete") {
          await window.Clerk.setActive({ session: clerkRes.createdSessionId });
          return { ok: true, status: 200 };
        }
      } catch (clerkErr) {
        console.warn("[Clerk] Direct sign-in attempt warning:", clerkErr.message);
      }
    }

    // 2. Default credentials sign in
    return signIn("credentials-signin", {
      ...options,
      callbackUrl: callbackUrl ?? options?.callbackUrl
    });
  }, [callbackUrl]);

  const signUpWithCredentials = useCallback(async (options) => {
    // 1. If Clerk JS is active, use Clerk sign up
    if (typeof window !== "undefined" && window.Clerk && window.Clerk.isReady && window.Clerk.client?.signUp) {
      try {
        const clerkSignUp = await window.Clerk.client.signUp.create({
          emailAddress: options.email,
          password: options.password,
          firstName: options.name || "Customer",
        });

        if (clerkSignUp.status === "complete") {
          await window.Clerk.setActive({ session: clerkSignUp.createdSessionId });
          return { ok: true, status: 200 };
        }
      } catch (clerkErr) {
        console.warn("[Clerk] Direct sign-up attempt warning:", clerkErr.message);
      }
    }

    // 2. Default credentials sign up
    return signIn("credentials-signup", {
      ...options,
      callbackUrl: callbackUrl ?? options?.callbackUrl
    });
  }, [callbackUrl]);

  const signOut = useCallback(async (options = {}) => {
    try {
      if (typeof window !== "undefined" && window.Clerk && typeof window.Clerk.signOut === "function") {
        await window.Clerk.signOut();
      }
    } catch (e) {
      console.warn("[Clerk] Sign out error:", e);
    }

    return nextAuthSignOut({
      callbackUrl: options.callbackUrl || "/account/signin",
      ...options,
    });
  }, []);

  const signInWithGoogle = useCallback((options) => {
    const cb = callbackUrl ?? options?.callbackUrl;
    if (isDevIframe()) return devSocialShim("google", cb);
    return signIn("google", { ...options, callbackUrl: cb });
  }, [callbackUrl]);

  const signInWithFacebook = useCallback((options) => {
    const cb = options?.callbackUrl;
    if (isDevIframe()) return devSocialShim("facebook", cb);
    return signIn("facebook", options);
  }, []);

  const signInWithTwitter = useCallback((options) => {
    const cb = options?.callbackUrl;
    if (isDevIframe()) return devSocialShim("twitter", cb);
    return signIn("twitter", options);
  }, []);

  const signInWithApple = useCallback((options) => {
    const cb = callbackUrl ?? options?.callbackUrl;
    if (isDevIframe()) return devSocialShim("apple", cb);
    return signIn("apple", { ...options, callbackUrl: cb });
  }, [callbackUrl]);

  return {
    signInWithCredentials,
    signUpWithCredentials,
    signInWithGoogle,
    signInWithFacebook,
    signInWithTwitter,
    signInWithApple,
    signOut,
  };
}

export default useAuth;
