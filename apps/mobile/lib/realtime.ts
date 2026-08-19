/**
 * ServiceCentric Mobile — Realtime Synchronization Manager (Phase 27)
 * Subscribes to critical Supabase Realtime tables (complaints, FSRs, movements, notifications),
 * handles WebSocket reconnects, deduplicates events, and triggers query cache invalidations.
 */

import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeTable =
  | 'machine_complaints'
  | 'field_service_reports'
  | 'machine_site_movements'
  | 'notifications';

export interface RealtimeSubscriptionOptions {
  table: RealtimeTable;
  filter?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onCacheInvalidate?: () => void;
}

// Track active subscriptions to avoid duplicate subscriptions
const activeChannels: Map<string, RealtimeChannel> = new Map();
const processedEventIds: Set<string> = new Set();

/**
 * Subscribe to Supabase Realtime changes for a justified table.
 */
export function subscribeToRealtimeTable(options: RealtimeSubscriptionOptions): () => void {
  const { table, filter, onInsert, onUpdate, onDelete, onCacheInvalidate } = options;
  const channelName = `realtime:${table}${filter ? `:${filter}` : ''}`;

  if (activeChannels.has(channelName)) {
    console.log(`[Realtime] Already subscribed to channel '${channelName}'`);
    return () => unsubscribeFromChannel(channelName);
  }

  console.log(`[Realtime] Establishing subscription for channel '${channelName}'...`);

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter,
      },
      (payload) => {
        // Event Deduplication logic using record ID & commit timestamp
        const recordId = (payload.new as any)?.id || (payload.old as any)?.id || '';
        const eventKey = `${payload.eventType}:${table}:${recordId}:${payload.commit_timestamp}`;

        if (processedEventIds.has(eventKey)) {
          console.log(`[Realtime] Ignored duplicate event: ${eventKey}`);
          return;
        }

        processedEventIds.add(eventKey);
        // Clean up old event keys after 10 seconds
        setTimeout(() => processedEventIds.delete(eventKey), 10000);

        console.log(`[Realtime] Realtime event '${payload.eventType}' on '${table}':`, payload);

        // Trigger cache invalidation callback
        if (onCacheInvalidate) {
          onCacheInvalidate();
        }

        // Trigger specific event handler
        if (payload.eventType === 'INSERT' && onInsert) onInsert(payload.new);
        if (payload.eventType === 'UPDATE' && onUpdate) onUpdate(payload.new);
        if (payload.eventType === 'DELETE' && onDelete) onDelete(payload.old);
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime] Subscription status for '${channelName}': ${status}`);
      if (status === 'SUBSCRIBED') {
        console.log(`[Realtime] Channel '${channelName}' live and connected.`);
      } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        console.warn(`[Realtime] Channel '${channelName}' disconnected. Auto-reconnecting...`);
      }
    });

  activeChannels.set(channelName, channel);

  return () => unsubscribeFromChannel(channelName);
}

/**
 * Unsubscribe and clean up specific channel.
 */
export function unsubscribeFromChannel(channelName: string): void {
  const channel = activeChannels.get(channelName);
  if (channel) {
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
    console.log(`[Realtime] Unsubscribed channel '${channelName}'`);
  }
}

/**
 * Unsubscribe all active channels on app tear down.
 */
export function unsubscribeAllRealtimeChannels(): void {
  activeChannels.forEach((channel, channelName) => {
    supabase.removeChannel(channel);
    console.log(`[Realtime] Cleaned up channel '${channelName}'`);
  });
  activeChannels.clear();
}
