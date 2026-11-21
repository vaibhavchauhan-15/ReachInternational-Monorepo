import type { TodayShiftMonitorRow } from "@reachinternational/types";

/**
 * Canonical deduplication for today's shift log monitor rows.
 * Guarantees that each machine has at most one record per normalized shift code.
 * Prioritizes 'entered' (with log) over 'pending' (assigned) over 'unassigned'.
 * When both are pending, prioritizes assigned operator records over unassigned placeholders.
 */
export function dedupeShiftMonitorRows(rows: TodayShiftMonitorRow[]): TodayShiftMonitorRow[] {
  if (!Array.isArray(rows) || rows.length <= 1) return rows || [];
  const map = new Map<string, TodayShiftMonitorRow>();

  for (const r of rows) {
    const rawCode = (r.shift_code || "S1").trim();
    const shiftNorm = rawCode.toUpperCase().replace(/^SHIFT\s*/i, "") || "S1";
    const key = `${r.machine_id}-${shiftNorm}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, r);
    } else {
      // 1. Prioritize entered (with shift log) over pending or unassigned
      if (r.status === "entered" && existing.status !== "entered") {
        map.set(key, r);
      } else if (r.status !== "entered" && existing.status === "entered") {
        // Keep existing entered log
      } else if (r.status === "pending" && existing.status === "unassigned") {
        map.set(key, r);
      } else if (r.status === "unassigned" && existing.status === "pending") {
        // Keep existing pending assignment
      } else if (r.log_id && !existing.log_id) {
        map.set(key, r);
      } else if (r.operator_id && !existing.operator_id) {
        map.set(key, r);
      }
    }
  }

  return Array.from(map.values());
}
