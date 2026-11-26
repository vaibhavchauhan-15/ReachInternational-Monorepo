import { sendExpoBatch } from './expo-sender';
import { sendWebPushBatch } from './webpush-sender';
import type { ClaimedPushRow, PushBatchResult } from './types';

/**
 * Unified dispatch router fanning out to native Expo devices and Web Push subscriptions.
 */
export async function sendAll(rows: ClaimedPushRow[]): Promise<PushBatchResult[]> {
  if (rows.length === 0) return [];

  // 1. Check per-category disable list from environment
  const disabledCategoriesStr = process.env.PUSH_DISABLED_CATEGORIES || '';
  const disabledCategories = new Set(
    disabledCategoriesStr
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean)
  );

  const activeRows: ClaimedPushRow[] = [];
  const skippedResults: PushBatchResult[] = [];

  for (const row of rows) {
    if (disabledCategories.has(row.category.toLowerCase())) {
      // Sender-side condition: never touches the device registration (G-C4).
      skippedResults.push({
        notification_id: row.notification_id,
        device_id: row.device_id,
        outcome: 'skip',
        error: 'CategoryDisabledByKillSwitch',
      });
    } else {
      activeRows.push(row);
    }
  }

  // 2. Partition by provider
  const expoRows: ClaimedPushRow[] = [];
  const webPushRows: ClaimedPushRow[] = [];

  for (const row of activeRows) {
    if (row.provider === 'expo') {
      expoRows.push(row);
    } else if (row.provider === 'webpush') {
      webPushRows.push(row);
    } else {
      skippedResults.push({
        notification_id: row.notification_id,
        device_id: row.device_id,
        outcome: 'dead',
        error: `UnsupportedProvider:${row.provider}`,
      });
    }
  }

  // 3. Dispatch concurrently, isolated per provider: one provider throwing must
  //    never lose or block the other provider's results (failure-domain isolation).
  const [expoResults, webPushResults] = await Promise.all([
    sendExpoBatch(expoRows).catch((err: unknown) =>
      expoRows.map((row) => ({
        notification_id: row.notification_id,
        device_id: row.device_id,
        outcome: 'retry' as const,
        error: `ExpoProviderCrash:${err instanceof Error ? err.message : 'unknown'}`,
      }))
    ),
    sendWebPushBatch(webPushRows).catch((err: unknown) =>
      webPushRows.map((row) => ({
        notification_id: row.notification_id,
        device_id: row.device_id,
        outcome: 'retry' as const,
        error: `WebPushProviderCrash:${err instanceof Error ? err.message : 'unknown'}`,
      }))
    ),
  ]);

  return [...skippedResults, ...expoResults, ...webPushResults];
}
