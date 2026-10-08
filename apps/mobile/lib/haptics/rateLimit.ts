/**
 * ReachInternational Mobile — Haptics Rate Limiter & Burst Deduper
 * Guarantees max 1 haptic per user gesture, never buzzing faster than 60ms apart,
 * and dropping rapid repeated bursts of the same semantic kind within 120ms.
 */

const MIN_INTERVAL_MS = 60;
const DEDUPE_SAME_KIND_MS = 120;

let lastFiredAt = 0;
let lastFiredKind: string | null = null;

/**
 * Evaluates whether a requested haptic feedback event should be allowed.
 */
export function shouldAllowHaptic(kind: string, now: number = Date.now()): boolean {
  // Global rate limit: minimum 60ms between any haptic trigger
  if (now - lastFiredAt < MIN_INTERVAL_MS) {
    return false;
  }

  // Dedupe bursts: same kind cannot fire within 120ms
  if (kind === lastFiredKind && now - lastFiredAt < DEDUPE_SAME_KIND_MS) {
    return false;
  }

  return true;
}

/**
 * Records that a haptic event was fired to update the rate limiter state.
 */
export function recordHapticFired(kind: string, now: number = Date.now()): void {
  lastFiredAt = now;
  lastFiredKind = kind;
}

/**
 * Resets the rate limiter state (used in automated unit testing).
 */
export function resetHapticRateLimiter(): void {
  lastFiredAt = 0;
  lastFiredKind = null;
}
