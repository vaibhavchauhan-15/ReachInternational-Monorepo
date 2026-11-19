import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/env/server";
import { TAGS } from "@/lib/cache/tags";
import type { SupervisorDashboardDTO } from "./types";

const DEFAULT_SUPERVISOR_DASHBOARD: SupervisorDashboardDTO = {
  assignedMachines: 0,
  assignedOperators: 0,
  todayLogs: {
    submitted: 0,
    pending: 0,
  },
  breakdowns: 0,
  overtimeEntries: 0,
  alerts: [],
};

export const getSupervisorDashboard = cache(
  async (supervisorId: string): Promise<SupervisorDashboardDTO> => {
    // 1. Fast-path: If service role key is present, use unstable_cache with admin client
    if (hasSupabaseSecretKey()) {
      try {
        const fetchCached = unstable_cache(
          async (): Promise<SupervisorDashboardDTO> => {
            const supabase = createSupabaseAdminClient();
            const { data, error } = await supabase.rpc("get_supervisor_dashboard", {
              p_supervisor_id: supervisorId,
            });

            if (error) {
              console.error("[DAL] getSupervisorDashboard RPC error:", error.message);
              throw new Error(`Failed to load supervisor dashboard: ${error.message}`);
            }

            return (data as SupervisorDashboardDTO) || DEFAULT_SUPERVISOR_DASHBOARD;
          },
          [`dashboard-supervisor-v2-${supervisorId}`],
          {
            revalidate: 15,
            tags: [TAGS.dashboard, TAGS.dashboardSupervisor(supervisorId)],
          }
        );

        return await fetchCached();
      } catch (cacheErr) {
        console.warn("[DAL] getSupervisorDashboard cache execution failed, falling back to server client:", cacheErr);
      }
    }

    // 2. Fallback: Authenticated per-request Supabase client (granted to authenticated role)
    try {
      const serverClient = await createSupabaseServerClient();
      const { data, error } = await serverClient.rpc("get_supervisor_dashboard", {
        p_supervisor_id: supervisorId,
      });
      if (!error && data) {
        return data as SupervisorDashboardDTO;
      }
      if (error) {
        console.warn("[DAL] getSupervisorDashboard server client fallback returned error:", error.message);
      }
    } catch (fallbackErr) {
      console.error("[DAL] getSupervisorDashboard direct server client fallback error:", fallbackErr);
    }

    return DEFAULT_SUPERVISOR_DASHBOARD;
  }
);
