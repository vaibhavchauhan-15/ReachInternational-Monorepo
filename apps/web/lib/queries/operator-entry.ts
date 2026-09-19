import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import type { OperatorEntryContext } from "@reachinternational/types";

/**
 * Low-level RPC fetcher for operator entry context.
 * Returns only the minimal data required for initial entry form rendering:
 * - Current authenticated operator (identity & shift)
 * - Assigned machine (id, code, model, serial)
 * - Client (id, company_name, site)
 * - Last valid HMR
 */
async function fetchOperatorEntryContextFromDb(
  operatorId: string
): Promise<OperatorEntryContext> {
  const supabase = createSupabaseAdminClient();

  try {
    const { data, error } = await supabase.rpc("get_operator_entry_context", {
      p_operator_id: operatorId,
    });

    if (error) {
      console.error(
        "[operator-entry] Error calling get_operator_entry_context RPC:",
        error.message || error
      );
      return {
        operator: null,
        machine: null,
        client: null,
        last_hmr: 0,
        last_log: null,
      };
    }

    const res = data as Record<string, unknown> | null;
    return {
      operator: (res?.operator as OperatorEntryContext["operator"]) || null,
      machine: (res?.machine as OperatorEntryContext["machine"]) || null,
      client: (res?.client as OperatorEntryContext["client"]) || null,
      last_hmr: typeof res?.last_hmr === "number" ? res.last_hmr : Number(res?.last_hmr) || 0,
      last_log: (res?.last_log as OperatorEntryContext["last_log"]) || null,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[operator-entry] Exception in fetchOperatorEntryContextFromDb:", errMsg);
    return {
      operator: null,
      machine: null,
      client: null,
      last_hmr: 0,
      last_log: null,
    };
  }
}

/**
 * Cached Operator Entry Context read-model.
 * 
 * Performance characteristics:
 * - Single index-backed PostgreSQL RPC query (<2ms execution time)
 * - React request deduplication via `cache()` (0ms on multiple calls within same render)
 * - 15-second operational cache tier via `unstable_cache`
 * - Tagged with `operator-entry:${operatorId}` for instant targeted revalidation on log submit
 */
export const getOperatorEntryContext = cache(async (operatorId: string): Promise<OperatorEntryContext> => {
  return unstable_cache(
    async () => fetchOperatorEntryContextFromDb(operatorId),
    [`operator-entry-context-${operatorId}`],
    {
      revalidate: 15,
      tags: [CACHE_TAGS.operations, `operator-entry:${operatorId}`],
    }
  )();
});
