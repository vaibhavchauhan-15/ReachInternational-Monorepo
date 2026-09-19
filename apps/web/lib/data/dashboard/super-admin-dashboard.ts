import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";
import type { SuperAdminDashboardDTO } from "./types";

const DEFAULT_SUPER_ADMIN_DASHBOARD: SuperAdminDashboardDTO = {
  totalUsers: 0,
  activeMachines: 0,
  totalClients: 0,
  activeAssignments: 0,
  todayLogs: 0,
  recentAuditActions: 0,
  alerts: [],
};

export const getSuperAdminDashboard = cache(
  async (userId: string): Promise<SuperAdminDashboardDTO> => {
    const fetchCached = unstable_cache(
      async (): Promise<SuperAdminDashboardDTO> => {
        try {
          const supabase = createSupabaseAdminClient();
          const { data, error } = await supabase.rpc("get_super_admin_dashboard");

          if (error) {
            console.error("[DAL] getSuperAdminDashboard RPC error:", error.message);
            return DEFAULT_SUPER_ADMIN_DASHBOARD;
          }

          return (data as SuperAdminDashboardDTO) || DEFAULT_SUPER_ADMIN_DASHBOARD;
        } catch (err) {
          console.error("[DAL] getSuperAdminDashboard fatal error:", err);
          return DEFAULT_SUPER_ADMIN_DASHBOARD;
        }
      },
      [`dashboard-super-admin-${userId}`],
      {
        revalidate: 15,
        tags: [TAGS.dashboard, TAGS.dashboardSuperAdmin(userId)],
      }
    );

    return fetchCached();
  }
);
