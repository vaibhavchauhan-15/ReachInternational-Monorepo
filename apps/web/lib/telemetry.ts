import "server-only";
import { randomUUID } from "crypto";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface LogContext {
  requestId?: string;
  route?: string;
  action?: string;
  userId?: string;
  durationMs?: number;
  statusCode?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

const REDACTED_KEYS = new Set([
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "accesstoken",
  "refreshtoken",
]);

function sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (REDACTED_KEYS.has(k.toLowerCase())) {
      clean[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      clean[k] = sanitizeMetadata(v as Record<string, unknown>);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export function createRequestId(): string {
  return randomUUID();
}

export function logStructured(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const { metadata, ...rest } = context || {};
  const entry = {
    timestamp,
    level,
    message,
    release: process.env.NEXT_PUBLIC_APP_VERSION || "2026.08.27.01",
    environment: process.env.NODE_ENV || "development",
    ...rest,
    ...(metadata ? { metadata: sanitizeMetadata(metadata) } : {}),
  };

  const jsonStr = JSON.stringify(entry);
  if (level === "ERROR") {
    console.error(jsonStr);
  } else if (level === "WARN") {
    console.warn(jsonStr);
  } else {
    console.log(jsonStr);
  }
}

export async function withTelemetrySpan<T>(
  spanName: string,
  fn: (requestId: string) => Promise<T>,
  context?: Omit<LogContext, "durationMs" | "action">
): Promise<T> {
  const requestId = typeof context?.requestId === "string" ? context.requestId : createRequestId();
  const start = performance.now();
  try {
    const result = await fn(requestId);
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    logStructured("INFO", `${spanName} succeeded`, {
      ...context,
      action: spanName,
      requestId,
      durationMs,
    });
    return result;
  } catch (err: unknown) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    const errorMsg = err instanceof Error ? err.message : String(err);
    logStructured("ERROR", `${spanName} failed: ${errorMsg}`, {
      ...context,
      action: spanName,
      requestId,
      durationMs,
      error: errorMsg,
    });
    throw err;
  }
}
