import { getRequestListener } from "@hono/node-server";
import serverAppPromise from "../build/server/index.js";

// Await the server app initialized with React Router SSR and all API routes
const app = await serverAppPromise;
const listener = getRequestListener(app.fetch);

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

export default function handler(req, res) {
  return listener(req, res);
}
