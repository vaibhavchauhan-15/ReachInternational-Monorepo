import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
    const fetchCached = unstable_cache(
      async (): Promise<ManagerDashboardDTO> => {
        try {
          const supabase = createSupabaseAdminClient();
          const { data, error } = await supabase.rpc("get_manager_dashboard");

          if (error) {
            console.error("[DAL] getManagerDashboard RPC error:", error.message);
            return DEFAULT_MANAGER_DASHBOARD;
          }

          return (data as ManagerDashboardDTO) || DEFAULT_MANAGER_DASHBOARD;
        } catch (err) {
          console.error("[DAL] getManagerDashboard fatal error:", err);
          return DEFAULT_MANAGER_DASHBOARD;
        }
      },
      [`dashboard-manager-${userId}`],
      {
        revalidate: 15,
        tags: [TAGS.dashboard, TAGS.dashboardManager(userId)],
      }
    );

    return fetchCached();
  }
);
