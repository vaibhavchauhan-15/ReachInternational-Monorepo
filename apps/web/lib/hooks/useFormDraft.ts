"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h draft lifetime
const DEBOUNCE_MS = 300; // 300ms optimal debounce for typing

/**
 * Picks only the allowed keys from an object.
 * Exported for testing.
 */
export function pick<T extends object>(obj: unknown, allow: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  if (obj && typeof obj === "object") {
    for (const k of allow) {
      if (k in obj) {
        out[k] = (obj as Record<string, unknown>)[k];
      }
    }
  }
  return out as Partial<T>;
}

/**
 * Determines whether the draft data has any meaningful user-entered content,
 * rather than only empty strings, nulls, or initial form defaults like 'operator'.
 */
export function hasMeaningfulData(d: object | null | undefined): boolean {
  if (!d || typeof d !== "object") return false;
  for (const [key, val] of Object.entries(d)) {
    if (val === "" || val === null || val === undefined) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    // Disregard pure static form default values if nothing else was entered
    if (key === "role" && val === "operator") continue;
    if (key === "shift_start_time" && (val === "08:00 AM" || val === "08:00")) continue;
    if (key === "shift_end_time" && (val === "08:00 PM" || val === "20:00")) continue;
    if (key === "selectedRole" && val === "operator") continue;
    if (key === "shiftStartTime" && (val === "08:00 AM" || val === "08:00")) continue;
    if (key === "shiftEndTime" && (val === "08:00 PM" || val === "20:00")) continue;
    if (key === "agreed_to_terms" && val === false) continue;
    if (key === "agreedToTerms" && val === false) continue;
    return true;
  }
  return false;
}

/** Legacy alias for backward compatibility */
export const hasValue = hasMeaningfulData;

/**
 * Read and validate a draft from localStorage.
 * Returns null if missing, expired, corrupt, or empty.
 * Exported for testing.
 */
export function readDraft<T extends object>(key: string, allow: readonly string[], now = Date.now()) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (typeof savedAt !== "number" || now - savedAt > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    const picked = pick<T>(data, allow);
    return hasMeaningfulData(picked) ? { savedAt, data: picked } : null;
  } catch {
    return null; // corrupt JSON or storage blocked: start blank
  }
}

/**
 * Persists a subset of form values in localStorage so the user can recover
 * them after a page close, reload, or network failure.
 *
 * Guarantees zero data loss on page refresh (F5 / reload) by listening to beforeunload,
 * and prevents race conditions where uninitialized/empty state overwrites valid drafts.
 *
 * @param key     localStorage key (e.g. "signup_draft_v1")
 * @param allow   Allowlist of field names to persist (never include passwords/secrets)
 * @param values  Current form state object
 * @param restore Callback that merges restored draft into form state
 *
 * @returns { restoredAt, clear, saveNow }
 *   - restoredAt: timestamp of the restored draft (null if none)
 *   - clear(): call on successful submit or "Start fresh" to delete the draft
 *   - saveNow(): immediately flushes current values to localStorage
 */
export function useFormDraft<T extends object>(
  key: string,
  allow: readonly string[],
  values: T,
  restore: (draft: Partial<T>) => void,
) {
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const latestRef = useRef<T>(values);
  const hasHydratedRef = useRef(false);
  const isDirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latestRef synchronously updated with current values
  latestRef.current = values;

  // Direct synchronous save helper (safe, non-blocking)
  const writeNow = useCallback(() => {
    // CRITICAL: Never write to localStorage before initial draft restoration has finished
    // AND only write if user has actually entered/modified data in this session!
    if (!hasHydratedRef.current || !isDirtyRef.current) return;
    if (typeof window === "undefined" || !window.localStorage) return;

    const data = pick<T>(latestRef.current, allow);
    // Never write if there is no meaningful user-entered content
    if (!hasMeaningfulData(data)) return;

    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {} // quota or private mode: draft is best-effort
  }, [key, allow]);

  // 1) Restore once on mount (avoids SSR hydration mismatch)
  useEffect(() => {
    let cancelled = false;
    try {
      const d = readDraft<T>(key, allow);
      if (d && !cancelled) {
        // Update latestRef immediately with restored fields to prevent any race condition
        latestRef.current = { ...latestRef.current, ...d.data };
        restore(d.data);
        setRestoredAt(d.savedAt);
      }
    } finally {
      if (!cancelled) {
        hasHydratedRef.current = true;
      }
    }
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2) Debounced save while typing (only after user has modified values)
  useEffect(() => {
    if (!hasHydratedRef.current) return;

    // Check if the current form has meaningful data before flagging dirty
    const data = pick<T>(values, allow);
    if (!hasMeaningfulData(data)) return;

    isDirtyRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      writeNow();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [values, writeNow, allow]);

  // 3) Synchronous immediate flush on page refresh (beforeunload), pagehide, and tab switch
  useEffect(() => {
    const flush = () => {
      if (!isDirtyRef.current) return;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      writeNow();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      flush(); // Flush on unmount to ensure zero data loss
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [writeNow]);

  // Call on successful submit or "Start fresh"
  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isDirtyRef.current = false;
    hasHydratedRef.current = false;
    setRestoredAt(null);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch {}
  }, [key]);

  return { restoredAt, clear, saveNow: writeNow };
}

// ---------------------------------------------------------------------------
// IndexedDB file draft helpers — persist uploaded documents across reloads
// Files are stored as native Blobs (no base64 encoding, no size bloat).
// All operations are best-effort: if IndexedDB is blocked or full, the form
// continues to work normally, the user just re-attaches files.
// ---------------------------------------------------------------------------

const IDB_NAME = "reach_form_drafts";
const IDB_VERSION = 1;
const IDB_STORE = "files";

function openDraftDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not supported"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(IDB_STORE)) {
        req.result.createObjectStore(IDB_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a file to IndexedDB (fire-and-forget, never blocks UI). */
export async function saveFileDraft(draftKey: string, fieldName: string, file: File): Promise<void> {
  try {
    const db = await openDraftDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({
      key: `${draftKey}:${fieldName}`,
      blob: file.slice(), // store as Blob copy
      name: file.name,
      type: file.type,
      size: file.size,
    });
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  } catch {} // best-effort
}

/** Remove a single file draft entry from IndexedDB. */
export async function removeFileDraft(draftKey: string, fieldName: string): Promise<void> {
  try {
    const db = await openDraftDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(`${draftKey}:${fieldName}`);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  } catch {}
}

/** Read a single file draft from IndexedDB. Returns a reconstructed File or null. */
export async function readFileDraft(draftKey: string, fieldName: string): Promise<File | null> {
  try {
    const db = await openDraftDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(`${draftKey}:${fieldName}`);
      req.onsuccess = () => {
        db.close();
        const entry = req.result;
        if (!entry?.blob) {
          resolve(null);
          return;
        }
        resolve(new File([entry.blob], entry.name, { type: entry.type }));
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/** Clear all file drafts for a given draft key prefix. */
export async function clearFileDrafts(draftKey: string): Promise<void> {
  try {
    const db = await openDraftDB();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        if (typeof cursor.key === "string" && cursor.key.startsWith(`${draftKey}:`)) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  } catch {}
}
