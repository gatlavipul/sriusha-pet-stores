/**
 * Sri Usha Vet & Pet Stores - Production Health Check Endpoint
 * Used by load balancers, container orchestrators, and uptime monitors.
 */
import sql from "@/app/api/utils/sql";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "unknown";
  let dbLatencyMs = 0;

  try {
    const dbPing = await sql`SELECT 1 as ping`;
    if (dbPing && dbPing[0]?.ping === 1) {
      dbStatus = "connected";
      dbLatencyMs = Date.now() - startTime;
    } else {
      dbStatus = "unexpected_response";
    }
  } catch (err) {
    dbStatus = "disconnected";
    console.error("[HealthCheck] Database connection error:", err.message);
  }

  const isHealthy = dbStatus === "connected";
  const payload = {
    status: isHealthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    },
  };

  return Response.json(payload, {
    status: isHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
