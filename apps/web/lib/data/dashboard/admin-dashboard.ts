import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/env/server";
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
    // 1. Fast-path: If service role key is present, use unstable_cache with admin client
    if (hasSupabaseSecretKey()) {
      try {
        const fetchCached = unstable_cache(
          async (): Promise<AdminDashboardDTO> => {
            const supabase = createSupabaseAdminClient();
            const { data, error } = await supabase.rpc("get_admin_dashboard");

            if (error) {
              console.error("[DAL] getAdminDashboard RPC error:", error.message);
              throw new Error(`Failed to load admin dashboard: ${error.message}`);
            }

            return (data as AdminDashboardDTO) || DEFAULT_ADMIN_DASHBOARD;
          },
          [`dashboard-admin-${userId}`],
          {
            revalidate: 15,
            tags: [TAGS.dashboard, TAGS.dashboardAdmin(userId)],
          }
        );

        return await fetchCached();
      } catch (cacheErr) {
        console.warn("[DAL] getAdminDashboard cache execution failed, falling back to server client:", cacheErr);
      }
    }

    // 2. Fallback: Authenticated per-request Supabase client (granted to authenticated role)
    try {
      const serverClient = await createSupabaseServerClient();
      const { data, error } = await serverClient.rpc("get_admin_dashboard");
      if (!error && data) {
        return data as AdminDashboardDTO;
      }
      if (error) {
        console.warn("[DAL] getAdminDashboard server client fallback returned error:", error.message);
      }
    } catch (fallbackErr) {
      console.error("[DAL] getAdminDashboard direct server client fallback error:", fallbackErr);
    }

    return DEFAULT_ADMIN_DASHBOARD;
  }
);
