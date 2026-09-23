import "server-only";
import { TAGS } from "./cache/tags";
import { CACHE_TIERS, OPERATIONS_CACHE_TIERS, OPERATIONS_CACHE_TTLS } from "./cache/policies";

export { TAGS, CACHE_TIERS, OPERATIONS_CACHE_TIERS, OPERATIONS_CACHE_TTLS };


/**
 * Legacy CACHE_TAGS map maintained for full backwards compatibility across existing code.
 */
export const CACHE_TAGS = {
  dashboard: TAGS.dashboard,
  dashboardKpis: TAGS.dashboardKpis,
  dashboardCharts: TAGS.dashboardCharts,
  dashboardDueLists: TAGS.dashboardDueLists,
  dashboardActivity: TAGS.dashboardActivity,
  machines: TAGS.machines,
  machinesList: TAGS.machinesList,
  machinesKpis: TAGS.machinesKpis,
  machineMeta: TAGS.machinesMeta,
  users: TAGS.users,
  settings: TAGS.settings,
  services: TAGS.services,
  categories: TAGS.categories,
  complaints: TAGS.complaints,
  machineDetail: TAGS.machineDetail,
  machineServices: TAGS.machineServices,
  userDashboard: TAGS.userDashboard,
  hourLogs: TAGS.hourLogs,
  assignments: TAGS.assignments,
  operations: TAGS.operations,
  operationsLogs: TAGS.operationsLogs,
  operationsAssignments: TAGS.operationsAssignments,
  operationsFilters: TAGS.operationsFilters,
  operationsSummaries: TAGS.operationsSummaries,
  operationLogDetail: TAGS.operationLogDetail,
  operationAssignmentDetail: TAGS.operationAssignmentDetail,
  clientOperations: TAGS.clientOperations,
  machineOperations: TAGS.machineOperations,
  operatorOperations: TAGS.operatorOperations,
  attendance: TAGS.attendance,
} as const;

export type CacheTag = string;