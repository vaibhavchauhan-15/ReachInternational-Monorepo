import "server-only";
import { TAGS } from "./cache/tags";
import { CACHE_TIERS } from "./cache/policies";

export { TAGS, CACHE_TIERS };

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
  machineMeta: TAGS.machinesMeta,
  notifications: TAGS.notifications,
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
} as const;

export type CacheTag = string;