/**
 * Cryptographic helper to sign and verify internal user identity headers passed
 * from Edge Proxy (proxy.ts) to React Server Components (lib/dal.ts).
 *
 * Eliminates redundant outbound HTTP roundtrips to Supabase Auth on every page load
 * while preventing header forgery via HMAC-SHA256 signature verification.
 */

import { getSupabaseSecretKey } from "@/lib/env";

const enc = new TextEncoder();

export async function signInternalUser(userId: string, email: string): Promise<string> {
  const secret = getSupabaseSecretKey();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = `${userId}:${email}`;
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyInternalUser(
  userId: string,
  email: string,
  signature: string
): Promise<boolean> {
  if (!userId || !signature) return false;
  try {
    const expected = await signInternalUser(userId, email);
    if (expected.length !== signature.length) return false;

    // Constant-time timing-safe comparison to prevent timing attacks
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}
