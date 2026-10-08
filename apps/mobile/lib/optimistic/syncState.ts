/**
 * Optimistic UI Architecture — Sync State Definition
 * Tiers & Sync Lifecycle:
 * 'synced'   — Persisted and acknowledged by backend server.
 * 'pending'  — Optimistically applied in local cache; server response in flight.
 * 'queued'   — Network offline; mutation enqueued in persistent OfflineQueueManager.
 * 'failed'   — Server rejected or exhausted retries; flagged for rollback or retry.
 */

export type SyncState = 'synced' | 'pending' | 'queued' | 'failed';

export interface OptimisticRecord {
  id: string;
  syncState?: SyncState;
  clientMutationId?: string;
  optimisticCreatedAt?: string;
  syncErrorMessage?: string;
}

export function isPendingSync(syncState?: SyncState): boolean {
  return syncState === 'pending' || syncState === 'queued';
}

export function isOptimistic(record?: { syncState?: SyncState } | null): boolean {
  if (!record || !record.syncState) return false;
  return record.syncState === 'pending' || record.syncState === 'queued';
}
