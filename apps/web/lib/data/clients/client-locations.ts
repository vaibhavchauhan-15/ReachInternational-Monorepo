import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import { CLIENT_KEYS, type ClientLocationFilter } from "@reachinternational/utils";
import { getClientKPIs } from "./client-kpis";

/**
 * Cached client locations fetcher.
 * Uses canonical cache key: clients:locations:{filters}
 * Leverages cities_list embedded directly in getClientKPIs() to avoid duplicate DB queries.
 * Falls back to SQL DISTINCT if needed.
 * Cache rule: Stable location metadata -> Long TTL (3,600s / 1 hour).
 */
function getCachedClientLocations(filter?: ClientLocationFilter) {
  const cacheKey = CLIENT_KEYS.locations(filter);
  return unstable_cache(
    async (): Promise<string[]> => {
      try {
        // 1. First attempt to read unique cities from the scalar summary RPC (0 extra DB queries)
        const kpis = await getClientKPIs();
        if (kpis.cities_list && kpis.cities_list.length > 0) {
          return kpis.cities_list;
        }
      } catch {
        // Proceed to fallback query
      }

      // 2. Fallback: Perform indexed distinct city lookup
      const supabase = createSupabaseAdminClient();

      let query = supabase
        .from("clients")
        .select("city")
        .not("city", "is", null);

      if (filter?.status === "active") {
        query = query.eq("status", "active").is("deleted_at", null);
      } else if (filter?.status === "inactive") {
        query = query.or("status.eq.inactive,deleted_at.not.is.null");
      } else {
        query = query.is("deleted_at", null);
      }

      const { data, error } = await query;

      if (error || !data) {
        console.error("Error fetching client locations:", error?.message || error);
        return [];
      }

      const unique = Array.from(
        new Set(
          data
            .map((d: any) => (d.city ? String(d.city).trim() : ""))
            .filter((c: string) => c.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b));

      return unique;
    },
    [cacheKey],
    {
      revalidate: CACHE_TIERS.CLASS_A_REFERENCE, // 3600s (1 hour) Long TTL
      tags: [TAGS.clientsLocations, TAGS.clients],
    }
  )();
}

/**
 * Top-level getClientLocation query service with React cache() deduplication.
 * Uses canonical cache key: clients:locations:{filters}
 * Stable location metadata -> Long TTL (3600s).
 */
export const getClientLocation = cache(async (filter?: ClientLocationFilter): Promise<string[]> => {
  return getCachedClientLocations(filter);
});

// Backward-compatible alias
export const getClientLocations = getClientLocation;
