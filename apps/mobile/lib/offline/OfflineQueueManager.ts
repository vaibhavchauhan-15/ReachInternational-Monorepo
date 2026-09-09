/**
 * OfflineQueueManager — Core Offline Queue & Network Resilience Engine
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-01, D-03, D-04, D-05, D-06, and STRIDE mitigations T-14-01..T-14-03.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '../supabase';
import {
  QueuedMutation,
  MutationType,
  OfflineQueueState,
  QueueEventListener,
  ServerConflictDetails,
} from './types';

export const QUEUE_STORAGE_KEY = '@reach:offline_queue_v1';
export const MAX_QUEUE_CAPACITY = 50; // T-14-03 DoS mitigation
export const RETRY_BACKOFF_DELAYS_MS = [2000, 5000, 10000]; // 2s, 5s, 10s per D-04

/**
 * Universal RFC4122 compliant UUID v4 generator
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class OfflineQueueManager {
  private static instance: OfflineQueueManager | null = null;
  private queue: QueuedMutation[] = [];
  private isSyncing = false;
  private isInitialized = false;
  private listeners: Set<QueueEventListener> = new Set();
  private netInfoUnsubscribe: (() => void) | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): OfflineQueueManager {
    if (!OfflineQueueManager.instance) {
      OfflineQueueManager.instance = new OfflineQueueManager();
    }
    return OfflineQueueManager.instance;
  }

  /**
   * Initializes queue from persistent AsyncStorage and registers NetInfo listener
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await this.loadQueueFromStorage();
      this.isInitialized = true;
      this.registerNetInfoListener();
      this.notifyListeners();
    } catch (err) {
      console.warn('[OfflineQueueManager] Initialization error:', err);
    }
  }

  /**
   * Reads stored queue from AsyncStorage
   */
  private async loadQueueFromStorage(): Promise<QueuedMutation[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.queue = parsed;
          return this.queue;
        }
      }
    } catch (err) {
      console.warn('[OfflineQueueManager] Error reading AsyncStorage:', err);
    }
    this.queue = [];
    return this.queue;
  }

  /**
   * Saves in-memory queue to AsyncStorage
   */
  private async persistQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch (err) {
      console.warn('[OfflineQueueManager] Error writing AsyncStorage:', err);
    }
  }

  /**
   * Registers NetInfo event listener for auto-reconnection synchronization (D-03)
   */
  private registerNetInfoListener(): void {
    if (this.netInfoUnsubscribe) return;
    try {
      this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        const isOnline = state.isConnected === true && state.isInternetReachable !== false;
        if (isOnline && !this.isSyncing) {
          const hasPendingWork = this.queue.some(
            (item) => item.status === 'pending' || (item.status === 'failed' && item.retry_count < 3)
          );
          if (hasPendingWork) {
            this.drainQueue().catch((err) => {
              console.warn('[OfflineQueueManager] Auto-drain on reconnect error:', err);
            });
          }
        }
      });
    } catch (err) {
      console.warn('[OfflineQueueManager] NetInfo listener registration error:', err);
    }
  }

  /**
   * Cleanly teardown listeners (useful in tests or app unmount)
   */
  public teardown(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
  }

  /**
   * Subscribes a listener to queue state changes
   */
  public subscribe(listener: QueueEventListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifies all registered listeners of state updates
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('[OfflineQueueManager] Listener error:', e);
      }
    });
  }

  /**
   * Returns current synchronous snapshot of queue state
   */
  public getState(): OfflineQueueState {
    const pendingCount = this.queue.filter((q) => q.status === 'pending').length;
    const syncingCount = this.queue.filter((q) => q.status === 'syncing').length;
    const failedCount = this.queue.filter((q) => q.status === 'failed').length;
    const conflictCount = this.queue.filter((q) => q.status === 'conflict').length;

    return {
      queue: [...this.queue],
      pendingCount,
      syncingCount,
      failedCount,
      conflictCount,
      isSyncing: this.isSyncing,
    };
  }

  /**
   * Returns current queue items
   */
  public async getQueue(): Promise<QueuedMutation[]> {
    if (!this.isInitialized) {
      await this.init();
    }
    return [...this.queue];
  }

  /**
   * Enqueues a new mutation with a client-generated UUID idempotency key (D-01, D-06)
   */
  public async enqueue(
    mutation_type: MutationType,
    payload: Record<string, unknown>
  ): Promise<QueuedMutation> {
    if (!this.isInitialized) {
      await this.init();
    }

    // Capacity limit enforcement (T-14-03)
    if (this.queue.length >= MAX_QUEUE_CAPACITY) {
      // Evict oldest synced or failed item if capacity reached
      const evictIndex = this.queue.findIndex(
        (i) => i.status === 'synced' || (i.status === 'failed' && i.retry_count >= 3)
      );
      if (evictIndex !== -1) {
        this.queue.splice(evictIndex, 1);
      } else {
        // Drop oldest item to prevent storage exhaustion
        this.queue.shift();
      }
    }

    const idempotency_key = generateUUID();
    const id = `mut_${Date.now()}_${generateUUID().substring(0, 8)}`;

    const newMutation: QueuedMutation = {
      id,
      idempotency_key,
      mutation_type,
      payload,
      created_at: new Date().toISOString(),
      status: 'pending',
      retry_count: 0,
    };

    this.queue.push(newMutation);
    await this.persistQueue();
    this.notifyListeners();

    return newMutation;
  }

  /**
   * Updates an existing queued mutation
   */
  public async updateMutation(id: string, updates: Partial<QueuedMutation>): Promise<void> {
    const idx = this.queue.findIndex((m) => m.id === id);
    if (idx === -1) return;

    this.queue[idx] = {
      ...this.queue[idx],
      ...updates,
    };

    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Removes a mutation from the queue
   */
  public async removeMutation(id: string): Promise<void> {
    this.queue = this.queue.filter((m) => m.id !== id);
    await this.persistQueue();
    this.notifyListeners();
  }

  /**
   * Clears all items from the queue
   */
  public async clearQueue(): Promise<void> {
    this.queue = [];
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    this.notifyListeners();
  }

  /**
   * Manually triggers queue synchronization (D-03)
   */
  public async syncNow(): Promise<void> {
    return this.drainQueue();
  }

  /**
   * Sequential FIFO queue drain worker (D-03, D-04, D-05)
   * Protected by mutex guard `isSyncing` against concurrent drain runs.
   */
  public async drainQueue(): Promise<void> {
    if (this.isSyncing) {
      return; // Mutex guard: already syncing (Pitfall 2)
    }

    if (!this.isInitialized) {
      await this.init();
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      // Process pending and retryable items in strict FIFO order
      const itemsToProcess = this.queue.filter(
        (m) => m.status === 'pending' || (m.status === 'failed' && m.retry_count < 3)
      );

      for (const item of itemsToProcess) {
        // Refresh item reference in current queue
        const currentItem = this.queue.find((q) => q.id === item.id);
        if (!currentItem || currentItem.status === 'conflict') continue;

        // Transition status to syncing
        await this.updateMutation(item.id, { status: 'syncing' });

        try {
          await this.executeMutation(currentItem);

          // Success: mark as synced, then remove from queue after brief persistence
          await this.updateMutation(item.id, {
            status: 'synced',
            last_error: undefined,
          });

          // Prune synced item
          await this.removeMutation(item.id);
        } catch (error: any) {
          const isBusinessConflict = this.isConflictError(error);

          if (isBusinessConflict) {
            // D-05: Preserve draft, flag as conflict, extract collision details
            const serverConflict: ServerConflictDetails = {
              server_message: error.message || 'Shift conflict detected by server',
              conflicting_operator: error.conflicting_operator || error.operator_name,
              conflicting_start_time: error.conflicting_start_time || error.start_time,
              conflicting_end_time: error.conflicting_end_time || error.end_time,
            };

            await this.updateMutation(item.id, {
              status: 'conflict',
              last_error: error.message || 'Database validation conflict',
              server_conflict: serverConflict,
            });
          } else {
            // Transient network error: Exponential backoff retry (D-04)
            const nextRetryCount = (currentItem.retry_count || 0) + 1;

            if (nextRetryCount < 3) {
              const backoffMs = RETRY_BACKOFF_DELAYS_MS[nextRetryCount - 1] || 10000;
              await this.updateMutation(item.id, {
                status: 'pending',
                retry_count: nextRetryCount,
                last_error: `Network error: ${error.message || 'Request dropped'}. Retrying in ${backoffMs / 1000}s...`,
              });

              // Wait backoff interval before next retry
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
            } else {
              // Max retries reached: mark failed with manual retry CTA
              await this.updateMutation(item.id, {
                status: 'failed',
                retry_count: nextRetryCount,
                last_error: error.message || 'Sync failed after 3 network retry attempts',
              });
            }
          }
        }
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  /**
   * Classifies whether an error is a business conflict/PostgreSQL constraint violation (D-05, Pitfall 3)
   */
  private isConflictError(error: any): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const code = error.code || '';

    return (
      msg.includes('overlap') ||
      msg.includes('cannot be less than start meter') ||
      msg.includes('shift end timestamp') ||
      msg.includes('cannot log before shift end') ||
      msg.includes('breakdown duration') ||
      msg.includes('maintenance or decommissioned') ||
      msg.includes('unauthorized operator') ||
      msg.includes('client id does not match') ||
      code === '23514' || // check_violation
      code === '23505' || // unique_violation
      code === 'P0001'    // raise_exception (trigger error)
    );
  }

  /**
   * Executes a single mutation against Supabase
   */
  private async executeMutation(mutation: QueuedMutation): Promise<void> {
    const { mutation_type, payload, idempotency_key } = mutation;

    if (mutation_type === 'SUBMIT_HOUR_LOG') {
      // 1. Try atomic PostgreSQL RPC execution first
      let rpcSucceeded = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('submit_operator_hour_log_atomic', {
          p_machine_id: payload.machine_id,
          p_operator_id: payload.operator_id,
          p_client_id: payload.client_id || null,
          p_log_date: payload.log_date,
          p_end_date: payload.end_date,
          p_start_datetime: payload.start_datetime || null,
          p_end_datetime: payload.end_datetime || null,
          p_start_meter: payload.start_meter,
          p_end_meter: payload.end_meter,
          p_start_time: payload.start_time,
          p_end_time: payload.end_time,
          p_overtime_hours: payload.overtime_hours || 0,
          p_normal_working_hours: payload.normal_working_hours || 0,
          p_is_breakdown: Boolean(payload.is_breakdown),
          p_breakdown_start_time: payload.breakdown_start_time || null,
          p_breakdown_end_time: payload.breakdown_end_time || null,
          p_breakdown_duration: payload.breakdown_duration || null,
          p_breakdown_hours: payload.breakdown_hours || 0,
          p_shift: payload.shift || null,
          p_machine_condition: payload.machine_condition || (payload.is_breakdown ? 'breakdown' : 'good'),
          p_location: payload.location || null,
          p_remarks: payload.remarks || null,
          p_idempotency_key: idempotency_key,
        });

        if (!rpcErr && rpcRes && (rpcRes as any).success) {
          rpcSucceeded = true;
          return;
        } else if (rpcErr) {
          if (this.isConflictError(rpcErr)) {
            throw rpcErr;
          }
        }
      } catch (rpcCatchErr: any) {
        if (this.isConflictError(rpcCatchErr)) {
          throw rpcCatchErr;
        }
      }

      // 2. Fallback direct table insert if RPC unavailable
      if (!rpcSucceeded) {
        const insertPayload = {
          ...payload,
          idempotency_key,
        };

        const { error: insertErr } = await supabase
          .from('machine_hour_logs')
          .insert([insertPayload]);

        if (insertErr) {
          throw insertErr;
        }

        // Update machine meter reading & health status
        const machineId = payload.machine_id as string;
        const endMeter = Number(payload.end_meter);
        if (machineId && endMeter > 0) {
          await supabase
            .from('machines')
            .update({
              hour_meter: endMeter,
              health_status: payload.is_breakdown ? 'breakdown' : 'active',
              updated_at: new Date().toISOString(),
              ...(payload.operator_id ? { current_operator_id: payload.operator_id } : {}),
            })
            .eq('id', machineId);
        }
      }
    } else {
      console.warn(`[OfflineQueueManager] Unhandled mutation type: ${mutation_type}`);
    }
  }
}

export const offlineQueueManager = OfflineQueueManager.getInstance();
