/**
 * useOfflineQueue — Reactive Hook Subscribed to OfflineQueueManager
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-01, D-02, D-03, D-08.
 */

import { useState, useEffect, useCallback } from 'react';
import { offlineQueueManager } from './OfflineQueueManager';
import { QueuedMutation, OfflineQueueState } from './types';

export interface UseOfflineQueueResult {
  queue: QueuedMutation[];
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  conflictCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  enqueue: (
    mutationType: QueuedMutation['mutation_type'],
    payload: Record<string, unknown>
  ) => Promise<QueuedMutation>;
  removeMutation: (id: string) => Promise<void>;
  updateMutation: (id: string, updates: Partial<QueuedMutation>) => Promise<void>;
  clearQueue: () => Promise<void>;
}

export function useOfflineQueue(): UseOfflineQueueResult {
  const [state, setState] = useState<OfflineQueueState>(() => offlineQueueManager.getState());

  useEffect(() => {
    // Subscribe to OfflineQueueManager broadcast updates
    const unsubscribe = offlineQueueManager.subscribe((latestState) => {
      setState(latestState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const syncNow = useCallback(async () => {
    await offlineQueueManager.syncNow();
  }, []);

  const enqueue = useCallback(
    async (mutationType: QueuedMutation['mutation_type'], payload: Record<string, unknown>) => {
      return offlineQueueManager.enqueue(mutationType, payload);
    },
    []
  );

  const removeMutation = useCallback(async (id: string) => {
    await offlineQueueManager.removeMutation(id);
  }, []);

  const updateMutation = useCallback(async (id: string, updates: Partial<QueuedMutation>) => {
    await offlineQueueManager.updateMutation(id, updates);
  }, []);

  const clearQueue = useCallback(async () => {
    await offlineQueueManager.clearQueue();
  }, []);

  return {
    queue: state.queue,
    pendingCount: state.pendingCount,
    syncingCount: state.syncingCount,
    failedCount: state.failedCount,
    conflictCount: state.conflictCount,
    isSyncing: state.isSyncing,
    syncNow,
    enqueue,
    removeMutation,
    updateMutation,
    clearQueue,
  };
}
