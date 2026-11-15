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
      skippedResults.push({
        notification_id: row.notification_id,
        device_id: row.device_id,
        outcome: 'dead',
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

  // 3. Dispatch concurrently
  const [expoResults, webPushResults] = await Promise.all([
    sendExpoBatch(expoRows),
    sendWebPushBatch(webPushRows),
  ]);

  return [...skippedResults, ...expoResults, ...webPushResults];
}
