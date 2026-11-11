import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { getSafeReturnUrl } from "@/utils/safeRedirect";

export { getSafeReturnUrl };

/**
 * Validates that the current request is from an authenticated admin.
 * Re-queries the database directly to prevent session tampering.
 */
export async function requireAdmin() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Authentication required", status: 401 };
    }

    const rows = await sql`
      SELECT id, name, email, role 
      FROM auth_users 
      WHERE id = ${session.user.id} 
      LIMIT 1
    `;

    if (!rows || rows.length === 0 || rows[0].role !== "admin") {
      return { error: "Access denied. Administrator privileges required.", status: 403 };
    }

    return { user: rows[0], session };
  } catch (err) {
    console.error("requireAdmin error:", err);
    return { error: "Authorization error", status: 500 };
  }
}

/**
 * Validates that the current request is from an authenticated delivery partner.
 */
export async function requireDeliveryPartner() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Authentication required", status: 401 };
    }

    const rows = await sql`
      SELECT id, name, email, role 
      FROM auth_users 
      WHERE id = ${session.user.id} 
      LIMIT 1
    `;

    if (!rows || rows.length === 0 || rows[0].role !== "delivery_partner") {
      return { error: "Access denied. Delivery partner privileges required.", status: 403 };
    }

    return { user: rows[0], session };
  } catch (err) {
    console.error("requireDeliveryPartner error:", err);
    return { error: "Authorization error", status: 500 };
  }
}

/**
 * Validates that the current request has an authenticated session and is in allowedRoles.
 */
export async function requireRole(allowedRoles = []) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Authentication required", status: 401 };
    }

    const rows = await sql`
      SELECT id, name, email, role 
      FROM auth_users 
      WHERE id = ${session.user.id} 
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return { error: "User not found", status: 404 };
    }

    if (!allowedRoles.includes(rows[0].role)) {
      return {
        error: `Access denied. Permitted roles: ${allowedRoles.join(", ")}`,
        status: 403,
      };
    }

    return { user: rows[0], session };
  } catch (err) {
    console.error("requireRole error:", err);
    return { error: "Authorization error", status: 500 };
  }
}

/**
 * Validates that the current request has an authenticated session.
 */
export async function requireUser() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Authentication required", status: 401 };
    }

    const rows = await sql`
      SELECT id, name, email, role 
      FROM auth_users 
      WHERE id = ${session.user.id} 
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return { error: "User not found", status: 404 };
    }

    return { user: rows[0], session };
  } catch (err) {
    console.error("requireUser error:", err);
    return { error: "Authorization error", status: 500 };
  }
}

/**
 * Server-side input validation helpers
 */
export function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function validatePhone(phone) {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/[\s\-\+]/g, "");
  return cleaned.length >= 10 && cleaned.length <= 13 && /^\d+$/.test(cleaned);
}

export function sanitizeText(text, maxLength = 1000) {
  if (!text) return "";
  return String(text).trim().slice(0, maxLength);
}
