import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
    const fetchCached = unstable_cache(
      async (): Promise<SupervisorDashboardDTO> => {
        try {
          const supabase = createSupabaseAdminClient();
          const { data, error } = await supabase.rpc("get_supervisor_dashboard", {
            p_supervisor_id: supervisorId,
          });

          if (error) {
            console.error("[DAL] getSupervisorDashboard RPC error:", error.message);
            return DEFAULT_SUPERVISOR_DASHBOARD;
          }

          return (data as SupervisorDashboardDTO) || DEFAULT_SUPERVISOR_DASHBOARD;
        } catch (err) {
          console.error("[DAL] getSupervisorDashboard fatal error:", err);
          return DEFAULT_SUPERVISOR_DASHBOARD;
        }
      },
      [`dashboard-supervisor-${supervisorId}`],
      {
        revalidate: 15,
        tags: [TAGS.dashboard, TAGS.dashboardSupervisor(supervisorId)],
      }
    );

    return fetchCached();
  }
);
