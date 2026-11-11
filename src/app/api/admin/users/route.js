import sql from "@/app/api/utils/sql";
import { requireAdmin, validateEmail, sanitizeText } from "@/app/api/utils/security";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const users = await sql`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.created_at,
        COUNT(o.id)::int as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_spent,
        (SELECT customer_phone FROM orders WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as phone,
        (SELECT shipping_address || ', ' || shipping_city || ' - ' || shipping_pincode FROM orders WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1) as address
      FROM auth_users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;

    return Response.json({ users });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return Response.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || !password || !role) {
      return Response.json(
        { error: "Email, password, and role are required" },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return Response.json({ error: "Invalid email address format" }, { status: 400 });
    }

    if (password.length < 6) {
      return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRole = role === "admin" ? "admin" : "customer";

    // Check if user already exists
    const existing = await sql`SELECT id FROM auth_users WHERE email = ${cleanEmail} LIMIT 1`;
    if (existing.length > 0) {
      return Response.json(
        { error: "A user with this email address already exists" },
        { status: 400 }
      );
    }

    // Create new user
    const newUsers = await sql`
      INSERT INTO auth_users (email, name, role, "emailVerified")
      VALUES (${cleanEmail}, ${name ? sanitizeText(name, 100) : null}, ${cleanRole}, NULL)
      RETURNING id, email, name, role
    `;

    const newUser = newUsers[0];

    // Create credentials account
    const hashedPassword = await bcrypt.hash(password, 10);
    await sql`
      INSERT INTO auth_accounts (
        "userId", provider, type, "providerAccountId", password
      )
      VALUES (
        ${newUser.id}, 'credentials', 'credentials', ${newUser.id}, ${hashedPassword}
      )
    `;

    return Response.json({ user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}
