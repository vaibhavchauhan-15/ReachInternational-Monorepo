import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { State, District, City, Town, Village } from "@reachinternational/types";

export interface HierarchicalLocationSearchResult {
  id: number;
  name: string;
  type: "state" | "district" | "city" | "town" | "village";
  state_id?: number;
  state_name?: string;
  district_id?: number;
  district_name?: string;
}

/**
 * Cached fetch for all 36 States and Union Territories of India.
 * Payload: ~1 KB (36 items).
 * Static Cache: 24h / 86400s TTL.
 */
export const getStatesList = unstable_cache(
  async (): Promise<State[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("states")
      .select("id, name")
      .order("name", { ascending: true });

    if (error || !data) {
      console.error("Error fetching states:", error?.message || error);
      return [];
    }

    return data as State[];
  },
  ["locations:states:v2"],
  {
    revalidate: CACHE_TIERS.CLASS_A_STATIC, // 24 hours
    tags: [TAGS.clientsLocations, "locations"],
  }
);

/**
 * Cached fetch for Districts in a specific State (by state_id or state name).
 * Payload: ~1 KB (20–45 items).
 * Static Cache: 24h / 86400s TTL.
 */
export const getDistrictsList = cache(async (stateIdOrName: number | string): Promise<District[]> => {
  if (!stateIdOrName) return [];
  const stateKey = String(stateIdOrName).trim().toLowerCase().replace(/\s+/g, "_");
  const isNumeric = typeof stateIdOrName === "number" || /^\d+$/.test(String(stateIdOrName).trim());
  const stateId = isNumeric ? Number(stateIdOrName) : null;

  return unstable_cache(
    async (): Promise<District[]> => {
      const supabase = createSupabaseAdminClient();

      if (stateId !== null) {
        const { data, error } = await supabase
          .from("districts")
          .select("id, state_id, name")
          .eq("state_id", stateId)
          .order("name", { ascending: true });

        if (error || !data) {
          console.error(`Error fetching districts for state ID ${stateId}:`, error?.message || error);
          return [];
        }
        return data as District[];
      }

      // Lookup by state name
      const stateName = String(stateIdOrName).trim();
      const { data, error } = await supabase
        .from("districts")
        .select("id, state_id, name, states!inner(name)")
        .ilike("states.name", stateName)
        .order("name", { ascending: true });

      if (error || !data) {
        console.error(`Error fetching districts for state "${stateName}":`, error?.message || error);
        return [];
      }

      return data.map((d: any) => ({
        id: d.id,
        state_id: d.state_id,
        name: d.name,
      })) as District[];
    },
    [`locations:districts:${stateKey}:v2`],
    {
      revalidate: CACHE_TIERS.CLASS_A_STATIC,
      tags: [TAGS.clientsLocations, "locations"],
    }
  )();
});

/**
 * Cached fetch for Cities in a specific District (by district_id or district name).
 * Payload: < 1 KB (2–15 items).
 * Static Cache: 24h / 86400s TTL.
 */
export const getCitiesList = cache(async (districtIdOrName: number | string): Promise<City[]> => {
  if (!districtIdOrName) return [];
  const distKey = String(districtIdOrName).trim().toLowerCase().replace(/\s+/g, "_");
  const isNumeric = typeof districtIdOrName === "number" || /^\d+$/.test(String(districtIdOrName).trim());
  const districtId = isNumeric ? Number(districtIdOrName) : null;

  return unstable_cache(
    async (): Promise<City[]> => {
      const supabase = createSupabaseAdminClient();

      if (districtId !== null) {
        const { data, error } = await supabase
          .from("cities")
          .select("id, district_id, name")
          .eq("district_id", districtId)
          .order("name", { ascending: true });

        if (error || !data) {
          console.error(`Error fetching cities for district ID ${districtId}:`, error?.message || error);
          return [];
        }
        return data as City[];
      }

      // Lookup by district name
      const districtName = String(districtIdOrName).trim();
      const { data, error } = await supabase
        .from("cities")
        .select("id, district_id, name, districts!inner(name)")
        .ilike("districts.name", districtName)
        .order("name", { ascending: true });

      if (error || !data) {
        console.error(`Error fetching cities for district "${districtName}":`, error?.message || error);
        return [];
      }

      return data.map((c: any) => ({
        id: c.id,
        district_id: c.district_id,
        name: c.name,
      })) as City[];
    },
    [`locations:cities:${distKey}:v2`],
    {
      revalidate: CACHE_TIERS.CLASS_A_STATIC,
      tags: [TAGS.clientsLocations, "locations"],
    }
  )();
});

/**
 * Cached fetch for Towns in a specific District (by district_id or district name).
 * Payload: < 2 KB (5–30 items).
 * Static Cache: 24h / 86400s TTL.
 */
export const getTownsList = cache(async (districtIdOrName: number | string): Promise<Town[]> => {
  if (!districtIdOrName) return [];
  const distKey = String(districtIdOrName).trim().toLowerCase().replace(/\s+/g, "_");
  const isNumeric = typeof districtIdOrName === "number" || /^\d+$/.test(String(districtIdOrName).trim());
  const districtId = isNumeric ? Number(districtIdOrName) : null;

  return unstable_cache(
    async (): Promise<Town[]> => {
      const supabase = createSupabaseAdminClient();

      if (districtId !== null) {
        const { data, error } = await supabase
          .from("towns")
          .select("id, district_id, name")
          .eq("district_id", districtId)
          .order("name", { ascending: true });

        if (error || !data) {
          console.error(`Error fetching towns for district ID ${districtId}:`, error?.message || error);
          return [];
        }
        return data as Town[];
      }

      const districtName = String(districtIdOrName).trim();
      const { data, error } = await supabase
        .from("towns")
        .select("id, district_id, name, districts!inner(name)")
        .ilike("districts.name", districtName)
        .order("name", { ascending: true });

      if (error || !data) {
        console.error(`Error fetching towns for district "${districtName}":`, error?.message || error);
        return [];
      }

      return data.map((t: any) => ({
        id: t.id,
        district_id: t.district_id,
        name: t.name,
      })) as Town[];
    },
    [`locations:towns:${distKey}:v2`],
    {
      revalidate: CACHE_TIERS.CLASS_A_STATIC,
      tags: [TAGS.clientsLocations, "locations"],
    }
  )();
});

/**
 * Cached fetch for Villages in a specific District with optional sub-string search.
 * Enforces limit to never stream 640,000 villages to the browser.
 */
export const getVillagesList = cache(
  async (districtIdOrName: number | string, search?: string, limit = 50): Promise<Village[]> => {
    if (!districtIdOrName) return [];
    const distKey = String(districtIdOrName).trim().toLowerCase().replace(/\s+/g, "_");
    const cleanSearch = search ? search.trim().toLowerCase().replace(/[:_&=]/g, "-") : "all";
    const isNumeric = typeof districtIdOrName === "number" || /^\d+$/.test(String(districtIdOrName).trim());
    const districtId = isNumeric ? Number(districtIdOrName) : null;

    return unstable_cache(
      async (): Promise<Village[]> => {
        const supabase = createSupabaseAdminClient();

        let query = supabase.from("villages").select("id, district_id, name");

        if (districtId !== null) {
          query = query.eq("district_id", districtId);
        } else {
          query = query.ilike("districts.name", String(districtIdOrName).trim());
        }

        if (search && search.trim()) {
          query = query.ilike("name", `%${search.trim()}%`);
        }

        const { data, error } = await query.order("name", { ascending: true }).limit(limit);

        if (error || !data) {
          console.error(`Error fetching villages for district ${distKey}:`, error?.message || error);
          return [];
        }

        return data as Village[];
      },
      [`locations:villages:${distKey}:${cleanSearch}:${limit}:v2`],
      {
        revalidate: CACHE_TIERS.CLASS_A_STATIC,
        tags: [TAGS.clientsLocations, "locations"],
      }
    )();
  }
);

/**
 * Progressive fast autocomplete across States, Districts, and Cities/Towns.
 * Used for instant search across location hierarchy without downloading whole tables.
 */
export async function searchLocations(
  query: string,
  limit = 20
): Promise<HierarchicalLocationSearchResult[]> {
  const q = (query || "").trim();
  if (!q || q.length < 2) return [];

  const supabase = createSupabaseAdminClient();
  const safeQ = `%${q.replace(/[,()"\\]/g, "")}%`;

  const [statesRes, districtsRes, citiesRes] = await Promise.all([
    supabase.from("states").select("id, name").ilike("name", safeQ).limit(5),
    supabase
      .from("districts")
      .select("id, state_id, name, states(name)")
      .ilike("name", safeQ)
      .limit(10),
    supabase
      .from("cities")
      .select("id, district_id, name, districts(id, name, states(id, name))")
      .ilike("name", safeQ)
      .limit(10),
  ]);

  const results: HierarchicalLocationSearchResult[] = [];

  if (statesRes.data) {
    for (const s of statesRes.data) {
      results.push({
        id: s.id,
        name: s.name,
        type: "state",
        state_id: s.id,
        state_name: s.name,
      });
    }
  }

  if (districtsRes.data) {
    for (const d of districtsRes.data as any[]) {
      results.push({
        id: d.id,
        name: d.name,
        type: "district",
        state_id: d.state_id,
        state_name: d.states?.name || "",
        district_id: d.id,
        district_name: d.name,
      });
    }
  }

  if (citiesRes.data) {
    for (const c of citiesRes.data as any[]) {
      results.push({
        id: c.id,
        name: c.name,
        type: "city",
        state_id: c.districts?.states?.id,
        state_name: c.districts?.states?.name,
        district_id: c.district_id,
        district_name: c.districts?.name,
      });
    }
  }

  return results.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Backward-Compatible Aliases
// ---------------------------------------------------------------------------
export const getRelationalStatesList = getStatesList;
export const getRelationalDistrictsList = getDistrictsList;
export const getRelationalCitiesList = getCitiesList;
export const getRelationalTownsList = getTownsList;
export const getRelationalVillagesList = getVillagesList;
