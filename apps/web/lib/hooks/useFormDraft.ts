"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h draft lifetime
const DEBOUNCE_MS = 500;

/**
 * Picks only the allowed keys from an object.
 * Exported for testing.
 */
export function pick<T extends object>(obj: unknown, allow: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  if (obj && typeof obj === "object")
    for (const k of allow) if (k in obj) out[k] = (obj as Record<string, unknown>)[k];
  return out as Partial<T>;
}

const hasValue = (d: object) =>
  Object.values(d).some((v) => v !== "" && v != null && !(Array.isArray(v) && !v.length));

/**
 * Read and validate a draft from localStorage.
 * Returns null if missing, expired, corrupt, or empty.
 * Exported for testing.
 */
export function readDraft<T extends object>(key: string, allow: readonly string[], now = Date.now()) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (typeof savedAt !== "number" || now - savedAt > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    const picked = pick<T>(data, allow);
    return hasValue(picked) ? { savedAt, data: picked } : null;
  } catch {
    return null; // corrupt JSON or storage blocked: start blank
  }
}

/**
 * Persists a subset of form values in localStorage so the user can recover
 * them after a page close, reload, or network failure.
 *
 * @param key     localStorage key (version it: "signup_draft_v1")
 * @param allow   Allowlist of field names to persist (never include passwords/secrets)
 * @param values  Current form state object
 * @param restore Callback that merges restored draft into form state
 *
 * @returns { restoredAt, clear }
 *   - restoredAt: timestamp of the restored draft (null if none)
 *   - clear(): call on successful submit or "Start fresh" to delete the draft
 */
export function useFormDraft<T extends object>(
  key: string,
  allow: readonly string[],
  values: T,
  restore: (draft: Partial<T>) => void,
) {
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const latest = useRef(values);
  latest.current = values;

  // 1) Restore once, after mount (never during render: avoids SSR hydration mismatch)
  useEffect(() => {
    const d = readDraft<T>(key, allow);
    if (d) {
      restore(d.data);
      setRestoredAt(d.savedAt);
    }
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const write = useCallback(() => {
    const data = pick<T>(latest.current, allow);
    if (!hasValue(data)) return;
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {} // quota or private mode: draft is best-effort
  }, [key, allow]);

  // 2) Debounced save while typing
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(write, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [values, ready, write]);

  // 3) Flush immediately when the tab is hidden / closed
  useEffect(() => {
    if (!ready) return;
    const onHide = () => document.visibilityState === "hidden" && write();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", write);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", write);
    };
  }, [ready, write]);

  // Call on successful submit or "Start fresh"
  const clear = useCallback(() => {
    setReady(false);
    setRestoredAt(null);
    try { localStorage.removeItem(key); } catch {}
  }, [key]);

  return { restoredAt, clear };
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
      blob: file.slice(),   // store as Blob copy
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
        if (!entry?.blob) { resolve(null); return; }
        resolve(new File([entry.blob], entry.name, { type: entry.type }));
      };
      req.onerror = () => { db.close(); resolve(null); };
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
