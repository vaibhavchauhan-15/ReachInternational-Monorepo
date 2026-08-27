import "server-only";
import { unstable_cache } from "next/cache";
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

/**
 * Wraps a data-fetching function in Next.js unstable_cache with a tag.
 * Usage:
 *   const getCached = cacheWithTag("dashboard", 60, async () => {...});
 */
export function cacheWithTag<T>(
  tag: string,
  revalidateSeconds: number,
  fetcher: () => Promise<T>
): () => Promise<T> {
  return unstable_cache(fetcher, [tag], {
    revalidate: revalidateSeconds,
    tags: [tag],
  });
}