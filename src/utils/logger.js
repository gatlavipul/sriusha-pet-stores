/**
 * Sri Usha Vet & Pet Stores - Production Observability & Structured Logging
 * Provides structured JSON logging, redaction of sensitive credentials,
 * and error telemetry formatting.
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "razorpay_key_secret",
  "razorpay_signature",
  "authorization",
  "cookie",
  "credit_card",
  "cvv",
  "database_url",
  "databaseurl",
]);

/**
 * Deeply redacts sensitive keys from log payloads
 */
export function sanitizeLogData(data) {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  const clean = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("password") || lowerKey.includes("secret")) {
      clean[key] = "[REDACTED]";
    } else if (val && typeof val === "object") {
      clean[key] = sanitizeLogData(val);
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

class Logger {
  constructor(service = "sriusha-ecommerce") {
    this.service = service;
  }

  _output(level, event, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      service: this.service,
      level,
      event,
      message,
      data: sanitizeLogData(meta),
      env: process.env.NODE_ENV || "development",
    };

    const formatted = JSON.stringify(entry);

    if (level === "error") {
      console.error(formatted);
    } else if (level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    // Future hook: dispatch to Sentry / Datadog / OpenTelemetry if configured
    if (process.env.ERROR_MONITORING_WEBHOOK_URL && level === "error") {
      // Fire-and-forget webhook
      fetch(process.env.ERROR_MONITORING_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: formatted,
      }).catch(() => {});
    }

    return entry;
  }

  info(event, message, data = {}) {
    return this._output("info", event, message, data);
  }

  warn(event, message, data = {}) {
    return this._output("warn", event, message, data);
  }

  error(event, message, error = null, data = {}) {
    const errorMeta = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
      code: error.code,
    } : { rawError: error };

    return this._output("error", event, message, {
      ...errorMeta,
      ...data,
    });
  }
}

export const logger = new Logger("sriusha-store");
export default logger;

