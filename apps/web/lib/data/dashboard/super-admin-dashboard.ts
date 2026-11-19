import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseSecretKey } from "@/lib/env/server";
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
    // 1. Fast-path: If service role key is present, use unstable_cache with admin client
    if (hasSupabaseSecretKey()) {
      try {
        const fetchCached = unstable_cache(
          async (): Promise<SuperAdminDashboardDTO> => {
            const supabase = createSupabaseAdminClient();
            const { data, error } = await supabase.rpc("get_super_admin_dashboard");

            if (error) {
              console.error("[DAL] getSuperAdminDashboard RPC error:", error.message);
              throw new Error(`Failed to load super admin dashboard: ${error.message}`);
            }

            return (data as SuperAdminDashboardDTO) || DEFAULT_SUPER_ADMIN_DASHBOARD;
          },
          [`dashboard-super-admin-${userId}`],
          {
            revalidate: 15,
            tags: [TAGS.dashboard, TAGS.dashboardSuperAdmin(userId)],
          }
        );

        return await fetchCached();
      } catch (cacheErr) {
        console.warn("[DAL] getSuperAdminDashboard cache execution failed, falling back to server client:", cacheErr);
      }
    }

    // 2. Fallback: Authenticated per-request Supabase client (granted to authenticated role)
    try {
      const serverClient = await createSupabaseServerClient();
      const { data, error } = await serverClient.rpc("get_super_admin_dashboard");
      if (!error && data) {
        return data as SuperAdminDashboardDTO;
      }
      if (error) {
        console.warn("[DAL] getSuperAdminDashboard server client fallback returned error:", error.message);
      }
    } catch (fallbackErr) {
      console.error("[DAL] getSuperAdminDashboard direct server client fallback error:", fallbackErr);
    }

    return DEFAULT_SUPER_ADMIN_DASHBOARD;
  }
);
