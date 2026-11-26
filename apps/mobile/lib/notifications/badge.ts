/**
 * ReachInternational Mobile — App Badge Sync
 * Keeps the app icon badge in sync with the server-side unread notification
 * count (public.notification_unread_count — read-only badge contract shared
 * with the web inbox). Never derives counts locally.
 */

import * as Notifications from 'expo-notifications';
import { supabase } from '../supabase';

let inflight: Promise<void> | null = null;

/**
 * Fetches the authenticated user's unread notification count and applies it to
 * the app icon badge. Safe to call often: concurrent calls coalesce.
 */
export function syncAppBadge(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase.rpc('notification_unread_count');
      if (error) return;
      const count = typeof data === 'number' ? Math.max(0, data) : 0;
      await Notifications.setBadgeCountAsync(count);
    } catch {
      // Badge sync is best-effort; never disrupt the caller.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
