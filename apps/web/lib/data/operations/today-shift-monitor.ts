import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";

import type { TodayShiftMonitorRow } from "@reachinternational/types";
export type { TodayShiftMonitorRow };

/**
 * Fetches the today's shift log monitor data via the get_today_shift_log_monitor RPC.
 * RBAC is enforced inside the RPC: supervisors see only their operators, admin/manager/super_admin see all.
 * When p_search is provided, server-side ILIKE filtering is applied inside the RPC.
 */
export const getTodayShiftLogMonitor = cache(
  async (actorId: string, logDate?: string, search?: string, bypassCache?: boolean): Promise<TodayShiftMonitorRow[]> => {
    const trimmedSearch = search?.trim() || undefined;

    // When searching or explicitly bypassing cache (e.g. after mutations/refreshes), query DB directly
    if (trimmedSearch || bypassCache) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase.rpc("get_today_shift_log_monitor", {
        p_actor_id: actorId,
        ...(logDate ? { p_log_date: logDate } : {}),
        ...(trimmedSearch ? { p_search: trimmedSearch } : {}),
      });
      if (error) {
        console.error("Error fetching today shift log monitor (direct):", error);
        return [];
      }
      return (data as TodayShiftMonitorRow[]) || [];
    }

    // No search & normal read — use cached version
    const cacheKey = `today-shift-monitor:${actorId}:${logDate || "today"}`;

    const fetchCached = unstable_cache(
      async (): Promise<TodayShiftMonitorRow[]> => {
        const supabase = createSupabaseAdminClient();

        const { data, error } = await supabase.rpc("get_today_shift_log_monitor", {
          p_actor_id: actorId,
          ...(logDate ? { p_log_date: logDate } : {}),
        });

        if (error) {
          console.error("Error fetching today shift log monitor:", error);
          return [];
        }

        return (data as TodayShiftMonitorRow[]) || [];
      },
      [cacheKey],
      {
        tags: [TAGS.todayShiftMonitor, TAGS.operationsLogs],
        revalidate: 15, // 15s TTL — operational KPI tier
      }
    );

    return fetchCached();
  }
);

