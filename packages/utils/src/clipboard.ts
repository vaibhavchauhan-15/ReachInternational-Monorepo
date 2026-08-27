/**
 * ServiceCentric Shared Utilities — Clipboard Security Helpers
 * Platform-independent string sanitization, NFKC normalization, control character stripping,
 * and Zod validation helpers for untrusted clipboard text inputs.
 */

import { type z } from "zod";

/**
 * Sanitizes untrusted clipboard input strings.
 * - Normalizes Unicode to NFKC form (normalizes fullwidth/compat characters)
 * - Trims leading and trailing whitespace
 * - Strips null bytes (\u0000) and dangerous ASCII control characters (\x00-\x08, \x0B-\x0C, \x0E-\x1F, \x7F)
 */
export function sanitizeClipboardText(value: string): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .trim()
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, "");
}

export interface ValidateClipboardResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  sanitizedValue: string;
}

/**
 * Sanitizes an untrusted clipboard text string and validates it against a given Zod schema.
 */
export function validateClipboardText<T>(
  value: string,
  schema: z.ZodType<T>
): ValidateClipboardResult<T> {
  const sanitizedValue = sanitizeClipboardText(value);
  const result = schema.safeParse(sanitizedValue);

  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      sanitizedValue,
      error: issue ? issue.message : "Invalid clipboard format",
    };
  }

  return {
    success: true,
    data: result.data,
    sanitizedValue,
  };
}

/**
 * Helper to safely copy plain text to clipboard.
 * Checks if value is present and not a secret pattern before returning plain text.
 */
export function copySafeText(value: string): string {
  const sanitized = sanitizeClipboardText(value);
  // Guard against accidental key or token copying
  if (
    /^(sbp_|sb-|eyJ|sk_|pk_|secret_|service_role)/i.test(sanitized)
  ) {
    throw new Error("Security Violation: Copying system authentication tokens or secret keys is strictly prohibited.");
  }
  return sanitized;
}
