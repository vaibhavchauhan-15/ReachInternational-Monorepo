import type { TodayShiftMonitorRow } from "@reachinternational/types";

/**
 * Canonical deduplication for today's shift log monitor rows.
 * Guarantees that each machine has at most one record per shift code.
 * Prioritizes 'entered' (with log) over 'pending' (assigned) over 'unassigned'.
 */
export function dedupeShiftMonitorRows(rows: TodayShiftMonitorRow[]): TodayShiftMonitorRow[] {
  if (!Array.isArray(rows) || rows.length <= 1) return rows || [];
  const map = new Map<string, TodayShiftMonitorRow>();
  for (const r of rows) {
    const shiftCode = (r.shift_code || "S1").toUpperCase();
    const key = `${r.machine_id}-${shiftCode}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, r);
    } else {
      if (r.status === "entered" && existing.status !== "entered") {
        map.set(key, r);
      } else if (r.status === "pending" && existing.status === "unassigned") {
        map.set(key, r);
      } else if (r.status === existing.status && r.log_id && !existing.log_id) {
        map.set(key, r);
      }
    }
  }
  return Array.from(map.values());
}
