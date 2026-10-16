/**
 * SyncCoordinator — Screen-Scoped Offline → Online Reconnection & Data Synchronization Engine
 *
 * Enforces the Golden Rule:
 * Reconnect should mean "refetch active queries belonging to the visible screen", NOT "reload the app".
 *
 * Sequence:
 * 1. Confirm true offline → online transition (via NetworkConnectivityManager).
 * 2. Prevent duplicate synchronization via mutex lock (`isSynchronizing`).
 * 3. Revalidate ONLY queries matching the currently active/visible screen that:
 *    - Belong to the active screen
 *    - Are currently active (have mounted observers)
 *    - Actually need fresh data (isStale() === true, or in error status, or data empty)
 *    - Are not already fetching
 *    - Are not disabled
 * 4. Retry failed requests where appropriate.
 * 5. Run registered custom screen refresher (if screen uses imperative refresh).
 * 6. Drain offline mutation queue chronologically.
 * 7. Invalidate/refetch only queries affected by successful mutations.
 */

import { QueryClient, Query } from '@tanstack/react-query';
import { networkConnectivityManager, NetworkTelemetry } from './NetworkConnectivityManager';
import { offlineQueueManager } from './OfflineQueueManager';

export interface SyncStats {
  screen: string;
  activeQueriesEvaluated: number;
  queriesRevalidated: number;
  customRefresherExecuted: boolean;
  offlineMutationsDrained: number;
  durationMs: number;
  timestamp: string;
}

export type ScreenRefresher = () => Promise<void> | void;
export type SyncListener = (stats: SyncStats) => void;

/**
 * Domain query key prefix mappings for screen scoping
 */
const SCREEN_QUERY_PREFIXES: Record<string, string[][]> = {
  operations: [['operations'], ['operator']],
  machines: [['machines']],
  dashboard: [['dashboard']],
  attendance: [['attendance']],
  payroll: [['payroll']],
  users: [['users']],
  clients: [['clients']],
  profile: [['profile'], ['user']],
  'running-logs': [['running-logs'], ['operations', 'logs']],
  settings: [['settings'], ['preferences']],
};

export class SyncCoordinator {
  private static instance: SyncCoordinator | null = null;

  private queryClient: QueryClient | null = null;
  private currentScreen = 'dashboard';
  private isSynchronizing = false;
  private customRefreshers: Map<string, ScreenRefresher> = new Map();
  private syncListeners: Set<SyncListener> = new Set();
  private unsubscribeReconnect: (() => void) | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): SyncCoordinator {
    if (!SyncCoordinator.instance) {
      SyncCoordinator.instance = new SyncCoordinator();
    }
    return SyncCoordinator.instance;
  }

  /**
   * Initializes the coordinator and registers listener for verified reconnects
   */
  public init(): void {
    if (this.unsubscribeReconnect) return;

    this.unsubscribeReconnect = networkConnectivityManager.onReconnect(
      async (telemetry: NetworkTelemetry) => {
        await this.handleReconnection(telemetry);
      }
    );
  }

  /**
   * Binds the application QueryClient
   */
  public setQueryClient(client: QueryClient): void {
    this.queryClient = client;
  }

  public getQueryClient(): QueryClient | null {
    return this.queryClient;
  }

  /**
   * Updates the currently active / visible screen name or route pathname
   */
  public setActiveScreen(pathnameOrScreen: string): void {
    if (!pathnameOrScreen) return;

    const normalized = this.normalizeScreenName(pathnameOrScreen);
    if (normalized) {
      this.currentScreen = normalized;
    }
  }

  public getActiveScreen(): string {
    return this.currentScreen;
  }

  /**
   * Normalizes Expo Router pathnames (e.g. '/(app)/operations' -> 'operations')
   */
  public normalizeScreenName(path: string): string {
    const clean = path
      .replace(/^\/(\(app\)\/)?/, '')
      .split('?')[0]
      .split('/')[0]
      .trim();

    if (!clean || clean === 'index') return 'dashboard';
    return clean;
  }

  /**
   * Registers a custom screen refresh callback (e.g. for screens with imperative Supabase queries)
   */
  public registerScreenRefresher(screen: string, refresher: ScreenRefresher): () => void {
    const normalized = this.normalizeScreenName(screen);
    this.customRefreshers.set(normalized, refresher);

    return () => {
      if (this.customRefreshers.get(normalized) === refresher) {
        this.customRefreshers.delete(normalized);
      }
    };
  }

  /**
   * Primary Reconnection Workflow
   */
  public async handleReconnection(telemetry?: NetworkTelemetry): Promise<SyncStats | null> {
    if (this.isSynchronizing) {
      return null; // Mutex guard: already running
    }

    this.isSynchronizing = true;
    const startTime = Date.now();
    const activeScreen = this.currentScreen;

    let queriesRevalidated = 0;
    let activeQueriesEvaluated = 0;
    let customRefresherExecuted = false;
    let mutationsDrained = 0;

    try {
      // Step 1: Revalidate active queries matching the currently visible screen
      if (this.queryClient) {
        const queryCache = this.queryClient.getQueryCache();
        const allQueries = queryCache.getAll();

        const queriesToRefetch = allQueries.filter((query) => {
          return this.shouldRevalidateQuery(query, activeScreen);
        });

        activeQueriesEvaluated = allQueries.filter((q) => q.isActive()).length;
        queriesRevalidated = queriesToRefetch.length;

        // Refetch qualifying queries in parallel with error isolation
        if (queriesToRefetch.length > 0) {
          await Promise.allSettled(
            queriesToRefetch.map((query) => {
              return query.fetch();
            })
          );
        }
      }

      // Step 2: Execute registered custom refresher for the active screen if present
      const screenRefresher = this.customRefreshers.get(activeScreen);
      if (screenRefresher) {
        try {
          await screenRefresher();
          customRefresherExecuted = true;
        } catch (refresherErr) {
          console.warn(`[SyncCoordinator] Custom refresher error on screen ${activeScreen}:`, refresherErr);
        }
      }

      // Step 3: Drain offline mutation queue chronologically
      try {
        const stateBefore = offlineQueueManager.getState();
        if (stateBefore.pendingCount > 0 || stateBefore.failedCount > 0) {
          await offlineQueueManager.drainQueue();
          const stateAfter = offlineQueueManager.getState();
          mutationsDrained = Math.max(0, stateBefore.pendingCount - stateAfter.pendingCount);

          // Step 4: After successful offline mutations, invalidate affected queries
          if (mutationsDrained > 0 && this.queryClient) {
            await this.invalidateAffectedMutationQueries();
          }
        }
      } catch (queueErr) {
        console.warn('[SyncCoordinator] Error draining offline queue on reconnect:', queueErr);
      }
    } finally {
      this.isSynchronizing = false;
    }

    const durationMs = Date.now() - startTime;
    const stats: SyncStats = {
      screen: activeScreen,
      activeQueriesEvaluated,
      queriesRevalidated,
      customRefresherExecuted,
      offlineMutationsDrained: mutationsDrained,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    this.notifySyncListeners(stats);
    return stats;
  }

  /**
   * Strict predicate checking whether a query qualifies for screen-scoped revalidation:
   * 1. Belongs to the visible screen.
   * 2. Is currently active (has mounted observers).
   * 3. Actually needs fresh data (isStale, error status, or undefined data).
   * 4. Is not already in-flight fetching.
   * 5. Is not intentionally disabled.
   */
  public shouldRevalidateQuery(query: Query, visibleScreen: string): boolean {
    // Check 1: Must be currently active (mounted in the React tree)
    if (!query.isActive()) {
      return false;
    }

    // Check 2: Must belong to the currently visible screen
    if (!this.doesQueryBelongToScreen(query.queryKey, visibleScreen)) {
      return false;
    }

    // Check 3: Must not be already fetching
    if (query.state.fetchStatus === 'fetching') {
      return false;
    }

    // Check 4: Must not be disabled
    if ((query.options as Record<string, unknown>)?.enabled === false) {
      return false;
    }

    // Check 5: Must actually need fresh data
    const isStale = query.isStale();
    const isError = query.state.status === 'error';
    const isMissingData = query.state.data === undefined || query.state.dataUpdatedAt === 0;

    return isStale || isError || isMissingData;
  }

  /**
   * Checks whether a query key belongs to the domain of the currently visible screen
   */
  public doesQueryBelongToScreen(queryKey: readonly unknown[], screen: string): boolean {
    if (!Array.isArray(queryKey) || queryKey.length === 0) return false;

    const prefixes = SCREEN_QUERY_PREFIXES[screen];
    if (!prefixes || prefixes.length === 0) {
      // Fallback: match first segment as string
      const firstSegment = String(queryKey[0]).toLowerCase();
      return firstSegment === screen.toLowerCase();
    }

    return prefixes.some((prefix) => {
      if (queryKey.length < prefix.length) return false;
      return prefix.every((part, idx) => {
        return String(queryKey[idx]).toLowerCase() === String(part).toLowerCase();
      });
    });
  }

  /**
   * Invalidates queries that are impacted by synchronized hour logs and operator mutations
   */
  private async invalidateAffectedMutationQueries(): Promise<void> {
    if (!this.queryClient) return;

    await Promise.allSettled([
      this.queryClient.invalidateQueries({ queryKey: ['operations', 'logs'] }),
      this.queryClient.invalidateQueries({ queryKey: ['operations', 'today-shift-monitor'] }),
      this.queryClient.invalidateQueries({ queryKey: ['operator', 'history-logs'] }),
      this.queryClient.invalidateQueries({ queryKey: ['operator', 'entry-context'] }),
      this.queryClient.invalidateQueries({ queryKey: ['machines'] }),
      this.queryClient.invalidateQueries({ queryKey: ['today-shift-monitor'] }),
      this.queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  }

  /**
   * Subscribes to sync completion telemetry
   */
  public onSyncComplete(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private notifySyncListeners(stats: SyncStats): void {
    this.syncListeners.forEach((listener) => {
      try {
        listener(stats);
      } catch (err) {
        console.warn('[SyncCoordinator] Sync listener error:', err);
      }
    });
  }

  public isSyncActive(): boolean {
    return this.isSynchronizing;
  }

  /**
   * Teardown for tests
   */
  public teardown(): void {
    if (this.unsubscribeReconnect) {
      this.unsubscribeReconnect();
      this.unsubscribeReconnect = null;
    }
    this.customRefreshers.clear();
    this.syncListeners.clear();
    this.queryClient = null;
    this.isSynchronizing = false;
  }
}

export const syncCoordinator = SyncCoordinator.getInstance();
