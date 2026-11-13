import { handle } from 'hono/netlify';
import app from '../build/server/index.js';

export const handler = handle(app);
