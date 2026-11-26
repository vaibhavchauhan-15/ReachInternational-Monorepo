"use client";

import React, { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { NotificationItem, NotificationCursor } from "@reachinternational/types";
import {
  getNotificationsAction,
  markNotificationsReadAction,
  markAllNotificationsReadAction,
} from "@/app/actions/notifications";
import { NotificationItemRow } from "./NotificationItemRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  CheckCheck,
  X,
  Bell,
  RefreshCw,
  ArrowUp,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
  unreadCount: number;
  onUnreadCountChange: (count: number | ((prev: number) => number)) => void;
  realtimeNewItems: NotificationItem[];
  onConsumeRealtimeItems: () => void;
}

export function NotificationPanel({
  isOpen,
  onClose,
  userRole,
  unreadCount,
  onUnreadCountChange,
  realtimeNewItems,
  onConsumeRealtimeItems,
}: NotificationPanelProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  // State
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<NotificationCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sentinelRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Initial load or filter change
  const loadInitialItems = useCallback(
    async (activeFilter: "all" | "unread") => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await getNotificationsAction({
          limit: 20,
          filter: activeFilter,
        });

        if (res.success && res.data) {
          setItems(res.data.items);
          setNextCursor(res.data.next_cursor);
          setHasMore(res.data.has_more);
        } else {
          setError(res.error || "Failed to load notifications");
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error fetching notifications");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Trigger load when opened or filter switches
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadInitialItems(filter);
    }
  }, [isOpen, filter, loadInitialItems]);

  // Keyset cursor pagination (infinite scroll)
  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) return;

    setIsLoadingMore(true);
    try {
      const res = await getNotificationsAction({
        limit: 20,
        filter,
        cursor_created_at: nextCursor.created_at,
        cursor_id: nextCursor.id,
      });

      if (res.success && res.data) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newUnique = res.data!.items.filter((i) => !existingIds.has(i.id));
          return [...prev, ...newUnique];
        });
        setNextCursor(res.data.next_cursor);
        setHasMore(res.data.has_more);
      }
    } catch {
      // ignore pagination fetch failure
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor, filter]);

  // Setup intersection observer on bottom sentinel
  useEffect(() => {
    if (!isOpen || !hasMore || isLoadingMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isOpen, hasMore, isLoadingMore, handleLoadMore]);

  // Optimistic Mark Read on Item Click
  const handleItemClick = useCallback(
    async (item: NotificationItem, targetUrl?: string) => {
      if (!item.read_at) {
        // Optimistic UI update
        const nowIso = new Date().toISOString();
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, read_at: nowIso } : i))
        );
        onUnreadCountChange((prev) => Math.max(0, prev - 1));

        // Background Server Action
        startTransition(async () => {
          try {
            await markNotificationsReadAction({ notification_ids: [item.id] });
          } catch {
            // rollback on critical failure if needed
          }
        });
      }

      // Navigate if allowed
      if (targetUrl) {
        onClose();
        router.push(targetUrl);
      }
    },
    [onUnreadCountChange, onClose, router]
  );

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0 && items.every((i) => !!i.read_at)) return;

    const prevItems = [...items];
    const prevCount = unreadCount;
    const nowIso = new Date().toISOString();

    // Optimistic UI
    setItems((prev) => prev.map((i) => ({ ...i, read_at: nowIso })));
    onUnreadCountChange(0);

    startTransition(async () => {
      try {
        const res = await markAllNotificationsReadAction({});
        if (!res.success) {
          // Rollback
          setItems(prevItems);
          onUnreadCountChange(prevCount);
        }
      } catch {
        setItems(prevItems);
        onUnreadCountChange(prevCount);
      }
    });
  }, [unreadCount, items, onUnreadCountChange]);

  // Insert realtime items smoothly
  const handleApplyRealtimeItems = useCallback(() => {
    if (realtimeNewItems.length === 0) return;

    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const fresh = realtimeNewItems.filter((i) => !existingIds.has(i.id));
      return [...fresh, ...prev];
    });
    onConsumeRealtimeItems();

    // Scroll container to top
    if (panelRef.current) {
      panelRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [realtimeNewItems, onConsumeRealtimeItems]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications inbox"
      aria-modal="true"
      className="flex flex-col h-full max-h-[85vh] sm:max-h-[600px] w-full bg-[var(--color-canvas)] overflow-hidden rounded-xl"
    >
      {/* Header Bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] select-none">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)] tracking-tight">
              Notifications
            </h3>
            <p className="text-[11px] text-[var(--color-mute)] font-mono">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mark all as read action */}
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || isPending}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
              unreadCount > 0
                ? "text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
                : "text-[var(--color-mute)] opacity-50 cursor-not-allowed"
            )}
            title="Mark all as read"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mark all read</span>
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notification panel"
            className="flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter Tabs Strip */}
      <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
            filter === "all"
              ? "bg-[var(--color-ink)] text-[var(--color-canvas)]"
              : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("unread")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
            filter === "unread"
              ? "bg-[var(--color-ink)] text-[var(--color-canvas)]"
              : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
          )}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span
              className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-bold font-mono",
                filter === "unread"
                  ? "bg-sky-400 text-sky-950"
                  : "bg-sky-500/20 text-sky-600 dark:text-sky-400"
              )}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Floating "N new notifications" non-shifting toast pill */}
      <AnimatePresence>
        {realtimeNewItems.length > 0 && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-20"
          >
            <button
              type="button"
              onClick={handleApplyRealtimeItems}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              <span>
                {realtimeNewItems.length}{" "}
                {realtimeNewItems.length === 1 ? "new alert" : "new alerts"} •
                Click to load
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable Notification List */}
      <div className="flex-1 overflow-y-auto overscroll-contain divide-y divide-[var(--color-hairline)] focus:outline-none">
        {isLoading ? (
          // Skeleton Loading
          <div className="p-3 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 items-start p-2">
                <Skeleton className="h-8.5 w-8.5 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          // Error State
          <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-[var(--color-ink)] max-w-xs">
              {error}
            </p>
            <button
              type="button"
              onClick={() => loadInitialItems(filter)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : items.length === 0 ? (
          // Empty State
          <div className="py-12 px-4">
            <EmptyState
              variant="empty"
              compact
              title={filter === "unread" ? "All caught up" : "No notifications"}
              description={
                filter === "unread"
                  ? "You have no unread notifications right now."
                  : "Important shift, machine, and approval updates will appear here."
              }
            />
          </div>
        ) : (
          // Notification Rows
          <>
            {items.map((item) => (
              <NotificationItemRow
                key={item.id}
                item={item}
                userRole={userRole}
                onItemClick={handleItemClick}
              />
            ))}

            {/* Pagination Sentinel */}
            <div ref={sentinelRef} className="h-4 w-full flex items-center justify-center py-2">
              {isLoadingMore && (
                <div className="flex items-center gap-1 text-[11px] text-[var(--color-mute)] font-mono">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Loading older...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
