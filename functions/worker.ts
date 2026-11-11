/**
 * Sri Usha Vet & Pet Stores — Cloudflare Workers Main Entrypoint
 * Bridges incoming Cloudflare Workers requests directly to the Hono application.
 */
import { app } from '../__create/index';

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // Inject Cloudflare Worker environment variables into process.env for nodejs_compat
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        if (typeof value === 'string' && typeof process !== 'undefined' && process.env) {
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }

    return app.fetch(request, env, ctx);
  },
};
