/**
 * Anythings auth configuration with unified role-based authentication.
 * Roles: customer, admin, delivery_partner
 */
import CreateAuth from "@auth/create";
import Credentials from "@auth/core/providers/credentials";
import { CredentialsSignin } from "@auth/core/errors";
import sql from "@/app/api/utils/sql";
import { rateLimiter } from "@/utils/rateLimiter";
import bcrypt from "bcryptjs";

function Adapter(client) {
  return {
    async createVerificationToken(verificationToken) {
      const { identifier, expires, token } = verificationToken;
      const sql = `
        INSERT INTO auth_verification_token ( identifier, expires, token )
        VALUES ($1, $2, $3)
      `;
      await client.query(sql, [identifier, expires, token]);
      return verificationToken;
    },
    async useVerificationToken({ identifier, token }) {
      const sql = `
        DELETE FROM auth_verification_token
        WHERE identifier = $1 AND token = $2
        RETURNING identifier, expires, token
      `;
      const result = await client.query(sql, [identifier, token]);
      return result.rowCount !== 0 ? result.rows[0] : null;
    },

    async createUser(user) {
      const { name, email, emailVerified, image, role } = user;
      const sql = `
        INSERT INTO auth_users (name, email, "emailVerified", image, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, "emailVerified", image, role
      `;
      const result = await client.query(sql, [
        name,
        email ? email.toLowerCase().trim() : null,
        emailVerified,
        image,
        role || "customer",
      ]);
      return result.rows[0];
    },
    async getUser(id) {
      const sql = "SELECT * FROM auth_users WHERE id = $1";
      try {
        const result = await client.query(sql, [id]);
        return result.rowCount === 0 ? null : result.rows[0];
      } catch {
        return null;
      }
    },
    async getUserByEmail(email) {
      if (!email) return null;
      const sql = "SELECT * FROM auth_users WHERE LOWER(email) = LOWER($1)";
      const result = await client.query(sql, [email.trim()]);
      if (result.rowCount === 0) {
        return null;
      }
      const userData = result.rows[0];
      const accountsData = await client.query(
        'SELECT * FROM auth_accounts WHERE "userId" = $1',
        [userData.id]
      );
      return {
        ...userData,
        accounts: accountsData.rows,
      };
    },
    async getUserByAccount({ providerAccountId, provider }) {
      const sql = `
        SELECT u.* FROM auth_users u 
        JOIN auth_accounts a ON u.id = a."userId"
        WHERE a.provider = $1 AND a."providerAccountId" = $2
      `;
      const result = await client.query(sql, [provider, providerAccountId]);
      return result.rowCount !== 0 ? result.rows[0] : null;
    },
    async updateUser(user) {
      const fetchSql = "SELECT * FROM auth_users WHERE id = $1";
      const query1 = await client.query(fetchSql, [user.id]);
      const oldUser = query1.rows[0];

      const newUser = {
        ...oldUser,
        ...user,
      };

      const { id, name, email, emailVerified, image, role } = newUser;
      const updateSql = `
        UPDATE auth_users SET
        name = $2, email = $3, "emailVerified" = $4, image = $5, role = $6
        WHERE id = $1
        RETURNING name, id, email, "emailVerified", image, role
      `;
      const query2 = await client.query(updateSql, [
        id,
        name,
        email ? email.toLowerCase().trim() : null,
        emailVerified,
        image,
        role || oldUser.role || "customer",
      ]);
      return query2.rows[0];
    },
    async linkAccount(account) {
      const sql = `
        INSERT INTO auth_accounts
        (
          "userId", provider, type, "providerAccountId",
          access_token, expires_at, refresh_token, id_token,
          scope, session_state, token_type, password
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const params = [
        account.userId,
        account.provider,
        account.type,
        account.providerAccountId,
        account.access_token,
        account.expires_at,
        account.refresh_token,
        account.id_token,
        account.scope,
        account.session_state,
        account.token_type,
        account.extraData?.password,
      ];

      const result = await client.query(sql, params);
      return result.rows[0];
    },
    async createSession({ sessionToken, userId, expires }) {
      if (userId === undefined) {
        throw Error("userId is undef in createSession");
      }
      const sql = `
        INSERT INTO auth_sessions ("userId", expires, "sessionToken")
        VALUES ($1, $2, $3)
        RETURNING id, "sessionToken", "userId", expires
      `;
      const result = await client.query(sql, [userId, expires, sessionToken]);
      return result.rows[0];
    },
    async getSessionAndUser(sessionToken) {
      if (sessionToken === undefined) return null;
      const result1 = await client.query(
        'SELECT * FROM auth_sessions WHERE "sessionToken" = $1',
        [sessionToken]
      );
      if (result1.rowCount === 0) return null;
      const session = result1.rows[0];

      const result2 = await client.query(
        "SELECT * FROM auth_users WHERE id = $1",
        [session.userId]
      );
      if (result2.rowCount === 0) return null;
      const user = result2.rows[0];
      return { session, user };
    },
    async updateSession(session) {
      const { sessionToken } = session;
      const result1 = await client.query(
        'SELECT * FROM auth_sessions WHERE "sessionToken" = $1',
        [sessionToken]
      );
      if (result1.rowCount === 0) return null;
      const originalSession = result1.rows[0];

      const newSession = {
        ...originalSession,
        ...session,
      };
      const sql = `
        UPDATE auth_sessions SET expires = $2
        WHERE "sessionToken" = $1
        RETURNING *
      `;
      const result = await client.query(sql, [
        newSession.sessionToken,
        newSession.expires,
      ]);
      return result.rows[0];
    },
    async deleteSession(sessionToken) {
      const sql = 'DELETE FROM auth_sessions WHERE "sessionToken" = $1';
      await client.query(sql, [sessionToken]);
    },
    async unlinkAccount(partialAccount) {
      const { provider, providerAccountId } = partialAccount;
      const sql = 'DELETE FROM auth_accounts WHERE "providerAccountId" = $1 AND provider = $2';
      await client.query(sql, [providerAccountId, provider]);
    },
    async deleteUser(userId) {
      await client.query("DELETE FROM auth_users WHERE id = $1", [userId]);
      await client.query('DELETE FROM auth_sessions WHERE "userId" = $1', [userId]);
      await client.query('DELETE FROM auth_accounts WHERE "userId" = $1', [userId]);
    },
  };
}

const mockClient = {
  query: async (queryText, params) => {
    const rows = await sql(queryText, params || []);
    return { rows, rowCount: rows ? rows.length : 0 };
  },
};

const adapter = Adapter(mockClient);

export const { auth } = CreateAuth({
  providers: [
    Credentials({
      id: "credentials-signin",
      name: "Credentials Sign in",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const { email, password } = credentials || {};
        if (!email || !password) return null;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const cleanEmail = email.toLowerCase().trim();

        // Brute-force protection: check rate limit for this email
        const rateCheck = rateLimiter.check(`signin:${cleanEmail}`, 10, 15 * 60 * 1000);
        if (!rateCheck.allowed) {
          const error = new CredentialsSignin();
          error.code = "too-many-attempts";
          throw error;
        }

        const user = await adapter.getUserByEmail(cleanEmail);
        if (!user) {
          const error = new CredentialsSignin();
          error.code = "no-account";
          throw error;
        }

        const matchingAccount = user.accounts?.find(
          (account) => account.provider === "credentials"
        );
        const accountPassword = matchingAccount?.password;
        if (!accountPassword) {
          throw new CredentialsSignin();
        }

        const isValid = await bcrypt.compare(password, accountPassword);
        if (!isValid) {
          throw new CredentialsSignin();
        }

        // Reset rate limiter on successful authentication
        rateLimiter.reset(`signin:${cleanEmail}`);

        // Return user profile including verified database role
        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role || "customer",
        };
      },
    }),
    Credentials({
      id: "credentials-signup",
      name: "Credentials Sign up",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text", required: false },
        image: { label: "Image", type: "text", required: false },
      },
      authorize: async (credentials) => {
        const { email, password } = credentials || {};
        if (!email || !password) return null;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const cleanEmail = email.toLowerCase().trim();
        const existingUser = await adapter.getUserByEmail(cleanEmail);
        if (existingUser) {
          const error = new CredentialsSignin();
          error.code = "email-exists";
          throw error;
        }

        // Public signup strictly creates role = 'customer'
        const newUser = await adapter.createUser({
          emailVerified: null,
          email: cleanEmail,
          name:
            typeof credentials.name === "string" && credentials.name.trim().length > 0
              ? credentials.name.trim()
              : "Customer",
          image:
            typeof credentials.image === "string"
              ? credentials.image
              : undefined,
          role: "customer",
        });

        await adapter.linkAccount({
          extraData: {
            password: await bcrypt.hash(password, 10),
          },
          type: "credentials",
          userId: newUser.id,
          providerAccountId: String(newUser.id),
          provider: "credentials",
        });

        return {
          id: String(newUser.id),
          name: newUser.name,
          email: newUser.email,
          image: newUser.image,
          role: "customer",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role || "customer";
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id || token.sub;
        session.user.role = token.role || "customer";
      }
      return session;
    },
  },
  pages: {
    signIn: "/account/signin",
    signOut: "/account/logout",
  },
});
