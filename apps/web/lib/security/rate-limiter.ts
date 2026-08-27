import "server-only";

/**
 * ReachInternational Edge & Server Rate Limiter (LPDoS & Brute-Force Safeguard)
 * Implements a sliding-window rate limiter protecting Next.js against Low-and-Slow DoS attacks.
 */

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory sliding window store for Edge & Server evaluation
const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    record.timestamps = record.timestamps.filter((ts) => now - ts < 60000);
    if (record.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}, 300000);

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const RATE_LIMIT_PROFILES = {
  AUTH_STRICT: { windowMs: 60000, maxRequests: 10 },    // Login / Signup / Password Reset (10 req/min)
  MUTATION_API: { windowMs: 60000, maxRequests: 60 },   // Server Actions & API POSTs (60 req/min)
  GENERAL_ROUTES: { windowMs: 60000, maxRequests: 120 }, // Standard Page Navigations (120 req/min)
  AUTHENTICATED_USER: { windowMs: 60000, maxRequests: 300 }, // User Session (300 req/min)
};

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Evaluates whether a client identifier (IP or User ID) exceeds rate limits for a given profile.
 */
export function checkRateLimit(
  identifier: string,
  profile: RateLimitConfig = RATE_LIMIT_PROFILES.GENERAL_ROUTES
): RateLimitResult {
  // In development and test environments, bypass rate limiting to prevent developer friction
  if (process.env.NODE_ENV !== "production") {
    return {
      success: true,
      limit: profile.maxRequests,
      remaining: profile.maxRequests,
      resetSeconds: 0,
    };
  }

  const now = Date.now();
  const key = `${identifier}`;

  let record = rateLimitStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter timestamps outside current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < profile.windowMs);

  const requestCount = record.timestamps.length;
  const success = requestCount < profile.maxRequests;

  if (success) {
    record.timestamps.push(now);
  }

  const oldestTimestamp = record.timestamps[0] || now;
  const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + profile.windowMs - now) / 1000));
  const remaining = Math.max(0, profile.maxRequests - record.timestamps.length);

  return {
    success,
    limit: profile.maxRequests,
    remaining,
    resetSeconds,
  };
}

/**
 * Asynchronously evaluates rate limits using distributed Upstash Redis if configured
 * (via UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN), or falls back to local in-memory store.
 */
export async function checkRateLimitAsync(
  identifier: string,
  profile: RateLimitConfig = RATE_LIMIT_PROFILES.GENERAL_ROUTES
): Promise<RateLimitResult> {
  // In development and test environments, bypass rate limiting to prevent developer friction
  if (process.env.NODE_ENV !== "production") {
    return {
      success: true,
      limit: profile.maxRequests,
      remaining: profile.maxRequests,
      resetSeconds: 0,
    };
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // SECURITY (F-05): Warn if distributed rate limiter is not configured in production.
  // In-memory Map resets on serverless cold starts and is not shared across instances.
  if (!upstashUrl || !upstashToken) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[RateLimiter] CRITICAL: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured. " +
        "Rate limiting is using in-memory store which is NOT effective in serverless/multi-instance deployments. " +
        "Configure Upstash Redis for production-grade distributed rate limiting."
      );
    }
    return checkRateLimit(identifier, profile);
  }

  try {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - profile.windowMs;

    // Upstash REST Pipeline: prune expired, add current timestamp, count active, set TTL
    const response = await fetch(`${upstashUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["ZREMRANGEBYSCORE", key, 0, windowStart],
        ["ZADD", key, now, `${now}-${Math.random()}`],
        ["ZCARD", key],
        ["EXPIRE", key, Math.ceil(profile.windowMs / 1000)],
      ]),
    });

    if (response.ok) {
      const results = (await response.json()) as Array<{ result?: unknown }>;
      const count = typeof results[2]?.result === "number" ? results[2].result : 1;
      const success = count <= profile.maxRequests;
      return {
        success,
        limit: profile.maxRequests,
        remaining: Math.max(0, profile.maxRequests - count),
        resetSeconds: Math.ceil(profile.windowMs / 1000),
      };
    }
  } catch (err) {
    console.warn("[RateLimiter] Distributed Upstash check failed, using in-memory store:", err);
  }

  return checkRateLimit(identifier, profile);
}

/**
 * Utility to extract client IP address from incoming request headers securely.
 * Prioritizes canonical proxy headers (Cloudflare cf-connecting-ip, x-real-ip)
 * over client-controllable headers to prevent header-rotation rate limit bypasses.
 */
export function getClientIp(request: Request): string {
  // 1. Next.js / Vercel Edge Runtime platform IP property
  const nextReqIp = (request as { ip?: string }).ip;
  if (nextReqIp && typeof nextReqIp === "string" && nextReqIp.trim().length > 0) {
    return nextReqIp.trim();
  }

  // 2. Canonical Cloudflare header (tamper-proof behind Cloudflare)
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim().length > 0) {
    return cfConnectingIp.trim();
  }

  // 3. Nginx / Ingress X-Real-IP header
  const realIp = request.headers.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }

  // 4. True-Client-IP header (Akamai / Enterprise proxy)
  const trueClientIp = request.headers.get("true-client-ip");
  if (trueClientIp && trueClientIp.trim().length > 0) {
    return trueClientIp.trim();
  }

  // 5. X-Forwarded-For: extract rightmost valid IP to prevent leftmost client spoofing
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const rawIps = xForwardedFor.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (rawIps.length > 0) {
      // Return the rightmost entry (added by closest trusted proxy) or the single valid IP
      const selectedIp = rawIps[rawIps.length - 1] || rawIps[0];
      if (selectedIp) return selectedIp;
    }
  }

  return "127.0.0.1";
}

