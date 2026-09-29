/**
 * Client Monthly Maintenance Allowance Utilities
 *
 * Business rule:
 *   A = client allowance minutes (per machine, per calendar month)
 *   P = sum of breakdown_minutes of earlier logs this month (in start_datetime order)
 *   B = this log's breakdown_minutes
 *   M = min(B, max(0, A - P))  → maintenance minutes for this log
 *   N = B - M                  → net breakdown minutes for this log
 *
 * Month totals (closed-form):
 *   Σ Maintenance = min(Σ Breakdown, A)
 *   Σ Net B/D     = max(0, Σ Breakdown - A)
 */

export interface MaintenanceAllocation {
  /** Minutes classified as maintenance (covered by allowance). */
  maintenanceMin: number;
  /** Minutes classified as net breakdown (billable / reportable). */
  netMin: number;
}

/**
 * Allocates breakdown minutes between maintenance and net breakdown.
 *
 * @param allowanceMin  - Client's monthly allowance in minutes (A).
 * @param usedMin       - Allowance already consumed by earlier logs this month (P).
 * @param breakdownMin  - This log's total breakdown duration in minutes (B).
 * @returns `{ maintenanceMin, netMin }` — both non-negative, sum equals breakdownMin.
 *
 * @example
 * // A = 600 min (10 h), 3 breakdown logs in order:
 * allocateMaintenance(600, 0,   120) // → { maintenanceMin: 120, netMin: 0   } — 480 remaining
 * allocateMaintenance(600, 120, 360) // → { maintenanceMin: 360, netMin: 0   } — 120 remaining
 * allocateMaintenance(600, 480, 600) // → { maintenanceMin: 120, netMin: 480 } — 0  remaining
 */
export function allocateMaintenance(
  allowanceMin: number,
  usedMin: number,
  breakdownMin: number
): MaintenanceAllocation {
  const remaining = Math.max(0, allowanceMin - usedMin);
  const maintenanceMin = Math.min(breakdownMin, remaining);
  return {
    maintenanceMin,
    netMin: breakdownMin - maintenanceMin,
  };
}

/**
 * Formats a minute count as a concise human-readable string.
 * e.g. 90 → "1h 30m", 60 → "1h", 30 → "30m", 0 → "0m"
 */
export function formatMinutes(minutes: number): string {
  const m = Math.round(Math.abs(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h > 0 && rem > 0) return `${h}h ${rem}m`;
  if (h > 0) return `${h}h`;
  return `${rem}m`;
}

/**
 * Converts a maintenance allowance in minutes to a display label.
 * e.g. 600 → "10h", 90 → "1h 30m", 0 → "No allowance"
 */
export function formatAllowance(allowanceMin?: number | null): string {
  if (!allowanceMin || allowanceMin <= 0) return "No allowance";
  return formatMinutes(allowanceMin);
}

/**
 * Returns true if the given allowance (minutes) is non-zero.
 */
export function hasMaintenanceAllowance(allowanceMin: number | undefined | null): boolean {
  return typeof allowanceMin === "number" && allowanceMin > 0;
}
