"use client";

import type { ClientShiftCode } from "@reachinternational/types";

interface CacheEntry {
  data: ClientShiftCode[];
  timestamp: number;
}

// 60-second in-memory client shifts cache
const CACHE_TTL_MS = 60_000;
const clientShiftsMemoryCache = new Map<string, CacheEntry>();

export const CLIENT_SHIFTS_INVALIDATED_EVENT = "reach:client-shifts-invalidated";

/**
 * Retrieves client shift codes from the local in-memory cache if not expired.
 */
export function getCachedClientShifts(clientId: string): ClientShiftCode[] | null {
  if (!clientId) return null;
  const entry = clientShiftsMemoryCache.get(clientId);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    clientShiftsMemoryCache.delete(clientId);
    return null;
  }

  return entry.data;
}

/**
 * Sets client shift codes in the local in-memory cache with current timestamp.
 */
export function setCachedClientShifts(clientId: string, shifts: ClientShiftCode[]): void {
  if (!clientId) return;
  clientShiftsMemoryCache.set(clientId, {
    data: shifts,
    timestamp: Date.now(),
  });
}

/**
 * Invalidates client shift codes cache for a specific client (or all clients).
 * Emits a window custom event to notify any open modals/tabs to refresh their state.
 */
export function invalidateClientShiftsCache(clientId?: string): void {
  if (clientId) {
    clientShiftsMemoryCache.delete(clientId);
  } else {
    clientShiftsMemoryCache.clear();
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(CLIENT_SHIFTS_INVALIDATED_EVENT, {
        detail: { clientId: clientId || null },
      })
    );
  }
}
