/**
 * ReachInternational Mobile — Clipboard Security Module (Expo / React Native)
 * Enforces mobile-specific clipboard security rules:
 * 1. Automatic background clipboard polling is strictly PROHIBITED.
 * 2. Secrets (auth tokens, passwords, session tokens) must NEVER be written to system clipboard.
 * 3. Incoming clipboard content is normalized (NFKC), trimmed, stripped of null/control characters,
 *    and validated against Zod schemas before being accepted into mobile state.
 */

import { sanitizeClipboardText, validateClipboardText } from '@reachinternational/utils';

export interface MobileClipboardValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  sanitizedValue: string;
}

export interface MinimalSchema<T> {
  safeParse: (val: unknown) => { success: boolean; data?: T; error?: any };
}

/**
 * Sanitizes and validates mobile clipboard inputs against a validation schema.
 */
export function validateMobileClipboardInput<T>(
  rawText: string,
  schema: MinimalSchema<T>
): MobileClipboardValidationResult<T> {
  if (!rawText) {
    return {
      success: false,
      sanitizedValue: '',
      error: 'Clipboard content is empty.',
    };
  }

  const validation = validateClipboardText(rawText, schema as any);

  if (!validation.success) {
    if (__DEV__) {
      console.warn('[Mobile Security] Clipboard input validation failed.');
    }
    return {
      success: false,
      sanitizedValue: validation.sanitizedValue,
      error: validation.error || 'Invalid clipboard input format.',
    };
  }

  return {
    success: true,
    data: validation.data as T,
    sanitizedValue: validation.sanitizedValue,
  };
}

/**
 * Ensures that sensitive auth or session strings are never copied to mobile system clipboard.
 */
export function assertNonSensitiveCopy(value: string): void {
  const sanitized = sanitizeClipboardText(value);
  if (/^(sbp_|sb-|eyJ|sk_|pk_|secret_|service_role|pass|token)/i.test(sanitized)) {
    throw new Error('[Security Policy Violation] Copying sensitive authentication credentials or session tokens is prohibited.');
  }
}
