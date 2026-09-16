/**
 * ReachInternational Client Directory Query Key & Cache Architecture
 *
 * Provides a canonical, deterministic query-key and cache-key system
 * for the entire Client domain across Web (Next.js App Router RSC,
 * unstable_cache, Redis/KV) and Mobile (TanStack Query v5).
 *
 * Hierarchy:
 * clients
 * │
 * ├── clients:list:{filters}
 * ├── clients:detail:{id}
 * ├── clients:kpi:{filters}
 * ├── clients:search:{query}
 * ├── clients:locations:{filters}
 * └── clients:export:{filters}
 *
 * Rule: The cache key MUST contain every parameter affecting the result.
 */

// ─── Filter Parameter Interfaces ─────────────────────────────────────────────

export interface ClientDirectoryFilter {
  search?: string;
  status?: "all" | "active" | "inactive";
  city?: string;
  district?: string;
  state?: string;
  sort?: string;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  afterCursor?: string;
  beforeCursor?: string;
}

export interface ClientKPIFilter {
  status?: "all" | "active" | "inactive";
  city?: string;
  district?: string;
  state?: string;
}

export interface ClientLocationFilter {
  status?: "all" | "active" | "inactive";
  state?: string;
  district?: string;
}

export interface ClientSearchFilter {
  query: string;
  limit?: number;
  status?: "all" | "active" | "inactive";
}

// ─── Serialization & Normalization Helpers ───────────────────────────────────

function cleanParam(val?: string | number | null, defaultVal: string = "all"): string {
  if (val === undefined || val === null) return defaultVal;
  const s = String(val).trim();
  return s === "" ? defaultVal : s.toLowerCase();
}

declare const Buffer: any;

/**
 * Universal Base64URL encoder compatible with Browser, Node, and React Native.
 */
export function encodeClientCursor(sortValue: string | number | boolean, id: string): string {
  const payload = JSON.stringify({ v: sortValue, id });
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(payload, "utf-8").toString("base64url");
    }
    if (typeof btoa === "function") {
      return btoa(unescape(encodeURIComponent(payload)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    }
  } catch {
    // Fallback to URL encoding
  }
  return encodeURIComponent(payload);
}

/**
 * Universal Base64URL decoder compatible with Browser, Node, and React Native.
 */
export function decodeClientCursor(cursor: string): { sortValue: any; id: string } | null {
  try {
    let jsonStr = "";
    if (typeof Buffer !== "undefined") {
      jsonStr = Buffer.from(cursor, "base64url").toString("utf-8");
    } else if (typeof atob === "function") {
      let base64 = cursor.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      jsonStr = decodeURIComponent(escape(atob(base64)));
    } else {
      jsonStr = decodeURIComponent(cursor);
    }
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !parsed.id) return null;
    return { sortValue: parsed.v, id: parsed.id };
  } catch {
    return null;
  }
}

/**
 * Deterministically serializes a ClientDirectoryFilter into a canonical key.
 * Example output:
 * "status=active&search=paper&city=all&page=1&pageSize=10&sort=company_name&order=asc"
 */
export function serializeClientFilter(filter?: ClientDirectoryFilter): string {
  if (!filter) {
    return "status=all&search=all&city=all&district=all&state=all&page=1&pageSize=10&sort=company_name&order=asc";
  }

  const status = cleanParam(filter.status, "all");
  const city = cleanParam(filter.city, "all");
  const district = cleanParam(filter.district, "all");
  const state = cleanParam(filter.state, "all");
  const search = filter.search?.trim()
    ? filter.search.trim().toLowerCase().replace(/[:_&=]/g, "-")
    : "all";
  const sortField = cleanParam(filter.sort || filter.sortField, "company_name");
  const sortOrder = filter.sortOrder === "desc" ? "desc" : "asc";
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.max(1, Math.min(filter.pageSize ?? 10, 100));

  let key = `status=${status}&search=${search}&city=${city}&district=${district}&state=${state}&page=${page}&pageSize=${pageSize}&sort=${sortField}&order=${sortOrder}`;
  if (filter.afterCursor) {
    key += `&after=${filter.afterCursor}`;
  }
  if (filter.beforeCursor) {
    key += `&before=${filter.beforeCursor}`;
  }
  return key;
}

/**
 * Deterministically serializes a KPI filter into a canonical key.
 */
export function serializeClientKPIFilter(filter?: ClientKPIFilter): string {
  if (!filter || (!filter.status && !filter.city && !filter.district && !filter.state)) return "all";
  const status = cleanParam(filter.status, "all");
  const city = cleanParam(filter.city, "all");
  const district = cleanParam(filter.district, "all");
  const state = cleanParam(filter.state, "all");
  return `status=${status}&city=${city}&district=${district}&state=${state}`;
}

/**
 * Deterministically serializes a search query and options.
 * If default options are used, returns only the clean query: "paper" -> "paper"
 * which produces "clients:search:paper".
 */
export function serializeClientSearch(query: string, options?: { limit?: number; status?: string }): string {
  const cleanQuery = (query || "").trim().toLowerCase().replace(/[:_&=]/g, "-") || "none";
  const hasCustomLimit = options?.limit !== undefined && options.limit !== 10;
  const hasCustomStatus = options?.status && options.status !== "all";

  if (!hasCustomLimit && !hasCustomStatus) {
    return cleanQuery;
  }
  return `${cleanQuery}&limit=${options?.limit ?? 10}&status=${cleanParam(options?.status, "all")}`;
}

/**
 * Deterministically serializes a location filter.
 */
export function serializeClientLocationFilter(filter?: ClientLocationFilter): string {
  if (!filter || (!filter.status && !filter.state && !filter.district)) return "all";
  const status = cleanParam(filter.status, "all");
  const state = cleanParam(filter.state, "all");
  const district = cleanParam(filter.district, "all");
  return `status=${status}&state=${state}&district=${district}`;
}

// ─── Canonical String Cache Keys (For unstable_cache, Redis, KV) ─────────────

export const CLIENT_KEYS = {
  root: "clients",
  list: (filter?: ClientDirectoryFilter) => `clients:list:${serializeClientFilter(filter)}`,
  detail: (id: string) => `clients:detail:${id}`,
  detailSummary: (id: string) => `clients:detail:${id}:summary`,
  detailLocation: (id: string) => `clients:detail:${id}:location`,
  detailMachines: (id: string) => `clients:detail:${id}:machines`,
  detailRunningLogs: (id: string) => `clients:detail:${id}:running-logs`,
  detailAssignments: (id: string) => `clients:detail:${id}:assignments`,
  detailHistory: (id: string) => `clients:detail:${id}:history`,
  detailAudit: (id: string) => `clients:detail:${id}:audit`,
  kpi: (filter?: ClientKPIFilter) => `clients:kpi:${serializeClientKPIFilter(filter)}`,
  search: (query: string, options?: { limit?: number; status?: "all" | "active" | "inactive" }) =>
    `clients:search:${serializeClientSearch(query, options)}`,
  locations: (filter?: ClientLocationFilter) => `clients:locations:${serializeClientLocationFilter(filter)}`,
  export: (filter?: ClientDirectoryFilter) => `clients:export:${serializeClientFilter(filter)}`,
  // Progressive Location Hierarchy Keys (Class A Reference Data - Long TTL)
  locationHierarchy: {
    states: () => "locations:states" as const,
    districts: (stateId: number | string) => `locations:districts:${stateId}` as const,
    cities: (districtId: number | string) => `locations:cities:${districtId}` as const,
    towns: (districtId: number | string) => `locations:towns:${districtId}` as const,
    villages: (districtId: number | string, query?: string) =>
      `locations:villages:${districtId}:${query ? query.trim().toLowerCase() : "all"}` as const,
  },
} as const;

// ─── Array Keys (For TanStack Query v5 / React Query — Web & Mobile) ──────────

export const CLIENT_QUERY_KEYS = {
  all: ["clients"] as const,
  lists: () => [...CLIENT_QUERY_KEYS.all, "list"] as const,
  list: (filter?: ClientDirectoryFilter) =>
    [...CLIENT_QUERY_KEYS.lists(), serializeClientFilter(filter)] as const,
  kpis: (filter?: ClientKPIFilter) =>
    [...CLIENT_QUERY_KEYS.all, "kpi", serializeClientKPIFilter(filter)] as const,
  locations: (filter?: ClientLocationFilter) =>
    [...CLIENT_QUERY_KEYS.all, "locations", serializeClientLocationFilter(filter)] as const,
  details: () => [...CLIENT_QUERY_KEYS.all, "detail"] as const,
  detail: (id: string) => [...CLIENT_QUERY_KEYS.details(), id] as const,
  detailSummary: (id: string) => [...CLIENT_QUERY_KEYS.details(), id, "summary"] as const,
  detailLocation: (id: string) => [...CLIENT_QUERY_KEYS.details(), id, "location"] as const,
  detailMachines: (id: string) => [...CLIENT_QUERY_KEYS.details(), id, "machines"] as const,
  detailRunningLogs: (id: string) => [...CLIENT_QUERY_KEYS.details(), id, "running-logs"] as const,
  detailAssignments: (id: string) => [...CLIENT_QUERY_KEYS.details(), id, "assignments"] as const,
  detailHistory: (id: string) => [...CLIENT_QUERY_KEYS.details(), id, "history"] as const,
  detailAudit: (id: string) => [...CLIENT_QUERY_KEYS.details(), id, "audit"] as const,
  searches: () => [...CLIENT_QUERY_KEYS.all, "search"] as const,
  search: (query: string, options?: { limit?: number; status?: "all" | "active" | "inactive" }) =>
    [...CLIENT_QUERY_KEYS.searches(), serializeClientSearch(query, options)] as const,
  // Progressive Location Hierarchy Query Keys
  locationHierarchy: {
    states: () => ["locations", "states"] as const,
    districts: (stateId: number | string) => ["locations", "districts", String(stateId)] as const,
    cities: (districtId: number | string) => ["locations", "cities", String(districtId)] as const,
    towns: (districtId: number | string) => ["locations", "towns", String(districtId)] as const,
    villages: (districtId: number | string, query?: string) =>
      ["locations", "villages", String(districtId), query ? query.trim().toLowerCase() : "all"] as const,
  },
} as const;
