/**
 * ReachInternational Operations Query Key & Cache Architecture
 *
 * Provides a canonical, hierarchical query-key and cache-key system
 * for the entire Operations domain across Web (Next.js App Router RSC,
 * unstable_cache, Redis, Edge) and Mobile (TanStack Query v5).
 *
 * Hierarchy:
 * operations
 * │
 * ├── logs
 * │   ├── machine
 * │   ├── client
 * │   └── operator
 * │
 * ├── assignments
 * │
 * ├── filters
 * │   ├── machines
 * │   ├── clients
 * │   └── operators
 * │
 * ├── summaries
 * │
 * └── details
 *     ├── log-detail
 *     └── assignment-detail
 *
 * Rule: The cache key MUST contain every parameter affecting the result.
 */

import { resolveOperationsDateRange } from "./operations-dates";

// ─── Filter Parameter Interfaces ─────────────────────────────────────────────

export interface OperationsMachineLogsFilter {
  machineId?: string;
  month?: string;
  customStart?: string;
  customEnd?: string;
  site?: string;
  shift?: string;
  breakdownOnly?: boolean;
  search?: string;
  sort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  page?: number;
  pageSize?: number;
  role?: string;
  scopedUserId?: string;
}

export interface OperationsClientLogsFilter {
  clientId?: string;
  site?: string;
  clientMachineId?: string;
  month?: string;
  customStart?: string;
  customEnd?: string;
  search?: string;
  sort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  page?: number;
  pageSize?: number;
  role?: string;
  scopedUserId?: string;
}

export interface OperationsOperatorLogsFilter {
  operatorId?: string;
  month?: string;
  customStart?: string;
  customEnd?: string;
  search?: string;
  sort?: "date-desc" | "date-asc" | "hours-desc" | "hours-asc" | "meter-desc" | "meter-asc" | string;
  page?: number;
  pageSize?: number;
  role?: string;
  scopedUserId?: string;
}

export interface OperationsAssignmentsFilter {
  filter?: "all" | "assigned" | "unassigned" | "full";
  search?: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

export interface OperationsSummaryFilter {
  scope?: "fleet" | "client" | "machine" | "operator";
  entityId?: string;
  site?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}

// ─── Phase 9: Single Normalized Filter Object ─────────────────────────────────

export interface NormalizedOperationsFilter {
  machineId?: string;
  clientId?: string;
  operatorId?: string;
  startDate?: string;
  endDate?: string;
  endDateInclusive?: string;
  endOperator?: "lt" | "lte";
  locationId?: string;
  search?: string;
  sort?: string;
  page: number;
  pageSize: number;
}

export interface RawOperationsFilterInput {
  viewMode?: "machine" | "client" | "operator";
  machineId?: string | null;
  clientId?: string | null;
  operatorId?: string | null;
  month?: string | null;
  customStart?: string | null;
  customEnd?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  locationId?: string | null;
  site?: string | null;
  search?: string | null;
  sort?: string | null;
  page?: number | string | null;
  pageSize?: number | string | null;
}

/**
 * Normalizes all 6 filter inputs (Machine, Client, Operator, Month, Custom Date, Location)
 * along with Search, Sort, Page, and PageSize into a single normalized filter object.
 * Enforces indexed date calculation and standard pagination slices.
 */
export function normalizeOperationsFilter(raw: RawOperationsFilterInput = {}): NormalizedOperationsFilter {
  // 1. Resolve entity IDs
  const cleanId = (id?: string | null) => {
    if (!id || id === "all" || id === "undefined" || id === "null") return undefined;
    const trimmed = String(id).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const machineId = cleanId(raw.machineId);
  const clientId = cleanId(raw.clientId);
  const operatorId = cleanId(raw.operatorId);

  // 2. Resolve date range from month, custom dates, or direct bounds
  const dateRange = resolveOperationsDateRange({
    month: raw.month,
    customStart: raw.customStart,
    customEnd: raw.customEnd,
    startDate: raw.startDate,
    endDate: raw.endDate,
  });
  const startDate = dateRange.startDate || undefined;
  const endDate = dateRange.endDate || undefined;
  const endDateInclusive = dateRange.endDateInclusive || undefined;
  const endOperator = dateRange.endOperator;

  // 3. Resolve location / site
  const rawLoc = raw.locationId || raw.site;
  const locationId = cleanId(rawLoc);

  // 4. Resolve search
  const rawSearch = raw.search ? String(raw.search).trim() : undefined;
  const search = rawSearch && rawSearch.length > 0 ? rawSearch : undefined;

  // 5. Resolve sort
  const sort = raw.sort && String(raw.sort).trim().length > 0 ? String(raw.sort).trim() : "date-desc";

  // 6. Resolve pagination
  const page = Math.max(1, Number(raw.page) || 1);
  const parsedPageSize = Number(raw.pageSize);
  const pageSize = [10, 20, 25, 50].includes(parsedPageSize) ? parsedPageSize : 20;

  return {
    machineId,
    clientId,
    operatorId,
    startDate,
    endDate,
    endDateInclusive,
    endOperator,
    locationId,
    search,
    sort,
    page,
    pageSize,
  };
}

/**
 * Deterministic serializer for the single normalized filter object.
 * Produces collision-free query cache keys for instant lookup.
 */
export function serializeNormalizedOperationsFilter(filter: NormalizedOperationsFilter): string {
  const m = filter.machineId || "all";
  const c = filter.clientId || "all";
  const op = filter.operatorId || "all";
  const s = filter.startDate || "none";
  const e = filter.endDate || "none";
  const loc = filter.locationId ? filter.locationId.replace(/[,:()"\\]/g, "") : "all";
  const q = filter.search ? filter.search.replace(/[,:()"\\]/g, "").trim().toLowerCase() : "none";
  const sort = filter.sort || "date-desc";
  const p = filter.page;
  const ps = filter.pageSize;

  return `norm:m_${m}:c_${c}:op_${op}:s_${s}:e_${e}:loc_${loc}:q_${q}:sort_${sort}:p_${p}:ps_${ps}`;
}

// ─── Serialization & Normalization Helpers ───────────────────────────────────

function cleanParam(val?: string | number | null, defaultVal: string = "all"): string {
  if (val === undefined || val === null) return defaultVal;
  const s = String(val).trim();
  return s.length > 0 ? s : defaultVal;
}

function cleanSearchParam(search?: string): string {
  if (!search) return "none";
  const cleaned = search.replace(/[,()"\n\r\\]/g, "").trim().toLowerCase();
  return cleaned.length > 0 ? cleaned : "none";
}

function cleanDateParam(dateStr?: string): string {
  if (!dateStr) return "none";
  const trimmed = dateStr.trim();
  return trimmed.length > 0 ? trimmed : "none";
}

/**
 * Deterministic serializer for machine running hours log filters.
 */
export function serializeMachineLogsFilter(filters: OperationsMachineLogsFilter = {}): string {
  const machineId = cleanParam(filters.machineId, "all");
  const month = cleanParam(filters.month, "current");
  const start = cleanDateParam(filters.customStart);
  const end = cleanDateParam(filters.customEnd);
  const site = cleanParam(filters.site, "all");
  const shift = cleanParam(filters.shift, "all");
  const bkd = filters.breakdownOnly ? "1" : "0";
  const search = cleanSearchParam(filters.search);
  const sort = filters.sort || "date-desc";
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.max(1, Number(filters.pageSize) || 20);
  const role = cleanParam(filters.role, "all");
  const scopedUserId = cleanParam(filters.scopedUserId, "all");

  return `m_${machineId}:mth_${month}:s_${start}:e_${end}:site_${site}:sh_${shift}:bkd_${bkd}:q_${search}:sort_${sort}:p_${page}:ps_${pageSize}:r_${role}:u_${scopedUserId}`;
}

/**
 * Deterministic serializer for client running hours log filters.
 */
export function serializeClientLogsFilter(filters: OperationsClientLogsFilter = {}): string {
  const clientId = cleanParam(filters.clientId, "all");
  const site = cleanParam(filters.site, "all");
  const clientMachineId = cleanParam(filters.clientMachineId, "all");
  const month = cleanParam(filters.month, "current");
  const start = cleanDateParam(filters.customStart);
  const end = cleanDateParam(filters.customEnd);
  const search = cleanSearchParam(filters.search);
  const sort = filters.sort || "date-desc";
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.max(1, Number(filters.pageSize) || 20);
  const role = cleanParam(filters.role, "all");
  const scopedUserId = cleanParam(filters.scopedUserId, "all");

  return `c_${clientId}:site_${site}:cm_${clientMachineId}:mth_${month}:s_${start}:e_${end}:q_${search}:sort_${sort}:p_${page}:ps_${pageSize}:r_${role}:u_${scopedUserId}`;
}

/**
 * Deterministic serializer for operator running hours log filters.
 */
export function serializeOperatorLogsFilter(filters: OperationsOperatorLogsFilter = {}): string {
  const operatorId = cleanParam(filters.operatorId, "all");
  const month = cleanParam(filters.month, "current");
  const start = cleanDateParam(filters.customStart);
  const end = cleanDateParam(filters.customEnd);
  const search = cleanSearchParam(filters.search);
  const sort = filters.sort || "date-desc";
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.max(1, Number(filters.pageSize) || 20);
  const role = cleanParam(filters.role, "all");
  const scopedUserId = cleanParam(filters.scopedUserId, "all");

  return `op_${operatorId}:mth_${month}:s_${start}:e_${end}:q_${search}:sort_${sort}:p_${page}:ps_${pageSize}:r_${role}:u_${scopedUserId}`;
}

/**
 * Deterministic serializer for machine assignments roster filters.
 */
export function serializeAssignmentsFilter(filters: OperationsAssignmentsFilter = {}): string {
  const filter = filters.filter || "all";
  const search = cleanSearchParam(filters.search);
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.max(1, Number(filters.pageSize) || 20);
  const sortField = cleanParam(filters.sortField, "machine_id");
  const sortOrder = filters.sortOrder || "asc";

  return `st_${filter}:q_${search}:p_${page}:ps_${pageSize}:sf_${sortField}:so_${sortOrder}`;
}

/**
 * Deterministic serializer for operational KPI summary metrics.
 */
export function serializeSummaryFilter(filters: OperationsSummaryFilter = {}): string {
  const scope = filters.scope || "fleet";
  const entityId = cleanParam(filters.entityId, "all");
  const site = cleanParam(filters.site, "all");
  const month = cleanParam(filters.month, "current");
  const start = cleanDateParam(filters.startDate);
  const end = cleanDateParam(filters.endDate);

  return `scope_${scope}:e_${entityId}:site_${site}:mth_${month}:s_${start}:e_${end}`;
}

// ─── 1. String Key Builders (unstable_cache, Redis, Edge, Logging) ───────────

export const OPERATIONS_KEYS = {
  // Root domain namespace
  root: "operations",

  // 1. Logs Sub-domain
  logs: {
    root: "operations:logs",
    machine: (filters?: OperationsMachineLogsFilter) =>
      `operations:logs:machine:${serializeMachineLogsFilter(filters)}`,
    client: (filters?: OperationsClientLogsFilter) =>
      `operations:logs:client:${serializeClientLogsFilter(filters)}`,
    operator: (filters?: OperationsOperatorLogsFilter) =>
      `operations:logs:operator:${serializeOperatorLogsFilter(filters)}`,
  },

  // 2. Assignments Sub-domain
  assignments: (filters?: OperationsAssignmentsFilter) =>
    `operations:assignments:${serializeAssignmentsFilter(filters)}`,

  // 3. Filters Sub-domain
  filters: {
    root: "operations:filters",
    machines: () => "operations:filters:machines",
    clients: () => "operations:filters:clients",
    operators: () => "operations:filters:operators",
    sites: (clientId: string) => `operations:filters:sites:${cleanParam(clientId, "all")}`,
  },

  // 4. Summaries Sub-domain
  summaries: (filters?: OperationsSummaryFilter) =>
    `operations:summaries:${serializeSummaryFilter(filters)}`,

  // 5. Details Sub-domain
  details: {
    root: "operations:details",
    log: (id: string) => `operations:log-detail:${cleanParam(id, "unknown")}`,
    logSummary: (id: string) => `operations:log-summary:${cleanParam(id, "unknown")}`,
    logDetails: (id: string) => `operations:log-details:${cleanParam(id, "unknown")}`,
    logHistory: (id: string) => `operations:log-history:${cleanParam(id, "unknown")}`,
    logAssignments: (id: string) => `operations:log-assignments:${cleanParam(id, "unknown")}`,
    logAudit: (id: string) => `operations:log-audit:${cleanParam(id, "unknown")}`,
    assignment: (id: string) => `operations:assignment-detail:${cleanParam(id, "unknown")}`,
  },

  // 6. Normalized Filter (Phase 9 Single Filter Architecture)
  normalized: (filters: NormalizedOperationsFilter) =>
    `operations:normalized:${serializeNormalizedOperationsFilter(filters)}`,
} as const;

// ─── 2. Array Key Builders (TanStack Query v5 for Mobile & Web Client) ────────

export const OPERATIONS_QUERY_KEYS = {
  all: ["operations"] as const,

  logs: {
    all: ["operations", "logs"] as const,
    machine: (filters?: OperationsMachineLogsFilter) =>
      ["operations", "logs", "machine", {
        machineId: cleanParam(filters?.machineId, "all"),
        month: cleanParam(filters?.month, "current"),
        customStart: cleanDateParam(filters?.customStart),
        customEnd: cleanDateParam(filters?.customEnd),
        search: cleanSearchParam(filters?.search),
        sort: filters?.sort || "date-desc",
        page: Math.max(1, Number(filters?.page) || 1),
        pageSize: Math.max(1, Number(filters?.pageSize) || 10),
        role: cleanParam(filters?.role, "all"),
        scopedUserId: cleanParam(filters?.scopedUserId, "all"),
      }] as const,
    client: (filters?: OperationsClientLogsFilter) =>
      ["operations", "logs", "client", {
        clientId: cleanParam(filters?.clientId, "all"),
        site: cleanParam(filters?.site, "all"),
        clientMachineId: cleanParam(filters?.clientMachineId, "all"),
        month: cleanParam(filters?.month, "current"),
        customStart: cleanDateParam(filters?.customStart),
        customEnd: cleanDateParam(filters?.customEnd),
        search: cleanSearchParam(filters?.search),
        sort: filters?.sort || "date-desc",
        page: Math.max(1, Number(filters?.page) || 1),
        pageSize: Math.max(1, Number(filters?.pageSize) || 10),
        role: cleanParam(filters?.role, "all"),
        scopedUserId: cleanParam(filters?.scopedUserId, "all"),
      }] as const,
    operator: (filters?: OperationsOperatorLogsFilter) =>
      ["operations", "logs", "operator", {
        operatorId: cleanParam(filters?.operatorId, "all"),
        month: cleanParam(filters?.month, "current"),
        customStart: cleanDateParam(filters?.customStart),
        customEnd: cleanDateParam(filters?.customEnd),
        search: cleanSearchParam(filters?.search),
        sort: filters?.sort || "date-desc",
        page: Math.max(1, Number(filters?.page) || 1),
        pageSize: Math.max(1, Number(filters?.pageSize) || 10),
        role: cleanParam(filters?.role, "all"),
        scopedUserId: cleanParam(filters?.scopedUserId, "all"),
      }] as const,
  },

  assignments: {
    all: ["operations", "assignments"] as const,
    list: (filters?: OperationsAssignmentsFilter) =>
      ["operations", "assignments", {
        filter: filters?.filter || "all",
        search: cleanSearchParam(filters?.search),
        page: Math.max(1, Number(filters?.page) || 1),
        pageSize: Math.max(1, Number(filters?.pageSize) || 20),
        sortField: cleanParam(filters?.sortField, "machine_id"),
        sortOrder: filters?.sortOrder || "asc",
      }] as const,
  },

  filters: {
    all: ["operations", "filters"] as const,
    machines: () => ["operations", "filters", "machines"] as const,
    clients: () => ["operations", "filters", "clients"] as const,
    operators: () => ["operations", "filters", "operators"] as const,
    sites: (clientId: string) =>
      ["operations", "filters", "sites", cleanParam(clientId, "all")] as const,
  },

  summaries: {
    all: ["operations", "summaries"] as const,
    filtered: (filters?: OperationsSummaryFilter) =>
      ["operations", "summaries", {
        scope: filters?.scope || "fleet",
        entityId: cleanParam(filters?.entityId, "all"),
        site: cleanParam(filters?.site, "all"),
        month: cleanParam(filters?.month, "current"),
        startDate: cleanDateParam(filters?.startDate),
        endDate: cleanDateParam(filters?.endDate),
      }] as const,
  },

  details: {
    all: ["operations", "details"] as const,
    log: (id: string) => ["operations", "details", "log", cleanParam(id, "unknown")] as const,
    logSummary: (id: string) => ["operations", "details", "log-summary", cleanParam(id, "unknown")] as const,
    logDetails: (id: string) => ["operations", "details", "log-details", cleanParam(id, "unknown")] as const,
    logHistory: (id: string) => ["operations", "details", "log-history", cleanParam(id, "unknown")] as const,
    logAssignments: (id: string) => ["operations", "details", "log-assignments", cleanParam(id, "unknown")] as const,
    logAudit: (id: string) => ["operations", "details", "log-audit", cleanParam(id, "unknown")] as const,
    assignment: (id: string) =>
      ["operations", "details", "assignment", cleanParam(id, "unknown")] as const,
  },

  // 6. Normalized Filter (Phase 9 Single Filter Architecture)
  normalized: (filters: NormalizedOperationsFilter) =>
    ["operations", "normalized", filters] as const,
} as const;

// ─── 3. Volatility-Based Cache TTL Policies (in Seconds) ──────────────────────

/**
 * Operations Domain Cache TTL Policies (in Seconds)
 * Derived strictly from data volatility:
 * - Machine filter options: 30m–24h -> 1800s (30m) [Very Low Volatility]
 * - Client filter options: 5–30m -> 900s (15m) [Low-Medium Volatility]
 * - Operator filter options: 5–15m -> 600s (10m) [Medium Volatility]
 * - Machine logs: 30–60s -> 45s [High Volatility]
 * - Client logs: 30–60s -> 45s [High Volatility]
 * - Operator logs: 30–60s -> 45s [High Volatility]
 * - Assignment list: 15–30s -> 20s [Very High Volatility]
 * - Log Details: 30–60s -> 60s [Medium Volatility]
 * - Log History: 15–30s -> 20s [High / Dynamic Volatility]
 * - Assignment History: 15–30s -> 20s [High Volatility]
 * - Log Assignments: 15–30s -> 20s [High Volatility]
 * - Log Audit: 15–30s -> 20s [High Volatility]
 */
export const OPERATIONS_CACHE_TTLS = {
  /** Machine filter dropdown options (30m–24h) - very low volatility asset catalog */
  filterMachines: 1800,

  /** Client filter dropdown options (5–30m) - low/medium volatility CRM client list */
  filterClients: 900,

  /** Operator filter dropdown options (5–15m) - medium volatility staff roster */
  filterOperators: 600,

  /** Machine running logs feed (30–60s) - high volatility shift entries */
  machineLogs: 45,

  /** Client running logs feed (30–60s) - high volatility client deployment logs */
  clientLogs: 45,

  /** Operator running logs feed (30–60s) - high volatility operator shift logs */
  operatorLogs: 45,

  /** Active operator-machine assignment roster (15–30s) - very high volatility 24/7 coverage */
  assignmentsList: 20,

  /** Log Detail snapshot (30–60s) - semi-stable record with full specs and remarks */
  logDetails: 60,

  /** Log History meter continuity sequence (15–30s) - dynamic sequence of adjacent logs */
  logHistory: 20,

  /** Machine assignment history sequence (15–30s) - dynamic sequence of historical pairings */
  assignmentHistory: 20,

  /** Active shift coverage personnel for a specific log (15–30s) */
  logAssignments: 20,

  /** Audit log trail of submissions and revisions (15–30s) */
  logAudit: 20,
} as const;

export type OperationsCacheTtlKey = keyof typeof OPERATIONS_CACHE_TTLS;

