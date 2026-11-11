import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { authHandler, initAuthConfig } from '@hono/auth-js';
import { createHonoServer } from 'react-router-hono-server/node';
import { api, API_BASENAME } from './route-builder';
import { getStoredAuthConfig } from '../src/__create/@auth/create';
import '../src/auth';

const app = new Hono();

// Enable async context storage so getContext() works in route handlers
app.use(contextStorage());

// Mount NextAuth/Auth.js routes at /api/auth/*
app.use('/api/auth/*', initAuthConfig((c) => {
  const cfg = getStoredAuthConfig() || {};
  return {
    ...cfg,
    basePath: '/api/auth',
    secret: process.env.AUTH_SECRET,
  };
}));
app.use('/api/auth/*', authHandler());

// Security Headers & Request Auditing Middleware
app.use('*', async (c, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Request] ${c.req.method} ${c.req.url}`);
  }

  await next();

  // Standard Security Headers
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    c.res.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content-Security-Policy tailored for Sri Usha storefront, Clerk, Razorpay, and R2
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://*.clerk.accounts.dev https://*.clerk.com https://kit.fontawesome.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://ka-f.fontawesome.com",
    "font-src 'self' https://fonts.gstatic.com https://ka-f.fontawesome.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com https://*.clerk.accounts.dev https://api.clerk.com https://api.resend.com https://*.r2.cloudflarestorage.com https://ka-f.fontawesome.com https:",
    "frame-src 'self' https://api.razorpay.com https://*.clerk.accounts.dev https://*.clerk.com",
  ].join('; ');

  c.res.headers.set('Content-Security-Policy', csp);
});

// Routes
app.route(API_BASENAME, api);

export { app };
export default createHonoServer({ app });
