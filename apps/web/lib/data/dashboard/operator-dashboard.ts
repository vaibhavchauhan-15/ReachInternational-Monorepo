import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache/tags";
import type { OperatorDashboardDTO } from "./types";

const DEFAULT_OPERATOR_DASHBOARD: OperatorDashboardDTO = {
  operator: {
    id: "",
    name: "",
  },
  machine: null,
  client: null,
  today: {
    entryStatus: "pending",
    lastHmr: null,
  },
  shift: {
    start: "",
    end: "",
  },
  alerts: [],
};

export const getOperatorDashboard = cache(
  async (operatorId: string): Promise<OperatorDashboardDTO> => {
    const fetchCached = unstable_cache(
      async (): Promise<OperatorDashboardDTO> => {
        try {
          const supabase = createSupabaseAdminClient();
          const { data, error } = await supabase.rpc("get_operator_dashboard", {
            p_operator_id: operatorId,
          });

          if (error) {
            console.error("[DAL] getOperatorDashboard RPC error:", error.message);
            return DEFAULT_OPERATOR_DASHBOARD;
          }

          return (data as OperatorDashboardDTO) || DEFAULT_OPERATOR_DASHBOARD;
        } catch (err) {
          console.error("[DAL] getOperatorDashboard fatal error:", err);
          return DEFAULT_OPERATOR_DASHBOARD;
        }
      },
      [`dashboard-operator-${operatorId}`],
      {
        revalidate: 15,
        tags: [TAGS.dashboard, TAGS.dashboardOperator(operatorId)],
      }
    );

    return fetchCached();
  }
);
