/**
 * ServiceCentric Mobile — Native Performance & Virtualization Suite (Phase 28)
 * Configures optimal FlatList virtualization parameters, render memoization helpers,
 * and low-end Android device optimization configs.
 */

import { FlatListProps } from 'react-native';

/**
 * Optimized FlatList performance props for low-end Android and iOS devices.
 * Prevents memory bloat during scrolling over 100+ machine or FSR cards.
 */
export const OPTIMIZED_FLATLIST_PROPS: Partial<FlatListProps<any>> = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 10,
  windowSize: 5,
  removeClippedSubviews: true,
  updateCellsBatchingPeriod: 50,
};

/**
 * Calculate item layout offset for fixed-height list items to skip dynamic height measurements.
 */
export function createFixedItemLayout(itemHeight: number) {
  return (_data: any, index: number) => ({
    length: itemHeight,
    offset: itemHeight * index,
    index,
  });
}

/**
 * Performance measure helper for tracking screen render times on field devices.
 */
export function logScreenRenderTime(screenName: string, startTimeMs: number): void {
  const duration = Date.now() - startTimeMs;
  if (duration > 100) {
    console.warn(`[Performance] Screen '${screenName}' render time took ${duration}ms (Threshold: 100ms)`);
  } else {
    console.log(`[Performance] Screen '${screenName}' rendered cleanly in ${duration}ms`);
  }
}
