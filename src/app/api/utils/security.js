import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { getSafeReturnUrl } from "@/utils/safeRedirect";
import { getAuthoritativeSession } from "@/utils/clerkServer";

export { getSafeReturnUrl };

async function resolveSession(req) {
  try {
    const session = await auth();
    if (session?.user?.id) return session;
  } catch {}

  if (req) {
    try {
      const clerkSession = await getAuthoritativeSession(req);
      if (clerkSession?.user) return clerkSession;
    } catch {}
  }
  return null;
}

/**
 * Validates that the current request is from an authenticated admin.
 * Re-queries the database directly to prevent session tampering.
 */
export async function requireAdmin(req) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) {
      return { error: "Authentication required", status: 401 };
    }

    const userId = parseInt(session.user.id, 10);
    const rows = await sql`
      SELECT id, name, email, role, clerk_user_id 
      FROM auth_users 
      WHERE id = ${userId} 
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
 * Validates that the current request is from an authenticated delivery partner or admin.
 * Authoritatively verifies against delivery_staff and auth_users in the database.
 */
export async function requireDeliveryPartner(req) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) {
      return { error: "Authentication required", status: 401 };
    }

    const userId = parseInt(session.user.id, 10);
    const rows = await sql`
      SELECT id, name, email, role, clerk_user_id 
      FROM auth_users 
      WHERE id = ${userId} 
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return { error: "User not found", status: 404 };
    }

    const user = rows[0];

    // Admin can also access delivery portal & APIs
    if (user.role === "admin") {
      return { user, session, isAdmin: true, isDelivery: true };
    }

    // Check delivery_staff table for authoritative status
    try {
      const staffRows = await sql`
        SELECT id, email, role, status 
        FROM delivery_staff 
        WHERE LOWER(email) = LOWER(${user.email}) OR user_id = ${user.id} OR clerk_user_id = ${user.clerk_user_id}
        LIMIT 1
      `;

      if (staffRows.length > 0) {
        const staff = staffRows[0];
        if (staff.status === "disabled") {
          return { error: "Access removed, contact admin", status: 403, disabled: true };
        }
        return { user, session, staff, isDelivery: true, isAdmin: false };
      }
    } catch (err) {
      console.warn("delivery_staff lookup warning:", err);
    }

    // Fallback if role is delivery or delivery_partner in auth_users
    if (user.role === "delivery" || user.role === "delivery_partner") {
      return { user, session, isDelivery: true, isAdmin: false };
    }

    return { error: "Access denied. Delivery partner role required.", status: 403 };
  } catch (err) {
    console.error("requireDeliveryPartner error:", err);
    return { error: "Authorization error", status: 500 };
  }
}

/**
 * Validates that the current request has an authenticated session and is in allowedRoles.
 */
export async function requireRole(allowedRoles = [], req) {
  let roles = allowedRoles;
  let requestObj = req;
  if (!Array.isArray(allowedRoles) && allowedRoles && typeof allowedRoles === "object" && !req) {
    requestObj = allowedRoles;
    roles = [];
  }
  try {
    const session = await resolveSession(requestObj);
    if (!session?.user?.id) {
      return { error: "Authentication required", status: 401 };
    }

    const userId = parseInt(session.user.id, 10);
    const rows = await sql`
      SELECT id, name, email, role, clerk_user_id 
      FROM auth_users 
      WHERE id = ${userId} 
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return { error: "User not found", status: 404 };
    }

    if (Array.isArray(roles) && roles.length > 0 && !roles.includes(rows[0].role)) {
      return {
        error: `Access denied. Permitted roles: ${roles.join(", ")}`,
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
export async function requireUser(req) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) {
      return { error: "Authentication required", status: 401 };
    }

    const userId = parseInt(session.user.id, 10);
    const rows = await sql`
      SELECT id, name, email, role, clerk_user_id 
      FROM auth_users 
      WHERE id = ${userId} 
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
