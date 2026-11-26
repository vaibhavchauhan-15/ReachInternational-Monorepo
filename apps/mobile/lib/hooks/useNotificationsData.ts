/**
 * Native Mobile Notifications Server State & Data Access Hooks
 * Powered by TanStack Query for on-demand caching, keyset cursor pagination,
 * optimistic updates, offline resilience, and surgical invalidation.
 */

import { useCallback, useRef } from "react";
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { supabase } from "../supabase";
import { useAuth } from "../auth/useAuth";
import type {
  NotificationItem,
  NotificationListResult,
  NotificationCursor,
} from "@reachinternational/types";
import { haptics } from "../haptics";

export const NOTIFICATIONS_QUERY_KEYS = {
  all: ["notifications"] as const,
  lists: () => [...NOTIFICATIONS_QUERY_KEYS.all, "list"] as const,
  list: (userId?: string, filter?: "all" | "unread") =>
    [...NOTIFICATIONS_QUERY_KEYS.lists(), userId, filter ?? "all"] as const,
  unreadCount: (userId?: string) =>
    [...NOTIFICATIONS_QUERY_KEYS.all, "unread-count", userId] as const,
};

export interface NotificationsPageData {
  items: NotificationItem[];
  nextCursor: NotificationCursor | null;
  hasMore: boolean;
  unreadCount: number;
}

/**
 * Keyset-paginated infinite query for notifications feed.
 */
export function useNotificationsInfiniteList(filter: "all" | "unread" = "all") {
  const { user } = useAuth();
  const userId = user?.id;

  return useInfiniteQuery<NotificationsPageData, Error, InfiniteData<NotificationsPageData>, readonly unknown[], NotificationCursor | null>({
    queryKey: NOTIFICATIONS_QUERY_KEYS.list(userId, filter),
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as NotificationCursor | null;

      const { data, error } = await supabase.rpc("notification_list", {
        p_cursor_created_at: cursor?.created_at ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_limit: 20,
        p_filter: filter,
      });

      if (error) {
        throw new Error(error.message || "Failed to fetch notifications");
      }

      const res = data as NotificationListResult;
      return {
        items: res?.items ?? [],
        nextCursor: res?.next_cursor ?? null,
        hasMore: res?.has_more ?? false,
        unreadCount: res?.unread_count ?? 0,
      };
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    enabled: Boolean(userId),
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Lightweight cached unread count query.
 * Scans partial index WHERE read_at IS NULL (sub-0.1ms).
 */
export function useNotificationUnreadCount() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<number, Error>({
    queryKey: NOTIFICATIONS_QUERY_KEYS.unreadCount(userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("notification_unread_count");
      if (error) {
        console.warn("[Notifications] Error getting unread count:", error);
        return 0;
      }
      return typeof data === "number" ? data : 0;
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Optimistic mutation to mark one or more notification IDs as read.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (notificationIds.length === 0) return { updated_count: 0 };

      const { data, error } = await supabase.rpc("notification_mark_read", {
        p_ids: notificationIds,
      });

      if (error) {
        throw new Error(error.message || "Failed to mark notifications read");
      }

      return data as { updated_count: number };
    },
    onMutate: async (notificationIds: string[]) => {
      haptics.select();

      // Cancel any outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEYS.all });

      // Snapshot previous values
      const prevUnreadCount = queryClient.getQueryData<number>(
        NOTIFICATIONS_QUERY_KEYS.unreadCount(userId)
      );

      // Optimistically decrement unread count
      if (typeof prevUnreadCount === "number") {
        queryClient.setQueryData<number>(
          NOTIFICATIONS_QUERY_KEYS.unreadCount(userId),
          Math.max(0, prevUnreadCount - notificationIds.length)
        );
      }

      // Optimistically mark items read in all active list queries
      const targetIds = new Set(notificationIds);
      const nowIso = new Date().toISOString();

      queryClient.setQueriesData<InfiniteData<NotificationsPageData>>(
        { queryKey: NOTIFICATIONS_QUERY_KEYS.lists() },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                targetIds.has(item.id)
                  ? { ...item, is_read: true, read_at: nowIso }
                  : item
              ),
            })),
          };
        }
      );

      return { prevUnreadCount };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.prevUnreadCount !== undefined) {
        queryClient.setQueryData(
          NOTIFICATIONS_QUERY_KEYS.unreadCount(userId),
          context.prevUnreadCount
        );
      }
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEYS.all });
    },
    onSettled: () => {
      // Surgical background refresh
      queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_QUERY_KEYS.unreadCount(userId),
      });
    },
  });
}

/**
 * Optimistic mutation to mark all notifications as read.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("notification_mark_all_read", {
        p_before_cursor: null,
      });

      if (error) {
        throw new Error(error.message || "Failed to mark all as read");
      }

      return data as { updated_count: number };
    },
    onMutate: async () => {
      haptics.select();

      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEYS.all });

      const prevUnreadCount = queryClient.getQueryData<number>(
        NOTIFICATIONS_QUERY_KEYS.unreadCount(userId)
      );

      // Optimistically zero out unread count
      queryClient.setQueryData<number>(
        NOTIFICATIONS_QUERY_KEYS.unreadCount(userId),
        0
      );

      // Optimistically mark all cached items as read
      const nowIso = new Date().toISOString();
      queryClient.setQueriesData<InfiniteData<NotificationsPageData>>(
        { queryKey: NOTIFICATIONS_QUERY_KEYS.lists() },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => ({
                ...item,
                is_read: true,
                read_at: item.read_at || nowIso,
              })),
            })),
          };
        }
      );

      return { prevUnreadCount };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevUnreadCount !== undefined) {
        queryClient.setQueryData(
          NOTIFICATIONS_QUERY_KEYS.unreadCount(userId),
          context.prevUnreadCount
        );
      }
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEYS.all });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_QUERY_KEYS.unreadCount(userId),
      });
    },
  });
}
