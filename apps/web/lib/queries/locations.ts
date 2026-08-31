import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { MasterState, MasterDistrict, MasterCity, MasterLocation } from "@reachinternational/types";

/**
 * Cached fetch for all 36 States and Union Territories of India
 */
export const getStatesList = unstable_cache(
  async (): Promise<MasterState[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("master_states")
      .select("id, name, type, state_code, lgd_code, census_code, status, created_at, updated_at")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error || !data) {
      console.error("Error fetching master states:", error?.message);
      return [];
    }

    return data as MasterState[];
  },
  ["master-states-list-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_A_STATIC,
    tags: [TAGS.clients, "master_locations"],
  }
);

/**
 * Cached fetch for Districts in a specific State
 */
export const getDistrictsList = cache(async (stateName: string): Promise<MasterDistrict[]> => {
  if (!stateName || !stateName.trim()) return [];
  const normalizedState = stateName.trim();

  return unstable_cache(
    async (): Promise<MasterDistrict[]> => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("master_districts")
        .select("id, state_name, district_name, district_lgd_code, short_name, census_code, status, created_at, updated_at")
        .eq("state_name", normalizedState)
        .eq("status", "active")
        .order("district_name", { ascending: true });

      if (error || !data) {
        console.error(`Error fetching districts for ${normalizedState}:`, error?.message);
        return [];
      }

      return data as MasterDistrict[];
    },
    [`master-districts-${normalizedState.toLowerCase().replace(/\s+/g, "_")}`],
    {
      revalidate: CACHE_TIERS.CLASS_A_STATIC,
      tags: ["master_locations"],
    }
  )();
});

/**
 * Cached fetch for Cities and Towns in a specific State & District
 */
export const getCitiesList = cache(async (stateName: string, districtName: string): Promise<MasterCity[]> => {
  if (!stateName || !districtName) return [];
  const sName = stateName.trim();
  const dName = districtName.trim();

  return unstable_cache(
    async (): Promise<MasterCity[]> => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("master_cities")
        .select("id, state_name, district_name, city_name, town_type, town_code, status, created_at, updated_at")
        .eq("state_name", sName)
        .eq("district_name", dName)
        .eq("status", "active")
        .order("city_name", { ascending: true });

      if (error || !data) {
        console.error(`Error fetching cities for ${sName} / ${dName}:`, error?.message);
        return [];
      }

      return data as MasterCity[];
    },
    [`master-cities-${sName.toLowerCase().replace(/\s+/g, "_")}-${dName.toLowerCase().replace(/\s+/g, "_")}`],
    {
      revalidate: CACHE_TIERS.CLASS_A_STATIC,
      tags: ["master_locations"],
    }
  )();
});

/**
 * Fast Autocomplete & Fuzzy Trigram Search across all levels
 */
export async function searchLocations(query: string, limit = 20): Promise<MasterLocation[]> {
  const q = (query || "").trim();
  if (!q || q.length < 2) return [];

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("master_location")
    .select("id, state, union_territory, location_type, district, city_town, town_type, town_code, district_code, state_code, search_text, status, created_at, updated_at")
    .ilike("search_text", `%${q}%`)
    .eq("status", "active")
    .order("city_town", { ascending: true })
    .limit(limit);

  if (error || !data) {
    console.error(`Error searching locations for "${q}":`, error?.message);
    return [];
  }

  return data as MasterLocation[];
}

// ---------------------------------------------------------------------------
// Relational Hierarchy Queries (states, districts, cities, towns, villages)
// ---------------------------------------------------------------------------

/**
 * Fetch all States & UTs (Ordered by name)
 */
export const getRelationalStatesList = unstable_cache(
  async () => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("states")
      .select("id, name")
      .order("name", { ascending: true });

    if (error || !data) {
      console.error("Error fetching states:", error?.message);
      return [];
    }

    return data;
  },
  ["relational-states-list-v1"],
  {
    revalidate: CACHE_TIERS.CLASS_A_STATIC,
    tags: ["relational_locations"],
  }
);

/**
 * Fetch Districts for a specific state_id
 */
export const getRelationalDistrictsList = cache(async (stateId: number) => {
  if (!stateId || stateId <= 0) return [];

  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("districts")
        .select("id, state_id, name")
        .eq("state_id", stateId)
        .order("name", { ascending: true });

      if (error || !data) {
        console.error(`Error fetching districts for state ${stateId}:`, error?.message);
        return [];
      }

      return data;
    },
    [`relational-districts-state-${stateId}`],
    {
      revalidate: CACHE_TIERS.CLASS_A_STATIC,
      tags: ["relational_locations"],
    }
  )();
});

/**
 * Fetch Cities for a specific district_id
 */
export const getRelationalCitiesList = cache(async (districtId: number) => {
  if (!districtId || districtId <= 0) return [];

  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("cities")
        .select("id, district_id, name")
        .eq("district_id", districtId)
        .order("name", { ascending: true });

      if (error || !data) {
        console.error(`Error fetching cities for district ${districtId}:`, error?.message);
        return [];
      }

      return data;
    },
    [`relational-cities-dist-${districtId}`],
    {
      revalidate: CACHE_TIERS.CLASS_A_STATIC,
      tags: ["relational_locations"],
    }
  )();
});

/**
 * Fetch Towns for a specific district_id
 */
export const getRelationalTownsList = cache(async (districtId: number) => {
  if (!districtId || districtId <= 0) return [];

  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("towns")
        .select("id, district_id, name")
        .eq("district_id", districtId)
        .order("name", { ascending: true });

      if (error || !data) {
        console.error(`Error fetching towns for district ${districtId}:`, error?.message);
        return [];
      }

      return data;
    },
    [`relational-towns-dist-${districtId}`],
    {
      revalidate: CACHE_TIERS.CLASS_A_STATIC,
      tags: ["relational_locations"],
    }
  )();
});

/**
 * Fetch Villages for a specific district_id
 */
export const getRelationalVillagesList = cache(async (districtId: number) => {
  if (!districtId || districtId <= 0) return [];

  return unstable_cache(
    async () => {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("villages")
        .select("id, district_id, name")
        .eq("district_id", districtId)
        .order("name", { ascending: true });

      if (error || !data) {
        console.error(`Error fetching villages for district ${districtId}:`, error?.message);
        return [];
      }

      return data;
    },
    [`relational-villages-dist-${districtId}`],
    {
      revalidate: CACHE_TIERS.CLASS_A_STATIC,
      tags: ["relational_locations"],
    }
  )();
});
