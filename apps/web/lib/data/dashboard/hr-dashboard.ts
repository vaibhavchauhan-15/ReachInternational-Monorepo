import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";
import type { HRDashboardDTO } from "./types";

const DEFAULT_HR_DASHBOARD: HRDashboardDTO = {
  totalEmployees: 0,
  activeOperators: 0,
  pendingProfileChanges: 0,
  todayLogsCount: 0,
  alerts: [],
};

export const getHRDashboard = cache(
  async (userId: string): Promise<HRDashboardDTO> => {
    const fetchCached = unstable_cache(
      async (): Promise<HRDashboardDTO> => {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await supabase.rpc("get_hr_dashboard");

        if (error) {
          console.error("[DAL] getHRDashboard RPC error:", error.message);
          throw new Error(`Failed to load HR dashboard: ${error.message}`);
        }

        return (data as HRDashboardDTO) || DEFAULT_HR_DASHBOARD;
      },
      [`dashboard-hr-${userId}`],
      {
        revalidate: 15,
        tags: [TAGS.dashboard, TAGS.dashboardHR(userId)],
      }
    );

    return fetchCached();
  }
);
