import * as webpush from 'web-push';
import { isAllowedPushDeepLink } from '@reachinternational/types';
import type { ClaimedPushRow, PushBatchResult } from './types';

let vapidConfigured = false;

function ensureVapidConfig(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@reachinternational.co.in';

  if (!publicKey || !privateKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (err) {
    console.warn('[WebPush] Failed to initialize VAPID details:', err);
    return false;
  }
}

/**
 * Dispatches a batch of claimed notification rows targeting web browsers via Web Push (VAPID).
 * Runs at concurrency <= 20 and enforces < 2KB payload guard.
 */
export async function sendWebPushBatch(rows: ClaimedPushRow[]): Promise<PushBatchResult[]> {
  if (rows.length === 0) return [];

  const isConfigured = ensureVapidConfig();
  if (!isConfigured) {
    // If VAPID keys not configured in environment, mark retry with config reason
    return rows.map((r) => ({
      notification_id: r.notification_id,
      device_id: r.device_id,
      outcome: 'retry',
      error: 'VapidKeysNotConfigured',
    }));
  }

  const results: PushBatchResult[] = [];
  const CONCURRENCY = 20;

  // Process rows in parallel windows of size CONCURRENCY
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const chunkPromises = chunk.map(async (row): Promise<PushBatchResult> => {
      if (!row.web_keys?.p256dh || !row.web_keys?.auth) {
        return {
          notification_id: row.notification_id,
          device_id: row.device_id,
          outcome: 'dead',
          error: 'MissingWebPushKeys',
        };
      }

      const subscription = {
        endpoint: row.token,
        keys: {
          p256dh: row.web_keys.p256dh,
          auth: row.web_keys.auth,
        },
      };

      const payloadObj = {
        title: row.title,
        body: row.body,
        // Secure routing: only allowlisted same-origin routes reach the client.
        link: isAllowedPushDeepLink(row.deep_link) ? row.deep_link! : '/dashboard',
        nid: row.notification_id,
        tag: `reach-${row.category}`,
        priority: row.priority,
        category: row.category,
      };

      const payloadStr = JSON.stringify(payloadObj);
      if (Buffer.byteLength(payloadStr, 'utf-8') > 2048) {
        // Sender-side condition: reject the message without touching the device
        // registration (G-C4). Never retry a permanently oversized payload.
        return {
          notification_id: row.notification_id,
          device_id: row.device_id,
          outcome: 'skip',
          error: 'PayloadExceeds2KB',
        };
      }

      const urgency: 'high' | 'normal' | 'low' =
        row.priority === 'critical' || row.priority === 'high'
          ? 'high'
          : row.priority === 'normal'
          ? 'normal'
          : 'low';

      // Topic must be <= 32 chars, URL-safe
      const topic = `sp-${row.category.slice(0, 20)}`;

      try {
        await webpush.sendNotification(subscription, payloadStr, {
          TTL: row.ttl_seconds,
          urgency,
          topic,
        });

        return {
          notification_id: row.notification_id,
          device_id: row.device_id,
          outcome: 'ok',
        };
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription has expired or been revoked
          return {
            notification_id: row.notification_id,
            device_id: row.device_id,
            outcome: 'dead',
            error: `WebPush${statusCode}`,
          };
        } else if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
          return {
            notification_id: row.notification_id,
            device_id: row.device_id,
            outcome: 'retry',
            error: `WebPushTransient${statusCode}`,
          };
        } else if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 413) {
          // Permanently invalid payload or credentials — never retry as transient
          // (G-C6), never mutate the device (G-C4).
          return {
            notification_id: row.notification_id,
            device_id: row.device_id,
            outcome: 'skip',
            error: `WebPushPermanent${statusCode}`,
          };
        } else {
          return {
            notification_id: row.notification_id,
            device_id: row.device_id,
            outcome: 'retry',
            error: err?.message || 'WebPushError',
          };
        }
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    results.push(...chunkResults);
  }

  return results;
}
