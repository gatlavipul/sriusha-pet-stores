import { getToken } from '@auth/core/jwt';
import { getContext } from 'hono/context-storage';
import { getAuthoritativeSession } from '@/utils/clerkServer';

let currentAuthConfig = null;

export function getStoredAuthConfig() {
	return currentAuthConfig;
}

export default function CreateAuth(config) {
	currentAuthConfig = config;
	const auth = async () => {
		try {
			const c = getContext();
			if (!c || !c.req) return null;

			// 1. Check for Clerk session / JWT authentication
			const clerkSession = await getAuthoritativeSession(c.req.raw);
			if (clerkSession) {
				return clerkSession;
			}

			// 2. NextAuth / Auth.js fallback
			const reqUrl = c.req.url || '';
			const isLocal = reqUrl.includes('localhost') || reqUrl.includes('127.0.0.1');
			const isHttps = !isLocal && (process.env.AUTH_URL?.startsWith('https') ?? false);
			const token = await getToken({
				req: c.req.raw,
				secret: process.env.AUTH_SECRET,
				secureCookie: isHttps,
			});

			if (token) {
				return {
					user: {
						id: String(token.id || token.sub),
						email: token.email,
						name: token.name,
						image: token.picture,
						role: token.role || 'customer',
					},
					expires: token.exp ? token.exp.toString() : '',
				};
			}
			return null;
		} catch (error) {
			console.warn('[CreateAuth] No session found or context error:', error.message);
			return null;
		}
	};
	return {
		auth,
	};
}
