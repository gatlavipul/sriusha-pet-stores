/**
 * Validates that a redirect URL is safe to navigate to (prevents open-redirect attacks).
 * Must be a relative path, must not be protocol-relative (//), must not contain scheme (:),
 * and respects role boundaries.
 */
export function getSafeReturnUrl(rawUrl, role = "customer") {
  const defaultByRole = {
    admin: "/admin",
    delivery_partner: "/delivery",
    customer: "/account",
  };
  const fallback = defaultByRole[role] || "/";

  if (!rawUrl || typeof rawUrl !== "string") {
    return fallback;
  }

  const trimmed = rawUrl.trim();

  // Validate internal path safety
  // 1. Must start with '/'
  // 2. Must not start with '//' (protocol-relative)
  // 3. Must not contain backslashes '\'
  // 4. Must not contain ':' to prevent schemes like javascript:, data:, https:
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes(":")
  ) {
    return fallback;
  }

  // Prevent redirect loops back to auth pages
  if (
    trimmed.startsWith("/account/signin") ||
    trimmed.startsWith("/account/signup") ||
    trimmed.startsWith("/account/logout") ||
    trimmed === "/"
  ) {
    return fallback;
  }

  // Role-boundary check for returnUrl
  if (trimmed.startsWith("/admin") && role !== "admin") {
    return fallback;
  }
  if (trimmed.startsWith("/delivery") && role !== "delivery_partner") {
    return fallback;
  }

  return trimmed;
}
