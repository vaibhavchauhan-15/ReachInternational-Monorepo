import "server-only";

/**
 * ReachInternational Multi-Layer Performance Architecture
 * Data Freshness Policies & Revalidation Time Tiers (in Seconds)
 */
export const CACHE_TIERS = {
  /** Class A: Static / Slow-Changing Data (24 hours) - Categories, Tax Types, System Settings */
  CLASS_A_STATIC: 86400,

  /** Class A: Reference Taxonomies (1 hour) - Branches, Departments, Document Types, Manufacturers */
  CLASS_A_REFERENCE: 3600,

  /** Class B: Semi-Dynamic Directories (2 minutes) - Client Directory, Vendor Directory, Employee Directory */
  CLASS_B_DIRECTORY: 120,

  /** Class B: Catalogs & Summaries (5 minutes) - Product Catalog, Heavy Report Summaries */
  CLASS_B_CATALOG: 300,

  /** Class B: Machine Fleet Directory (1 minute) - Machine Directory, Model Specs */
  CLASS_B_FLEET: 60,

  /** Class C: Operational Data (15 seconds) - Complaints, Service Jobs, Service Dashboard Summaries */
  CLASS_C_OPERATIONAL: 15,

  /** Class D: Realtime / Critical Data (0 seconds / Fresh) - Stock Balance, PO Approvals, Meter Logs, Audit Logs */
  CLASS_D_FRESH: 0,
} as const;

export type CacheTierKey = keyof typeof CACHE_TIERS;

import { OPERATIONS_CACHE_TTLS } from "@reachinternational/utils";

export { OPERATIONS_CACHE_TTLS, type OperationsCacheTtlKey } from "@reachinternational/utils";

/**
 * Operations Domain Cache Tiers (PHASE 15 — Cache Strategy)
 * Explicit volatility-calibrated revalidation times (in Seconds)
 */
export const OPERATIONS_CACHE_TIERS = {
  /** Machine filter options: 30m–24h -> 1800s (30m) */
  FILTER_MACHINES: OPERATIONS_CACHE_TTLS.filterMachines,

  /** Client filter options: 5–30m -> 900s (15m) */
  FILTER_CLIENTS: OPERATIONS_CACHE_TTLS.filterClients,

  /** Operator filter options: 5–15m -> 600s (10m) */
  FILTER_OPERATORS: OPERATIONS_CACHE_TTLS.filterOperators,

  /** Machine logs: 30–60s -> 45s */
  MACHINE_LOGS: OPERATIONS_CACHE_TTLS.machineLogs,

  /** Client logs: 30–60s -> 45s */
  CLIENT_LOGS: OPERATIONS_CACHE_TTLS.clientLogs,

  /** Operator logs: 30–60s -> 45s */
  OPERATOR_LOGS: OPERATIONS_CACHE_TTLS.operatorLogs,

  /** Assignment list: 15–30s -> 20s */
  ASSIGNMENT_LIST: OPERATIONS_CACHE_TTLS.assignmentsList,

  /** Details: 30–60s -> 60s */
  LOG_DETAILS: OPERATIONS_CACHE_TTLS.logDetails,

  /** History: 15–30s -> 20s */
  LOG_HISTORY: OPERATIONS_CACHE_TTLS.logHistory,

  /** Machine Assignment History: 15–30s -> 20s */
  ASSIGNMENT_HISTORY: OPERATIONS_CACHE_TTLS.assignmentHistory,

  /** Log Assignments: 15–30s -> 20s */
  LOG_ASSIGNMENTS: OPERATIONS_CACHE_TTLS.logAssignments,

  /** Log Audit: 15–30s -> 20s */
  LOG_AUDIT: OPERATIONS_CACHE_TTLS.logAudit,
} as const;

export type OperationsCacheTierKey = keyof typeof OPERATIONS_CACHE_TIERS;

