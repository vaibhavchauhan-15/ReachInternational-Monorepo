"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache";

/**
 * Server Action to purge server cache tags and revalidate page routes.
 * This ensures that when the user clicks 'Refresh', fresh database values
 * are retrieved from Supabase and sent to the client via router.refresh().
 */
export async function refreshPageDataAction(path?: string, tag?: string) {
  try {
    if (tag) {
      revalidateTag(tag, "default");
    }

    if (path) {
      revalidatePath(path, "page");
    } else {
      // Revalidate main app tags if no specific path/tag provided
      revalidateTag(CACHE_TAGS.dashboard, "default");
      revalidateTag(CACHE_TAGS.dashboardKpis, "default");
      revalidateTag(CACHE_TAGS.dashboardCharts, "default");
      revalidateTag(CACHE_TAGS.dashboardDueLists, "default");
      revalidateTag(CACHE_TAGS.dashboardActivity, "default");
      revalidateTag(CACHE_TAGS.machines, "default");
      revalidateTag(CACHE_TAGS.services, "default");
      revalidateTag(CACHE_TAGS.notifications, "default");
      revalidateTag(CACHE_TAGS.users, "default");
      revalidateTag(CACHE_TAGS.machineMeta, "default");
    }

    return { success: true, timestamp: Date.now() };
  } catch (error) {
    console.error("Failed to revalidate cache:", error);
    return { success: false, error: "Failed to revalidate cache" };
  }
}
