"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getCurrentUserOrNull } from "@/lib/dal";
import { CACHE_TAGS, TAGS } from "@/lib/cache";

/**
 * Server Action to purge server cache tags and revalidate page routes.
 * This ensures that when the user swipes to refresh, fresh database values
 * are retrieved from Supabase and sent to the client via router.refresh().
 */
export async function refreshPageDataAction(path?: string, tag?: string) {
  try {
    const user = await getCurrentUserOrNull();

    if (tag) {
      revalidateTag(tag, "max");
    }

    if (path) {
      revalidatePath(path, "page");
    }

    // If authenticated, revalidate ONLY cache tags scoped to the current route domain
    if (user && path) {
      const cleanPath = path.toLowerCase().split("?")[0];
      const tagsToRevalidate: (string | undefined)[] = [];

      if (cleanPath.startsWith("/machines")) {
        tagsToRevalidate.push(
          CACHE_TAGS.machines,
          CACHE_TAGS.machinesList,
          CACHE_TAGS.machinesKpis,
          CACHE_TAGS.machineMeta
        );
      } else if (cleanPath.startsWith("/clients")) {
        tagsToRevalidate.push(
          TAGS.clients,
          TAGS.clientsList,
          TAGS.clientsKpis
        );
      } else if (cleanPath.startsWith("/users")) {
        tagsToRevalidate.push(
          CACHE_TAGS.users
        );
      } else if (cleanPath.startsWith("/operations")) {
        tagsToRevalidate.push(
          CACHE_TAGS.hourLogs,
          CACHE_TAGS.assignments,
          CACHE_TAGS.operationsLogs,
          CACHE_TAGS.operations
        );
      } else if (cleanPath === "/" || cleanPath.startsWith("/dashboard")) {
        tagsToRevalidate.push(
          CACHE_TAGS.dashboard,
          CACHE_TAGS.dashboardKpis,
          CACHE_TAGS.dashboardCharts,
          CACHE_TAGS.dashboardDueLists,
          CACHE_TAGS.dashboardActivity
        );
      }

      for (const t of tagsToRevalidate) {
        if (t) {
          try {
            revalidateTag(t, "max");
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
