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

// Minimal middleware
app.use('*', async (c, next) => {
  console.log(`[Request] ${c.req.method} ${c.req.url}`);
  await next();
});

// Routes
app.route(API_BASENAME, api);

export default createHonoServer({ app });
