import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";

export interface MachineKPIs {
  total: number;
  available: number;
  rented: number;
  breakdown: number;
  maintenance: number;
  spare: number;
  active: number;
}

export interface MachineKPIScope {
  supervisorId?: string;
  operatorId?: string;
  clientId?: string;
}

/**
 * Cached scalar KPI summary using the PostgreSQL RPC function `get_machines_directory_summary`.
 * Arguments are serialized into the cache key:
 * Key format: machines:kpi:{supervisorId}:{operatorId}:{clientId}
 * Revalidated every 15 seconds (CLASS_C_OPERATIONAL) via SWR.
 */
const getCachedMachineKPIs = unstable_cache(
  async (
    supervisorId: string | null,
    operatorId: string | null,
    clientId: string | null
  ): Promise<MachineKPIs> => {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.rpc("get_machines_directory_summary", {
      p_supervisor_id: supervisorId,
      p_operator_id: operatorId,
      p_client_id: clientId,
    });

    if (error || !data) {
      console.error("Error fetching machine KPIs summary:", error?.message || error);
      return {
        total: 0,
        available: 0,
        rented: 0,
        breakdown: 0,
        maintenance: 0,
        spare: 0,
        active: 0,
      };
    }

    return {
      total: Number(data.total ?? 0),
      available: Number(data.available ?? 0),
      rented: Number(data.rented ?? 0),
      breakdown: Number(data.breakdown ?? 0),
      maintenance: Number(data.maintenance ?? 0),
      spare: Number(data.spare ?? 0),
      active: Number(data.active ?? 0),
    };
  },
  ["machines-kpis-summary-v3"],
  {
    revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, // 15 seconds SWR
    tags: [TAGS.machinesKpis, TAGS.machines],
  }
);

/**
 * High-performance scalar KPI summary query.
 * Deduplicates in-flight calls via React cache() and caches cross-request with 15s operational SWR.
 */
export const getMachineKPIs = cache(async (scope?: MachineKPIScope): Promise<MachineKPIs> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  let supervisorId = scope?.supervisorId;
  let operatorId = scope?.operatorId;
  const clientId = scope?.clientId;

  // Enforce role-scoping if not explicitly overridden by an authorized caller
  if (user.role === "supervisor" && !supervisorId) {
    supervisorId = user.id;
  } else if (user.role === "operator" && !operatorId) {
    operatorId = user.id;
  }

  return getCachedMachineKPIs(supervisorId || null, operatorId || null, clientId || null);
});
