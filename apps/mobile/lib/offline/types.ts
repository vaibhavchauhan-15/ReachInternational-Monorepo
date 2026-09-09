/**
 * Types and interfaces for the Mobile Offline Queue & Resilience Engine
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-01, D-04, D-05, D-06, D-08.
 */

export type MutationType = 'SUBMIT_HOUR_LOG' | 'SUBMIT_BREAKDOWN' | 'UPDATE_STATUS';

export type MutationStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';

export interface ServerConflictDetails {
  conflicting_operator?: string;
  conflicting_start_time?: string;
  conflicting_end_time?: string;
  server_message: string;
}

export interface QueuedMutation {
  id: string; // Unique local queue record ID
  idempotency_key: string; // Client-generated UUID sent to backend to guarantee exactly-once persistence (D-06)
  mutation_type: MutationType;
  payload: Record<string, unknown>;
  created_at: string; // ISO 8601 string
  status: MutationStatus;
  retry_count: number;
  last_error?: string;
  server_conflict?: ServerConflictDetails;
}

export interface OfflineQueueState {
  queue: QueuedMutation[];
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  conflictCount: number;
  isSyncing: boolean;
}

export type QueueEventListener = (state: OfflineQueueState) => void;
