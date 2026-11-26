"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { RealtimePostgresChangesPayload, RealtimeChannel } from "@supabase/supabase-js";
import { useCurrentUser } from "@/components/auth/CurrentUserContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { NotificationItem } from "@reachinternational/types";

export interface NotificationContextValue {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  realtimeNewItems: NotificationItem[];
  consumeRealtimeItems: () => void;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export interface NotificationProviderProps {
  children: React.ReactNode;
  initialUnreadCount?: number;
}

export function NotificationProvider({
  children,
  initialUnreadCount = 0,
}: NotificationProviderProps) {
  const { user } = useCurrentUser();
  const [unreadCount, setUnreadCount] = useState<number>(initialUnreadCount);
  const [realtimeNewItems, setRealtimeNewItems] = useState<NotificationItem[]>([]);

  // Sync unread count on mount and on visibility/focus
  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("notification_unread_count");
      if (!error && typeof data === "number") {
        setUnreadCount(data);
      }
    } catch {
      // ignore network errors during background sync
    }
  }, [user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUnreadCount();

    // Reconcile on tab focus / visibilitychange without polling storms
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshUnreadCount();
      }
    };

    window.addEventListener("focus", refreshUnreadCount);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshUnreadCount);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshUnreadCount]);

  // Centralized Realtime subscription: strictly 1 channel per authenticated user session.
  // Prevents multiple NotificationBell instances (e.g. mobile header + desktop sidebar)
  // from calling .on() on an already-subscribed RealtimeChannel.
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    const supabase = createSupabaseBrowserClient();
    const channelName = `notifications:inbox:${user.id}`;

    // Clean up any pre-existing or lingering channel with this name before subscribing
    const existingChannel = supabase.getChannels().find(
      (ch: RealtimeChannel) => ch.topic === `realtime:${channelName}` || ch.topic === channelName
    );
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (!isMounted) return;
          const newItem = payload.new as unknown as NotificationItem;
          setUnreadCount((prev) => prev + 1);
          setRealtimeNewItems((prev) => [newItem, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (!isMounted) return;
          const updated = payload.new as unknown as NotificationItem;
          const old = payload.old as unknown as Partial<NotificationItem>;
          // If was marked read
          if (updated.read_at && !old.read_at) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const consumeRealtimeItems = useCallback(() => {
    setRealtimeNewItems([]);
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount,
      setUnreadCount,
      realtimeNewItems,
      consumeRealtimeItems,
      refreshUnreadCount,
    }),
    [unreadCount, realtimeNewItems, consumeRealtimeItems, refreshUnreadCount]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    // Safe graceful fallback if rendered outside NotificationProvider
    return {
      unreadCount: 0,
      setUnreadCount: () => {},
      realtimeNewItems: [],
      consumeRealtimeItems: () => {},
      refreshUnreadCount: async () => {},
    };
  }
  return context;
}
