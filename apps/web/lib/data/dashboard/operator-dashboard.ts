import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/env/server";
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
    submittedCount: 0,
    totalAssignedCount: 0,
    totalRunningHoursToday: 0,
  },
  shift: {
    start: "",
    end: "",
  },
  assigned_shifts: [],
  alerts: [],
};

export const getOperatorDashboard = cache(
  async (operatorId: string): Promise<OperatorDashboardDTO> => {
    // 1. Fast-path: If service role key is present, use unstable_cache with admin client
    if (hasSupabaseSecretKey()) {
      try {
        const fetchCached = unstable_cache(
          async (): Promise<OperatorDashboardDTO> => {
            const supabase = createSupabaseAdminClient();
            const { data, error } = await supabase.rpc("get_operator_dashboard", {
              p_operator_id: operatorId,
            });

            if (error) {
              console.error("[DAL] getOperatorDashboard RPC error:", error.message);
              throw new Error(`Failed to load operator dashboard: ${error.message}`);
            }

            return (data as OperatorDashboardDTO) || DEFAULT_OPERATOR_DASHBOARD;
          },
          [`dashboard-operator-${operatorId}`],
          {
            revalidate: 15,
            tags: [TAGS.dashboard, TAGS.dashboardOperator(operatorId)],
          }
        );

        return await fetchCached();
      } catch (cacheErr) {
        console.warn("[DAL] getOperatorDashboard cache execution failed, falling back to server client:", cacheErr);
      }
    }

    // 2. Fallback: Authenticated per-request Supabase client (granted to authenticated role)
    try {
      const serverClient = await createSupabaseServerClient();
      const { data, error } = await serverClient.rpc("get_operator_dashboard", {
        p_operator_id: operatorId,
      });
      if (!error && data) {
        return data as OperatorDashboardDTO;
      }
      if (error) {
        console.warn("[DAL] getOperatorDashboard server client fallback returned error:", error.message);
      }
    } catch (fallbackErr) {
      console.error("[DAL] getOperatorDashboard direct server client fallback error:", fallbackErr);
    }

    return DEFAULT_OPERATOR_DASHBOARD;
  }
);
