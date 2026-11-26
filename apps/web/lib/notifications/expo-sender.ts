import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import { isAllowedPushDeepLink } from '@reachinternational/types';
import type { ClaimedPushRow, PushBatchResult } from './types';
import { COLLAPSIBLE_CATEGORIES } from './types';

// Initialize Expo client with optional access token for enhanced push security
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
});

export function resolveAndroidChannel(category: string): string {
  switch (category) {
    case 'breakdown_alerts':
    case 'breakdown':
      return 'breakdown_alerts';
    case 'shift_reminders':
    case 'shift_reminder':
    case 'shift':
      return 'shift_reminders';
    case 'assignment_alerts':
    case 'assignment':
      return 'assignment_updates';
    default:
      return 'general_updates';
  }
}

/**
 * Dispatches a batch of claimed notification rows targeting native devices via Expo Push Service.
 * Chunks payloads to <= 100 messages and manages concurrency <= 5.
 */
export async function sendExpoBatch(rows: ClaimedPushRow[]): Promise<PushBatchResult[]> {
  if (rows.length === 0) return [];

  const results: PushBatchResult[] = [];
  const validMessages: Array<{ message: ExpoPushMessage; row: ClaimedPushRow }> = [];

  for (const row of rows) {
    if (!Expo.isExpoPushToken(row.token)) {
      results.push({
        notification_id: row.notification_id,
        device_id: row.device_id,
        outcome: 'dead',
        error: 'InvalidExpoPushToken',
      });
      continue;
    }

    const channelId = resolveAndroidChannel(row.category);
    // Secure routing: only allowlisted same-origin routes reach the client.
    const link = isAllowedPushDeepLink(row.deep_link) ? row.deep_link! : '/dashboard';

    // Best-effort duplicate suppression: repeated collapsible reminders (e.g.
    // shift reminders) replace the queued message instead of stacking.
    // Correctness never depends on collapse support (verified available on
    // expo-server-sdk@8.0.0 as `collapseId`).
    const collapseId = COLLAPSIBLE_CATEGORIES.has(row.category)
      ? `rem-${row.user_id.slice(0, 8)}-${row.category.slice(0, 24)}`.slice(0, 64)
      : undefined;

    validMessages.push({
      row,
      message: {
        to: row.token,
        title: row.title,
        body: row.body,
        data: {
          nid: row.notification_id,
          link,
          priority: row.priority,
          category: row.category,
        },
        channelId,
        priority: row.priority === 'critical' || row.priority === 'high' ? 'high' : 'default',
        ttl: row.ttl_seconds,
        sound: 'default',
        ...(collapseId ? { collapseId } : {}),
      },
    });
  }

  if (validMessages.length === 0) {
    return results;
  }

  // Chunk messages into batches of up to 100
  const messageList = validMessages.map((vm) => vm.message);
  const chunks = expo.chunkPushNotifications(messageList);

  let messageOffset = 0;

  for (const chunk of chunks) {
    const chunkRows = validMessages.slice(messageOffset, messageOffset + chunk.length);
    messageOffset += chunk.length;

    try {
      const ticketChunk: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);

      for (let i = 0; i < ticketChunk.length; i++) {
        const ticket = ticketChunk[i];
        const corresponding = chunkRows[i];

        if (ticket.status === 'ok') {
          results.push({
            notification_id: corresponding.row.notification_id,
            device_id: corresponding.row.device_id,
            outcome: 'ok',
            ticket_id: ticket.id,
          });
        } else {
          const errorCode = String(ticket.details?.error ?? '');
          if (errorCode === 'DeviceNotRegistered') {
            results.push({
              notification_id: corresponding.row.notification_id,
              device_id: corresponding.row.device_id,
              outcome: 'dead',
              error: 'DeviceNotRegistered',
            });
          } else if (
            // Permanently invalid payloads/credentials must never be retried as
            // transient failures and must never mutate the device (G-C6/G-C4).
            errorCode === 'MessageTooBig' ||
            errorCode === 'InvalidCredentials' ||
            errorCode === 'InvalidTopic' ||
            errorCode === 'MessageTooLong' ||
            errorCode === 'MismatchSenderId' ||
            errorCode === 'InvalidProvider' ||
            errorCode === 'NotificationRateExceeded'
          ) {
            results.push({
              notification_id: corresponding.row.notification_id,
              device_id: corresponding.row.device_id,
              outcome: 'skip',
              error: errorCode,
            });
          } else if (errorCode === 'MessageRateExceeded') {
            results.push({
              notification_id: corresponding.row.notification_id,
              device_id: corresponding.row.device_id,
              outcome: 'retry',
              error: errorCode,
            });
          } else {
            results.push({
              notification_id: corresponding.row.notification_id,
              device_id: corresponding.row.device_id,
              outcome: 'retry',
              error: ticket.message || 'ExpoPushError',
            });
          }
        }
      }
    } catch (chunkError: unknown) {
      // Chunk failed (HTTP 5xx / network timeout). The provider MAY have accepted
      // some or all messages before the failure (uncertain acceptance) — at-least-
      // once semantics: retry the chunk; duplicates are suppressed best-effort via
      // collapseId where applicable and client-side dedupe via `nid`.
      const errMessage = chunkError instanceof Error ? chunkError.message : 'ExpoNetworkError';
      for (const item of chunkRows) {
        results.push({
          notification_id: item.row.notification_id,
          device_id: item.row.device_id,
          outcome: 'retry',
          error: errMessage,
        });
      }
    }
  }

  return results;
}
