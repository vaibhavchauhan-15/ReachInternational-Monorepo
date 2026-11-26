"use server";

import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifySession } from "@/lib/dal";
import { TAGS } from "@/lib/cache/tags";
import {
  NotificationListQuerySchema,
  NotificationMarkReadSchema,
  NotificationMarkAllReadSchema,
  type NotificationListQueryInput,
  type NotificationMarkReadInput,
  type NotificationMarkAllReadInput,
} from "@reachinternational/validation";
import type { NotificationListResult } from "@reachinternational/types";
import { sanitizeUserErrorMessage } from "@reachinternational/utils";

export interface NotificationActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Fetch next page of notifications via Server Action for client infinite scroll.
 */
export async function getNotificationsAction(
  input?: NotificationListQueryInput
): Promise<NotificationActionResult<NotificationListResult>> {
  try {
    const session = await verifySession();
    if (!session?.isAuth) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = NotificationListQuerySchema.parse(input || {});
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("notification_list", {
      p_cursor_created_at: parsed.cursor_created_at ?? null,
      p_cursor_id: parsed.cursor_id ?? null,
      p_limit: parsed.limit,
      p_filter: parsed.filter,
    });

    if (error) {
      return { success: false, error: sanitizeUserErrorMessage(error.message) };
    }

    const result = (data as NotificationListResult) ?? {
      items: [],
      next_cursor: null,
      has_more: false,
      unread_count: 0,
    };

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load notifications";
    return { success: false, error: sanitizeUserErrorMessage(message) };
  }
}

/**
 * Mark specified notification IDs as read.
 * Enforces recipient ownership in SQL and caps array size to 100.
 */
export async function markNotificationsReadAction(
  input: NotificationMarkReadInput
): Promise<NotificationActionResult<{ updated_count: number }>> {
  try {
    const session = await verifySession();
    if (!session?.isAuth) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = NotificationMarkReadSchema.parse(input);
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("notification_mark_read", {
      p_ids: parsed.notification_ids,
    });

    if (error) {
      return { success: false, error: sanitizeUserErrorMessage(error.message) };
    }

    // Revalidate notification cache tags
    try {
      revalidateTag(TAGS.notifications, "max");
      if (session.userId) {
        revalidateTag(TAGS.notificationList(session.userId), "max");
        revalidateTag(TAGS.notificationUnreadCount(session.userId), "max");
      }
    } catch {
      // ignore revalidation error outside request context
    }

    const count = (data as { updated_count?: number })?.updated_count ?? 0;
    return { success: true, data: { updated_count: count } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to mark notifications read";
    return { success: false, error: sanitizeUserErrorMessage(message) };
  }
}

/**
 * Mark all notifications as read up to an optional cursor cutoff.
 */
export async function markAllNotificationsReadAction(
  input?: NotificationMarkAllReadInput
): Promise<NotificationActionResult<{ updated_count: number }>> {
  try {
    const session = await verifySession();
    if (!session?.isAuth) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = NotificationMarkAllReadSchema.parse(input || {});
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc("notification_mark_all_read", {
      p_before_cursor: parsed.before_cursor ?? null,
    });

    if (error) {
      return { success: false, error: sanitizeUserErrorMessage(error.message) };
    }

    try {
      revalidateTag(TAGS.notifications, "max");
      if (session.userId) {
        revalidateTag(TAGS.notificationList(session.userId), "max");
        revalidateTag(TAGS.notificationUnreadCount(session.userId), "max");
      }
    } catch {
      // ignore revalidation error outside request context
    }

    const count = (data as { updated_count?: number })?.updated_count ?? 0;
    return { success: true, data: { updated_count: count } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to mark all read";
    return { success: false, error: sanitizeUserErrorMessage(message) };
  }
}
