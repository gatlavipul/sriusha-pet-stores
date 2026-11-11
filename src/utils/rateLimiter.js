/**
 * Sri Usha Vet & Pet Stores - Production In-Memory Rate Limiter
 * Implements sliding-window rate limiting for auth endpoints, checkout, and sensitive APIs.
 */

class SlidingWindowRateLimiter {
  constructor() {
    this.hits = new Map();
    // Prune stale records every 5 minutes to prevent memory leak
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.prune(), 5 * 60 * 1000).unref();
    }
  }

  prune() {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((t) => now - t < 60 * 60 * 1000);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  check(key, maxRequests = 10, windowMs = 60 * 1000) {
    const now = Date.now();
    const timestamps = this.hits.get(key) || [];
    const windowStart = now - windowMs;

    const activeTimestamps = timestamps.filter((t) => t > windowStart);

    if (activeTimestamps.length >= maxRequests) {
      const oldestActive = activeTimestamps[0];
      const resetMs = oldestActive + windowMs - now;
      return {
        allowed: false,
        count: activeTimestamps.length,
        max: maxRequests,
        resetMs: Math.max(1000, resetMs),
        remaining: 0,
      };
    }

    activeTimestamps.push(now);
    this.hits.set(key, activeTimestamps);

    return {
      allowed: true,
      count: activeTimestamps.length,
      max: maxRequests,
      resetMs: windowMs,
      remaining: maxRequests - activeTimestamps.length,
    };
  }

  reset(key) {
    this.hits.delete(key);
  }
}

export const rateLimiter = new SlidingWindowRateLimiter();

export function getClientIp(request) {
  if (!request) return "127.0.0.1";
  const headers = request.headers;
  if (!headers) return "127.0.0.1";

  const xForwardedFor = headers.get ? headers.get("x-forwarded-for") : headers["x-forwarded-for"];
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }

  const xRealIp = headers.get ? headers.get("x-real-ip") : headers["x-real-ip"];
  if (xRealIp) {
    return xRealIp.trim();
  }

  return "127.0.0.1";
}

export const RATE_LIMIT_PROFILES = {
  // Login / Auth attempts: 5 per 15 minutes per IP/identifier
  AUTH_SIGNIN: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  // Account signups: 5 per 60 minutes per IP
  AUTH_SIGNUP: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  // Order placements: 10 per 10 minutes per IP
  CHECKOUT: { maxRequests: 10, windowMs: 10 * 60 * 1000 },
  // General API: 120 per minute
  API_GENERAL: { maxRequests: 120, windowMs: 60 * 1000 },
};

export default rateLimiter;

