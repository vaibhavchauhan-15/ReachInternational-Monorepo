import "server-only";
import crypto from "node:crypto";
import { getUploadSessionSecret } from "../env/server.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function getSecretKey(): string {
  try {
    return getUploadSessionSecret();
  } catch {
    return (
      process.env.UPLOAD_SESSION_SECRET ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.CRON_SECRET ||
      "reach-fallback-staging-upload-secret-2026"
    );
  }
}

/**
 * Creates a tamper-proof document staging upload session token.
 * Format: <uuid>.<expiryEpochMs>.<hmacSha256Hex>
 * 
 * @param customUuid Optional existing UUID if re-issuing for the same session
 * @param ttlMs Time-to-live in milliseconds (defaults to 2 hours)
 */
export function createUploadSessionToken(
  customUuid?: string,
  ttlMs = DEFAULT_TTL_MS
): string {
  const uuid = customUuid && UUID_REGEX.test(customUuid) ? customUuid : crypto.randomUUID();
  const expiry = Date.now() + ttlMs;
  const secret = getSecretKey();

  const dataToSign = `${uuid}.${expiry}`;
  const hmac = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");

  return `${uuid}.${expiry}.${hmac}`;
}

export type VerifySessionResult =
  | { valid: true; uuid: string; expiry: number }
  | { valid: false; error: string };

/**
 * Verifies a document staging upload session token:
 * 1. Checks structure (<uuid>.<expiryEpochMs>.<hmac>)
 * 2. Validates UUID syntax
 * 3. Checks expiry timestamp
 * 4. Verifies HMAC signature with constant-time comparison
 */
export function verifyUploadSessionToken(token: unknown): VerifySessionResult {
  if (typeof token !== "string" || !token.trim()) {
    return { valid: false, error: "Missing or invalid session token" };
  }

  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return { valid: false, error: "Malformed session token format" };
  }

  const [uuid, expiryStr, receivedHmac] = parts;

  if (!uuid || !UUID_REGEX.test(uuid)) {
    return { valid: false, error: "Invalid session identifier" };
  }

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry <= 0) {
    return { valid: false, error: "Invalid session expiration timestamp" };
  }

  if (Date.now() > expiry) {
    return { valid: false, error: "Upload session has expired. Please reselect your documents." };
  }

  const secret = getSecretKey();
  const dataToSign = `${uuid}.${expiryStr}`;
  const expectedHmac = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");

  const receivedBuf = Buffer.from(receivedHmac || "", "hex");
  const expectedBuf = Buffer.from(expectedHmac, "hex");

  if (receivedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
    return { valid: false, error: "Invalid or tampered session token signature" };
  }

  return { valid: true, uuid, expiry };
}
