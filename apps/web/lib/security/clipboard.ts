"use client";

/**
 * ReachInternational Web — Clipboard Security Module (Next.js 16)
 * Enforces browser security rules for clipboard access:
 * 1. Automatic clipboard reads are strictly PROHIBITED (no useEffect reads on mount/polling).
 * 2. Clipboard reads occur ONLY via explicit user activation (direct button click or input paste event).
 * 3. All incoming clipboard text is normalized (NFKC), trimmed, stripped of control/null characters,
 *    and validated against Zod schemas before updating form state.
 * 4. Clipboard contents are NEVER logged to console or sent to external loggers.
 */

import React from "react";
import { sanitizeClipboardText, validateClipboardText } from "@reachinternational/utils";

/**
 * Reads text from browser clipboard as the direct result of an explicit user action.
 * Modern browsers enforce secure context (HTTPS/localhost) and user gesture requirements.
 */
export async function readTextFromClipboard(): Promise<{ success: boolean; text?: string; error?: string }> {
  if (typeof window === "undefined" || !navigator.clipboard) {
    return {
      success: false,
      error: "Clipboard API is not supported in this browser environment.",
    };
  }

  try {
    const rawText = await navigator.clipboard.readText();
    const cleanText = sanitizeClipboardText(rawText);
    return {
      success: true,
      text: cleanText,
    };
  } catch (err: any) {
    // Gracefully capture permission denied / user dismissal without unhandled exceptions
    return {
      success: false,
      error: err?.message || "Clipboard access denied by browser policy.",
    };
  }
}

export interface MinimalSchema<T> {
  safeParse: (val: unknown) => { success: boolean; data?: T; error?: any };
}

export interface HandlePasteOptions<T> {
  event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>;
  schema: MinimalSchema<T> | any;
  onSuccess: (value: T) => void;
  onError?: (errorMessage: string) => void;
}

/**
 * Helper to intercept paste events (`onPaste`) on input components.
 * Extract plain text, sanitizes NFKC / null bytes, validates against Zod schema,
 * and calls onSuccess if valid or prevents default and calls onError if invalid.
 */
export function handleClipboardPaste<T>({
  event,
  schema,
  onSuccess,
  onError,
}: HandlePasteOptions<T>): void {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return;

  const rawText = clipboardData.getData("text");
  if (!rawText) return;

  const validation = validateClipboardText(rawText, schema as any);

  if (!validation.success) {
    event.preventDefault();
    const msg = validation.error || "Pasted clipboard content failed security validation.";
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Security] Clipboard paste validation failed.");
    }
    if (onError) {
      onError(msg);
    }
    return;
  }

  // Valid clipboard text parsed cleanly
  event.preventDefault();
  if (validation.data !== undefined) {
    onSuccess(validation.data as T);
  }
}
