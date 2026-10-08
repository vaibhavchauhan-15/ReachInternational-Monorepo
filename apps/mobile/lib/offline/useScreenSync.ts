/**
 * useScreenSync — Hook to integrate active screens with the Synchronization Coordinator
 *
 * Automatically:
 * 1. Sets the screen as the currently active/visible target for screen-scoped revalidation.
 * 2. Registers an optional custom refresher for imperative screen queries (e.g. `machines.tsx`, `dashboard.tsx`).
 * 3. Exposes synchronization status and telemetry to the screen component.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { syncCoordinator, SyncStats, ScreenRefresher } from './SyncCoordinator';

export interface UseScreenSyncOptions {
  screen: string;
  onRefresh?: ScreenRefresher;
  enabled?: boolean;
}

export interface UseScreenSyncResult {
  isSyncing: boolean;
  lastSyncStats: SyncStats | null;
  triggerScreenSync: () => Promise<SyncStats | null>;
}

export function useScreenSync(options: UseScreenSyncOptions): UseScreenSyncResult {
  const { screen, onRefresh, enabled = true } = options;
  const [isSyncing, setIsSyncing] = useState(() => syncCoordinator.isSyncActive());
  const [lastSyncStats, setLastSyncStats] = useState<SyncStats | null>(null);

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    // Set screen as current target in coordinator
    syncCoordinator.setActiveScreen(screen);

    // Register custom refresher if available
    let unregisterRefresher: (() => void) | null = null;
    if (onRefreshRef.current) {
      unregisterRefresher = syncCoordinator.registerScreenRefresher(screen, async () => {
        if (onRefreshRef.current) {
          await onRefreshRef.current();
        }
      });
    }

    // Subscribe to sync completion stats
    const unsubscribeSync = syncCoordinator.onSyncComplete((stats) => {
      setIsSyncing(syncCoordinator.isSyncActive());
      if (stats.screen === syncCoordinator.normalizeScreenName(screen)) {
        setLastSyncStats(stats);
      }
    });

    return () => {
      if (unregisterRefresher) {
        unregisterRefresher();
      }
      unsubscribeSync();
    };
  }, [screen, enabled]);

  const triggerScreenSync = useCallback(async () => {
    syncCoordinator.setActiveScreen(screen);
    return syncCoordinator.handleReconnection();
  }, [screen]);

  return {
    isSyncing,
    lastSyncStats,
    triggerScreenSync,
  };
}
