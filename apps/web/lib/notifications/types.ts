/**
 * Push Notifications Engine — Data Transfer Objects & Pipeline Types
 */

export interface ClaimedPushRow {
  notification_id: string;
  user_id: string;
  title: string;
  body: string;
  deep_link: string | null;
  category: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  ttl_seconds: number;
  device_id: string;
  provider: 'expo' | 'webpush';
  platform: 'android' | 'ios' | 'web';
  token: string;
  web_keys: {
    p256dh: string;
    auth: string;
  } | null;
}

export type PushOutcome = 'ok' | 'retry' | 'dead' | 'skip';

export interface PushBatchResult {
  notification_id: string;
  device_id: string;
  outcome: PushOutcome;
  ticket_id?: string;
  error?: string;
}

/** Categories whose repeated reminders should collapse (replace) rather than stack. */
export const COLLAPSIBLE_CATEGORIES = new Set([
  'shift_reminder',
  'shift_reminders',
]);
