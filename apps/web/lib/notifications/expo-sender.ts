import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import type { ClaimedPushRow, PushBatchResult } from './types';

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

    validMessages.push({
      row,
      message: {
        to: row.token,
        title: row.title,
        body: row.body,
        data: {
          nid: row.notification_id,
          link: row.deep_link || '/dashboard',
        },
        channelId,
        priority: row.priority === 'critical' || row.priority === 'high' ? 'high' : 'default',
        ttl: row.ttl_seconds,
        sound: 'default',
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
          const errorCode = ticket.details?.error;
          if (errorCode === 'DeviceNotRegistered') {
            results.push({
              notification_id: corresponding.row.notification_id,
              device_id: corresponding.row.device_id,
              outcome: 'dead',
              error: 'DeviceNotRegistered',
            });
          } else if (
            errorCode === 'MessageRateExceeded' ||
            errorCode === 'MessageTooBig' ||
            errorCode === 'InvalidCredentials'
          ) {
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
    } catch (chunkError: any) {
      // Entire chunk failed (e.g. HTTP 5xx / network timeout)
      const errMessage = chunkError?.message || 'ExpoNetworkError';
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
