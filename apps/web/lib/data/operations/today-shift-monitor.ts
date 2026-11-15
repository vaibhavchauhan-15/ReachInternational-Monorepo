import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";

import type { TodayShiftMonitorRow, ShiftTaskRow, ShiftTasksResponse } from "@reachinternational/types";
export type { TodayShiftMonitorRow, ShiftTaskRow, ShiftTasksResponse };

/**
 * Fetches shift tasks for the 7-day window via get_shift_tasks RPC.
 * Actor RBAC and operator-scoped view are enforced inside the RPC.
 */
export const getShiftTasks = cache(
  async (
    actorId: string,
    params?: {
      operatorId?: string;
      fromDate?: string;
      toDate?: string;
      status?: "all" | "pending" | "entered";
      page?: number;
      pageSize?: number;
    }
  ): Promise<ShiftTasksResponse> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_shift_tasks", {
      p_actor_id: actorId,
      ...(params?.operatorId ? { p_operator_id: params.operatorId } : {}),
      ...(params?.fromDate ? { p_from_date: params.fromDate } : {}),
      ...(params?.toDate ? { p_to_date: params.toDate } : {}),
      ...(params?.status ? { p_status: params.status } : {}),
      ...(params?.page ? { p_page: params.page } : {}),
      ...(params?.pageSize ? { p_page_size: params.pageSize } : {}),
    });

    if (error) {
      console.error("[getShiftTasks] RPC error:", error);
      throw new Error(`Failed to load shift tasks: ${error.message}`);
    }

    return (data as unknown as ShiftTasksResponse) || {
      page: 1,
      pageSize: 50,
      totalCount: 0,
      hasMore: false,
      fromDate: "",
      toDate: "",
      rows: [],
    };
  }
);

/**
 * Fetches the today's shift log monitor data via the get_today_shift_log_monitor RPC.
 * RBAC is enforced inside the RPC: supervisors see only their operators, admin/manager/super_admin see all.
 * When p_search is provided, server-side ILIKE filtering is applied inside the RPC.
 */
export const getTodayShiftLogMonitor = cache(
  async (actorId: string, logDate?: string, search?: string, bypassCache?: boolean, clientId?: string): Promise<TodayShiftMonitorRow[]> => {
    const trimmedSearch = search?.trim() || undefined;
    const trimmedClientId = clientId?.trim() || undefined;

    // When searching, filtering by client, or explicitly bypassing cache, query DB directly
    if (trimmedSearch || trimmedClientId || bypassCache) {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase.rpc("get_today_shift_log_monitor", {
        p_actor_id: actorId,
        ...(logDate ? { p_log_date: logDate } : {}),
        ...(trimmedSearch ? { p_search: trimmedSearch } : {}),
        ...(trimmedClientId ? { p_client_id: trimmedClientId } : {}),
      });
      if (error) {
        console.error("Error fetching today shift log monitor (direct):", error);
        throw new Error(`Failed to load shift log monitor: ${error.message}`);
      }
      return (data as TodayShiftMonitorRow[]) || [];
    }

    // No search & normal read — use cached version
    const cacheKey = `today-shift-monitor:${actorId}:${logDate || "today"}:${clientId || "all"}`;

    const fetchCached = unstable_cache(
      async (): Promise<TodayShiftMonitorRow[]> => {
        const supabase = createSupabaseAdminClient();

        const { data, error } = await supabase.rpc("get_today_shift_log_monitor", {
          p_actor_id: actorId,
          ...(logDate ? { p_log_date: logDate } : {}),
          ...(trimmedClientId ? { p_client_id: trimmedClientId } : {}),
        });

        if (error) {
          console.error("Error fetching today shift log monitor:", error);
          throw new Error(`Failed to load shift log monitor: ${error.message}`);
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

