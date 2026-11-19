import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/env/server";
import { TAGS } from "@/lib/cache/tags";
import type { ManagerDashboardDTO } from "./types";

const DEFAULT_MANAGER_DASHBOARD: ManagerDashboardDTO = {
  machineUtilization: {
    total: 0,
    active: 0,
    rented: 0,
    spare: 0,
    breakdown: 0,
  },
  operationsToday: {
    totalLogs: 0,
    totalHours: 0,
  },
  activeAssignments: 0,
  alerts: [],
};

export const getManagerDashboard = cache(
  async (userId: string): Promise<ManagerDashboardDTO> => {
    // 1. Fast-path: If service role key is present, use unstable_cache with admin client
    if (hasSupabaseSecretKey()) {
      try {
        const fetchCached = unstable_cache(
          async (): Promise<ManagerDashboardDTO> => {
            const supabase = createSupabaseAdminClient();
            const { data, error } = await supabase.rpc("get_manager_dashboard");

            if (error) {
              console.error("[DAL] getManagerDashboard RPC error:", error.message);
              throw new Error(`Failed to load manager dashboard: ${error.message}`);
            }

            return (data as ManagerDashboardDTO) || DEFAULT_MANAGER_DASHBOARD;
          },
          [`dashboard-manager-${userId}`],
          {
            revalidate: 15,
            tags: [TAGS.dashboard, TAGS.dashboardManager(userId)],
          }
        );

        return await fetchCached();
      } catch (cacheErr) {
        console.warn("[DAL] getManagerDashboard cache execution failed, falling back to server client:", cacheErr);
      }
    }

    // 2. Fallback: Authenticated per-request Supabase client (granted to authenticated role)
    try {
      const serverClient = await createSupabaseServerClient();
      const { data, error } = await serverClient.rpc("get_manager_dashboard");
      if (!error && data) {
        return data as ManagerDashboardDTO;
      }
      if (error) {
        console.warn("[DAL] getManagerDashboard server client fallback returned error:", error.message);
      }
    } catch (fallbackErr) {
      console.error("[DAL] getManagerDashboard direct server client fallback error:", fallbackErr);
    }

    return DEFAULT_MANAGER_DASHBOARD;
  }
);
