import "server-only";

export * from "@reachinternational/utils";
export { OPERATIONS_CACHE_TIERS } from "@/lib/cache/policies";


/**
 * Operations Server Cache Tags & Granular Revalidation Helpers
 * Used with Next.js revalidateTag() across operations mutations.
 */
export const OPERATIONS_CACHE_TAGS = {
  // Domain Root
  operations: "operations",

  // Sub-domains
  logs: "operations:logs",
  assignments: "operations:assignments",
  filters: "operations:filters",
  summaries: "operations:summaries",

  // Granular Entity Tags
  logDetail: (id: string) => `operations:log-detail:${id}`,
  logSummary: (id: string) => `operations:log-summary:${id}`,
  logDetails: (id: string) => `operations:log-details:${id}`,
  logHistory: (id: string) => `operations:log-history:${id}`,
  logAssignments: (id: string) => `operations:log-assignments:${id}`,
  logAudit: (id: string) => `operations:log-audit:${id}`,
  assignmentDetail: (id: string) => `operations:assignment-detail:${id}`,
  clientLogs: (clientId: string) => `operations:client:${clientId}`,
  machineLogs: (machineId: string) => `operations:machine:${machineId}`,
  operatorLogs: (operatorId: string) => `operations:operator:${operatorId}`,
} as const;

export type OperationsCacheTag =
  | (typeof OPERATIONS_CACHE_TAGS)[keyof Omit<
      typeof OPERATIONS_CACHE_TAGS,
      "logDetail" | "assignmentDetail" | "clientLogs" | "machineLogs" | "operatorLogs"
    >]
  | string;
