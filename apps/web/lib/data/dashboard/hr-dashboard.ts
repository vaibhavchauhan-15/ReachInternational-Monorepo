import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/env/server";
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
    // 1. Fast-path: If service role key is present, use unstable_cache with admin client
    if (hasSupabaseSecretKey()) {
      try {
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

        return await fetchCached();
      } catch (cacheErr) {
        console.warn("[DAL] getHRDashboard cache execution failed, falling back to server client:", cacheErr);
      }
    }

    // 2. Fallback: Authenticated per-request Supabase client (granted to authenticated role)
    try {
      const serverClient = await createSupabaseServerClient();
      const { data, error } = await serverClient.rpc("get_hr_dashboard");
      if (!error && data) {
        return data as HRDashboardDTO;
      }
      if (error) {
        console.warn("[DAL] getHRDashboard server client fallback returned error:", error.message);
      }
    } catch (fallbackErr) {
      console.error("[DAL] getHRDashboard direct server client fallback error:", fallbackErr);
    }

    return DEFAULT_HR_DASHBOARD;
  }
);
