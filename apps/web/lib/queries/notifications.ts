import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { NotificationListResult, NotificationListParams } from "@reachinternational/types";

/**
 * Fetch keyset-paginated notification items for the authenticated user.
 * Uses SECURITY DEFINER RPC notification_list with recipient-only scoping.
 */
export const getNotificationList = cache(
  async (params?: NotificationListParams): Promise<NotificationListResult> => {
    try {
      const supabase = await createSupabaseServerClient();
      const limit = Math.min(Math.max(params?.limit ?? 20, 1), 50);
      const filter = params?.filter ?? "all";

      const { data, error } = await supabase.rpc("notification_list", {
        p_cursor_created_at: params?.cursor_created_at ?? null,
        p_cursor_id: params?.cursor_id ?? null,
        p_limit: limit,
        p_filter: filter,
      });

      if (error) {
        console.error("[DAL] notification_list error:", error);
        return { items: [], next_cursor: null, has_more: false, unread_count: 0 };
      }

      return (
        (data as NotificationListResult) ?? {
          items: [],
          next_cursor: null,
          has_more: false,
          unread_count: 0,
        }
      );
    } catch (err) {
      console.error("[DAL] getNotificationList exception:", err);
      return { items: [], next_cursor: null, has_more: false, unread_count: 0 };
    }
  }
);

/**
 * Fetch indexed unread notification count for the authenticated user.
 * Capped at 100 on the database via partial index scan.
 */
export const getNotificationUnreadCount = cache(async (): Promise<number> => {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("notification_unread_count");

    if (error) {
      console.error("[DAL] notification_unread_count error:", error);
      return 0;
    }

    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.error("[DAL] getNotificationUnreadCount exception:", err);
    return 0;
  }
});
