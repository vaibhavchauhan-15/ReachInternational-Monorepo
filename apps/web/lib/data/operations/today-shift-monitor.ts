import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dedupeShiftMonitorRows } from "@/lib/utils/shift-monitor";
import { TAGS } from "@/lib/cache/tags";
import { getISTDateString } from "@reachinternational/utils";

import type { TodayShiftMonitorRow } from "@reachinternational/types";
export type { TodayShiftMonitorRow };
export { dedupeShiftMonitorRows };

/**
 * Raw read of the single-day shift roster through `get_today_shift_log_monitor`.
 *
 * The RPC is the single authoritative source for:
 * - active-assignment scoping (cancelled / relieved / superseded same-day ranges excluded)
 * - RBAC (supervisor sees only their operators, machines and client sites)
 * - search across operator / machine / client / site fields
 * - shift-code normalisation filtering and time asc/desc sorting
 *
 * Therefore this data layer performs ZERO post-processing: no second "active roster"
 * query, no in-memory reconciliation, no duplicate filtering or sorting. Migration 227
 * made this RPC a single planned statement (~50% less DB CPU than the previous
 * duplicated 3-query implementation).
 */
async function fetchTodayShiftLogMonitorFromDb(
  actorId: string,
  logDate?: string,
  search?: string,
  clientId?: string,
  shiftCode?: string,
  sort?: string
): Promise<TodayShiftMonitorRow[]> {
  const supabase = tryCreateSupabaseAdminClient() || (await createSupabaseServerClient());

  const trimmedSearch = search?.trim() || undefined;
  const trimmedClientId = clientId?.trim() || undefined;
  const trimmedShiftCode = shiftCode?.trim() || undefined;
  const trimmedSort = sort?.trim() || "time_asc";

  const { data, error } = await supabase.rpc("get_today_shift_log_monitor", {
    p_actor_id: actorId,
    ...(logDate ? { p_log_date: logDate } : {}),
    ...(trimmedSearch ? { p_search: trimmedSearch } : {}),
    ...(trimmedClientId ? { p_client_id: trimmedClientId } : {}),
    ...(trimmedShiftCode && trimmedShiftCode !== "all" ? { p_shift_code: trimmedShiftCode } : {}),
    ...(trimmedSort ? { p_sort: trimmedSort } : {}),
  });

  if (error) {
    console.error("[getTodayShiftLogMonitor] RPC error:", error.message || error);
    return [];
  }

  const rows = (data as TodayShiftMonitorRow[]) || [];
  return rows.length > 1 ? dedupeShiftMonitorRows(rows) : rows;
}

/**
 * Cached single-day shift roster.
 *
 * Performance contract:
 * - `cache()` deduplicates repeated calls inside one render / server action (~0 ms).
 * - `unstable_cache` (10 s) collapses SSR + client polling + realtime-triggered refreshes
 *   into one database execution per actor/date/filter combination.
 * - Tagged with `operations:today-shift-monitor` so every mutation that touches logs,
 *   assignments or machine state invalidates it instantly (`revalidateTag`).
 * - `bypassCache` forces an authoritative read after an explicit user action.
 */
const getCachedShiftMonitor = unstable_cache(
  fetchTodayShiftLogMonitorFromDb,
  ["operations-today-shift-monitor-v2"],
  { revalidate: 10, tags: [TAGS.todayShiftMonitor, TAGS.operations] }
);

export const getTodayShiftLogMonitor = cache(
  async (
    actorId: string,
    logDate?: string,
    search?: string,
    clientId?: string,
    shiftCode?: string,
    sort?: string,
    bypassCache: boolean = false
  ): Promise<TodayShiftMonitorRow[]> => {
    const targetDate = logDate || getISTDateString();

    if (bypassCache) {
      return fetchTodayShiftLogMonitorFromDb(
        actorId,
        targetDate,
        search,
        clientId,
        shiftCode,
        sort
      );
    }

    return getCachedShiftMonitor(actorId, targetDate, search, clientId, shiftCode, sort);
  }
);
