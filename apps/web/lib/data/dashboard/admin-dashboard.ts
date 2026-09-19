import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";
import type { AdminDashboardDTO } from "./types";

const DEFAULT_ADMIN_DASHBOARD: AdminDashboardDTO = {
  totalMachines: 0,
  activeUsers: 0,
  totalClients: 0,
  activeAssignments: 0,
  todayLogs: 0,
  operationalKpis: {
    breakdowns: 0,
    overlappingLogs: 0,
    overtimeEntries: 0,
    incompleteEntries: 0,
  },
  alerts: [],
};

export const getAdminDashboard = cache(
  async (userId: string): Promise<AdminDashboardDTO> => {
    const fetchCached = unstable_cache(
      async (): Promise<AdminDashboardDTO> => {
        try {
          const supabase = createSupabaseAdminClient();
          const { data, error } = await supabase.rpc("get_admin_dashboard");

          if (error) {
            console.error("[DAL] getAdminDashboard RPC error:", error.message);
            return DEFAULT_ADMIN_DASHBOARD;
          }

          return (data as AdminDashboardDTO) || DEFAULT_ADMIN_DASHBOARD;
        } catch (err) {
          console.error("[DAL] getAdminDashboard fatal error:", err);
          return DEFAULT_ADMIN_DASHBOARD;
        }
      },
      [`dashboard-admin-${userId}`],
      {
        revalidate: 15,
        tags: [TAGS.dashboard, TAGS.dashboardAdmin(userId)],
      }
    );

    return fetchCached();
  }
);
