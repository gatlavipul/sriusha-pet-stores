import sql from "@/app/api/utils/sql";
import { validateEmail, sanitizeText } from "@/app/api/utils/security";
import { rateLimiter, getClientIp, RATE_LIMIT_PROFILES } from "@/utils/rateLimiter";
import bcrypt from "bcryptjs";

export async function POST(request) {
  try {
    // 0. Rate limiting check (Prevent spam account creation)
    const clientIp = getClientIp(request);
    const rateCheck = rateLimiter.check(
      `signup:${clientIp}`,
      RATE_LIMIT_PROFILES.AUTH_SIGNUP.maxRequests,
      RATE_LIMIT_PROFILES.AUTH_SIGNUP.windowMs
    );
    if (!rateCheck.allowed) {
      return Response.json(
        { error: "Too many registration attempts. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rateCheck.resetMs / 1000)) },
        }
      );
    }

    const body = await request.json();
    const { name, email, password } = body || {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return Response.json(
        { error: "Please enter your full name (at least 2 characters)." },
        { status: 400 }
      );
    }

    if (!email || !validateEmail(email)) {
      return Response.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = sanitizeText(name, 100);

    // Check if user already exists
    const existing = await sql`
      SELECT id FROM auth_users WHERE LOWER(email) = ${cleanEmail} LIMIT 1
    `;

    if (existing.length > 0) {
      return Response.json(
        { error: "An account with this email address already exists. Please sign in." },
        { status: 400 }
      );
    }

    // Role is strictly hardcoded to 'customer' on the server.
    // Client-supplied roles are completely ignored to prevent privilege escalation.
    const createdUsers = await sql`
      INSERT INTO auth_users (name, email, role, created_at)
      VALUES (${cleanName}, ${cleanEmail}, 'customer', NOW())
      RETURNING id, name, email, role
    `;

    const newUser = createdUsers[0];
    const hashedPassword = await bcrypt.hash(password, 10);

    await sql`
      INSERT INTO auth_accounts (
        "userId", provider, type, "providerAccountId", password
      )
      VALUES (
        ${newUser.id}, 'credentials', 'credentials', ${String(newUser.id)}, ${hashedPassword}
      )
    `;

    return Response.json(
      {
        success: true,
        message: "Customer account created successfully.",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: "customer",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error during customer signup:", error);
    return Response.json(
      { error: "Failed to create account. Please try again later." },
      { status: 500 }
    );
  }
}

