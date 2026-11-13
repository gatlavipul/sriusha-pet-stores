import { handle } from "hono/vercel";
import app from "../build/server/index.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

export default handle(app);

