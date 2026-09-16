import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import { CLIENT_KEYS } from "@reachinternational/utils";
import type { CRMClient } from "@/lib/types/database";
import { CLIENT_LIST_COLUMNS } from "./client-list";

export interface SearchClientsOptions {
  limit?: number;
  status?: "all" | "active" | "inactive";
  city?: string;
}

/**
 * High-performance full-text search query service for Clients.
 * Uses canonical cache key: clients:search:{query}
 * Leverages all 7 PostgreSQL GIN Trigram indexes on public.clients:
 * (company_name, code, contact_person, phone, city, gstin, pan_number).
 * Short TTL: 60s (CACHE_TIERS.CLASS_B_FLEET).
 */
function getCachedSearchClients(query: string, options?: SearchClientsOptions) {
  const cacheKey = CLIENT_KEYS.search(query, options);
  return unstable_cache(
    async (): Promise<CRMClient[]> => {
      const clean = (query || "").trim().replace(/[,()"\\]/g, "");
      if (!clean) {
        return [];
      }

      const supabase = createSupabaseAdminClient();
      const limit = Math.max(1, Math.min(options?.limit ?? 10, 50));

      let dbQuery = supabase
        .from("clients")
        .select(CLIENT_LIST_COLUMNS)
        .or(
          `company_name.ilike.%${clean}%,code.ilike.%${clean}%,gstin.ilike.%${clean}%,pan_number.ilike.%${clean}%,contact_person.ilike.%${clean}%,phone.ilike.%${clean}%,city.ilike.%${clean}%,district.ilike.%${clean}%,state.ilike.%${clean}%`
        );

      // Optional status filter
      if (options?.status === "active") {
        dbQuery = dbQuery.eq("status", "active").is("deleted_at", null);
      } else if (options?.status === "inactive") {
        dbQuery = dbQuery.or("status.eq.inactive,deleted_at.not.is.null");
      }

      // Optional city filter
      if (options?.city && options.city !== "all") {
        dbQuery = dbQuery.eq("city", options.city);
      }

      dbQuery = dbQuery.order("company_name", { ascending: true }).limit(limit);

      const { data, error } = await dbQuery;

      if (error || !data) {
        console.error("Error in searchClients:", error?.message || error);
        return [];
      }

      return data.map((client: any) => {
        const street = (client.street || "").trim();
        const fullAddress = [street, client.city, client.district, client.state, client.pincode]
          .filter(Boolean)
          .join(", ");

        return {
          ...client,
          street,
          address: fullAddress,
          client_name: client.company_name,
          machine_count: 0,
          open_complaints: 0,
          status: client.status ?? "active",
        };
      });
    },
    [cacheKey],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET, // 60s short TTL
      tags: [TAGS.clientsList, TAGS.clients],
    }
  )();
}

/**
 * Top-level searchClients query service with React cache() request deduplication.
 * Uses canonical cache key: clients:search:{query}
 */
export const searchClients = cache(
  async (query: string, options?: SearchClientsOptions): Promise<CRMClient[]> => {
    const clean = (query || "").trim();
    if (!clean) return [];
    return getCachedSearchClients(clean, options);
  }
);
