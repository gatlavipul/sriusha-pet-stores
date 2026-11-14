import sql from "@/app/api/utils/sql";
import { requireAdmin, sanitizeText, validatePhone } from "@/app/api/utils/security";

/**
 * GET /api/admin/delivery-staff
 * Returns all delivery staff members, their statuses, linked accounts, and delivery stats.
 */
export async function GET(request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const staff = await sql`
      SELECT 
        ds.id,
        ds.email,
        ds.name,
        ds.phone,
        ds.role,
        ds.status,
        ds.added_by,
        ds.created_at,
        ds.updated_at,
        u.id as user_id,
        u.image as user_image,
        u.clerk_user_id,
        CASE WHEN u.clerk_user_id IS NOT NULL OR ds.clerk_user_id IS NOT NULL THEN true ELSE false END as is_linked,
        COUNT(o.id) FILTER (WHERE o.status = 'delivered')::int as completed_deliveries,
        COUNT(o.id) FILTER (WHERE o.status IN ('assigned', 'out_for_delivery'))::int as pending_deliveries
      FROM delivery_staff ds
      LEFT JOIN auth_users u ON LOWER(u.email) = LOWER(ds.email) OR u.id = ds.user_id
      LEFT JOIN orders o ON o.assigned_delivery_partner_id = u.id
      GROUP BY ds.id, u.id, u.image, u.clerk_user_id
      ORDER BY ds.created_at DESC
    `;

    return Response.json({ staff: staff || [] });
  } catch (error) {
    console.error("Error fetching delivery staff:", error);
    return Response.json({ error: "Failed to fetch delivery staff" }, { status: 500 });
  }
}

/**
 * POST /api/admin/delivery-staff
 * Add a new delivery team member (email, optional name and phone).
 * Validates email, blocks duplicates, and links to auth_users immediately or via invite.
 */
export async function POST(request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json().catch(() => ({}));
    const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const cleanName = sanitizeText(body.name, 100);
    const rawPhone = body.phone ? String(body.phone).trim().replace(/\D/g, "") : null;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!rawEmail || !emailRegex.test(rawEmail)) {
      return Response.json(
        { error: "Please provide a valid email address (e.g. driver@gmail.com)." },
        { status: 400 }
      );
    }

    // Validate phone if provided
    if (rawPhone && (!validatePhone(rawPhone) || rawPhone.length !== 10)) {
      return Response.json(
        { error: "Phone number must be a valid 10-digit mobile number." },
        { status: 400 }
      );
    }

    // Block duplicate email check in delivery_staff
    const existing = await sql`
      SELECT id, email, status 
      FROM delivery_staff 
      WHERE LOWER(email) = ${rawEmail}
      LIMIT 1
    `;

    if (existing.length > 0) {
      return Response.json(
        { error: `A delivery team member with email "${rawEmail}" already exists (status: ${existing[0].status}).` },
        { status: 400 }
      );
    }

    const adminEmail = authResult.user.email || "admin@sriushastores.in";

    // Insert into delivery_staff
    const insertedStaff = await sql`
      INSERT INTO delivery_staff (
        email,
        name,
        phone,
        role,
        status,
        added_by,
        created_at,
        updated_at
      )
      VALUES (
        ${rawEmail},
        ${cleanName || null},
        ${rawPhone || null},
        'delivery',
        'active',
        ${adminEmail},
        NOW(),
        NOW()
      )
      RETURNING *
    `;

    const staffRecord = insertedStaff[0];

    // Also mirror to user_roles
    try {
      await sql`
        INSERT INTO user_roles (email, role, status, added_by, created_at, updated_at)
        VALUES (${rawEmail}, 'delivery', 'active', ${adminEmail}, NOW(), NOW())
        ON CONFLICT (email) DO UPDATE 
        SET role = 'delivery', status = 'active', updated_at = NOW()
      `;
    } catch (e) {
      console.warn("user_roles mirror warning:", e);
    }

    // If user already exists in auth_users, update their role to 'delivery' and link ID
    const existingUser = await sql`
      SELECT id, clerk_user_id, role 
      FROM auth_users 
      WHERE LOWER(email) = ${rawEmail}
      LIMIT 1
    `;

    if (existingUser.length > 0) {
      const user = existingUser[0];
      if (user.role !== "admin") {
        await sql`
          UPDATE auth_users 
          SET role = 'delivery',
              phone = COALESCE(phone, ${rawPhone || null}),
              name = COALESCE(name, ${cleanName || null})
          WHERE id = ${user.id}
        `;
      }
      await sql`
        UPDATE delivery_staff 
        SET user_id = ${user.id},
            clerk_user_id = ${user.clerk_user_id || null},
            updated_at = NOW()
        WHERE id = ${staffRecord.id}
      `;
      staffRecord.user_id = user.id;
      staffRecord.clerk_user_id = user.clerk_user_id;
    } else {
      // Provision a placeholder user in auth_users so orders can be assigned immediately
      try {
        const provisioned = await sql`
          INSERT INTO auth_users (name, email, phone, role, created_at)
          VALUES (${cleanName || rawEmail.split("@")[0]}, ${rawEmail}, ${rawPhone || null}, 'delivery', NOW())
          RETURNING id
        `;
        if (provisioned.length > 0) {
          await sql`
            UPDATE delivery_staff 
            SET user_id = ${provisioned[0].id}, updated_at = NOW()
            WHERE id = ${staffRecord.id}
          `;
          staffRecord.user_id = provisioned[0].id;
        }
      } catch (provErr) {
        console.warn("Provision placeholder user warning:", provErr);
      }
    }

    // Audit log
    try {
      await sql`
        INSERT INTO admin_audit_logs (action, admin_email, target_type, target_id, details, created_at)
        VALUES ('ADD_DELIVERY_STAFF', ${adminEmail}, 'delivery_staff', ${String(staffRecord.id)}, ${JSON.stringify({ email: rawEmail, name: cleanName })}, NOW())
      `;
    } catch {}

    return Response.json({ success: true, staff: staffRecord });
  } catch (error) {
    console.error("Error adding delivery staff:", error);
    return Response.json({ error: error.message || "Failed to add delivery staff" }, { status: 500 });
  }
}
