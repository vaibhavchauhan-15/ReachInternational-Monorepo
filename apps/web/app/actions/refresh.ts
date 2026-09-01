"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUserOrNull } from "@/lib/dal";
import { CACHE_TAGS } from "@/lib/cache";

/**
 * Server Action to purge server cache tags and revalidate page routes.
 * This ensures that when the user swipes to refresh, fresh database values
 * are retrieved from Supabase and sent to the client via router.refresh().
 */
export async function refreshPageDataAction(path?: string, tag?: string) {
  try {
    const user = await getCurrentUserOrNull();

    if (tag) {
      revalidateTag(tag, "default");
    }

    if (path) {
      revalidatePath(path, "page");
    }

    // If authenticated, revalidate all core domain and operational cache tags
    if (user) {
      const tagsToRevalidate = [
        CACHE_TAGS.dashboard,
        CACHE_TAGS.dashboardKpis,
        CACHE_TAGS.dashboardCharts,
        CACHE_TAGS.dashboardDueLists,
        CACHE_TAGS.dashboardActivity,
        CACHE_TAGS.machines,
        CACHE_TAGS.machineMeta,
        CACHE_TAGS.services,
        CACHE_TAGS.complaints,
        CACHE_TAGS.notifications,
        CACHE_TAGS.users,
        CACHE_TAGS.hourLogs,
        CACHE_TAGS.assignments,
        CACHE_TAGS.categories,
      ];

      for (const t of tagsToRevalidate) {
        if (t) {
          try {
            revalidateTag(t, "default");
          } catch {
            // Ignore tag revalidation issues if individual tag is missing
          }
        }
      }
    }

    return { success: true, timestamp: Date.now() };
  } catch (error) {
    console.error("Failed to revalidate cache:", error);
    return { success: false, error: "Failed to revalidate cache" };
  }
}
