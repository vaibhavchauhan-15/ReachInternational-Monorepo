/**
 * OfflineQueueManager — Core Offline Queue & Network Resilience Engine
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-01, D-03, D-04, D-05, D-06, and STRIDE mitigations T-14-01..T-14-03.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
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
  private syncCompleteCallbacks: Set<(syncedCount: number) => void> = new Set();
  private netInfoUnsubscribe: (() => void) | null = null;
  private appStateSubscription: { remove: () => void } | null = null;

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
   * Initializes queue from persistent AsyncStorage and registers NetInfo + AppState listeners
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await this.loadQueueFromStorage();
      this.isInitialized = true;
      this.registerNetInfoListener();
      this.registerAppStateListener();
      this.notifyListeners();

      // Cold-start auto-drain: If offline items exist in local storage and device is online, sync immediately!
      this.checkAndAutoDrain();
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
        if (isOnline) {
          this.checkAndAutoDrain();
        }
      });
    } catch (err) {
      console.warn('[OfflineQueueManager] NetInfo listener registration error:', err);
    }
  }

  /**
   * Registers AppState listener to automatically drain queue when app returns to foreground
   */
  private registerAppStateListener(): void {
    if (this.appStateSubscription) return;
    try {
      this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          this.checkAndAutoDrain();
        }
      });
    } catch (err) {
      console.warn('[OfflineQueueManager] AppState listener registration error:', err);
    }
  }

  /**
   * Proactively checks network state and triggers queue drain if items exist
   */
  public async checkAndAutoDrain(): Promise<void> {
    if (this.isSyncing) return;
    const hasWork = this.queue.some(
      (item) => item.status === 'pending' || item.status === 'failed' || item.status === 'syncing'
    );
    if (!hasWork) return;

    try {
      const state = await NetInfo.fetch();
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      if (isOnline && !this.isSyncing) {
        this.drainQueue().catch((err) => {
          console.warn('[OfflineQueueManager] Auto-drain on reconnect error:', err);
        });
      }
    } catch (err) {
      console.warn('[OfflineQueueManager] checkAndAutoDrain fetch error:', err);
    }
  }

  /**
   * Registers a callback invoked whenever offline mutations are successfully synchronized
   */
  public onSyncComplete(callback: (syncedCount: number) => void): () => void {
    this.syncCompleteCallbacks.add(callback);
    return () => {
      this.syncCompleteCallbacks.delete(callback);
    };
  }

  /**
   * Broadcasts sync completion to registered listeners (e.g. for TanStack cache invalidation)
   */
  private notifySyncComplete(syncedCount: number): void {
    if (syncedCount <= 0) return;
    this.syncCompleteCallbacks.forEach((cb) => {
      try {
        cb(syncedCount);
      } catch (err) {
        console.warn('[OfflineQueueManager] Sync complete callback error:', err);
      }
    });
  }

  /**
   * Cleanly teardown listeners (useful in tests or app unmount)
   */
  public teardown(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.listeners.clear();
    this.syncCompleteCallbacks.clear();
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

    // Process pending, syncing, and failed items
    // When coming online or manually syncing, failed items are retried
    const itemsToProcess = this.queue.filter(
      (m) => m.status === 'pending' || m.status === 'syncing' || m.status === 'failed'
    );

    if (itemsToProcess.length === 0) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners();

    let totalSyncedInRun = 0;

    try {
      // Sort items so SUBMIT_HOUR_LOG mutations execute in strictly chronological order (start_datetime ASC)
      // to ensure machine hour meters and shift timelines advance sequentially without false-positive overlap detections
      itemsToProcess.sort((a, b) => {
        if (a.mutation_type === 'SUBMIT_HOUR_LOG' && b.mutation_type === 'SUBMIT_HOUR_LOG') {
          const pA = a.payload as Record<string, any> | undefined;
          const pB = b.payload as Record<string, any> | undefined;
          const dateStrA = pA?.start_datetime || (pA?.log_date ? `${pA.log_date}T${pA.start_time || '00:00'}` : '');
          const dateStrB = pB?.start_datetime || (pB?.log_date ? `${pB.log_date}T${pB.start_time || '00:00'}` : '');
          const timeA = dateStrA ? new Date(dateStrA).getTime() : 0;
          const timeB = dateStrB ? new Date(dateStrB).getTime() : 0;
          if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
            return timeA - timeB;
          }
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      for (const item of itemsToProcess) {
        // Refresh item reference in current queue
        const currentItem = this.queue.find((q) => q.id === item.id);
        if (!currentItem || currentItem.status === 'conflict') continue;

        // Transition status to syncing
        await this.updateMutation(item.id, { status: 'syncing' });

        try {
          await this.executeMutation(currentItem);

          // Success: mark as synced, then remove from queue
          totalSyncedInRun++;
          await this.updateMutation(item.id, {
            status: 'synced',
            last_error: undefined,
          });

          // Prune synced item
          await this.removeMutation(item.id);
        } catch (error: any) {
          // Check if error is due to idempotency duplicate key constraint (row already exists in DB!)
          const errorMsg = (error?.message || '').toLowerCase();
          const errorCode = error?.code || '';
          const isIdempotencyReplay =
            (errorCode === '23505' || errorMsg.includes('unique constraint')) &&
            (errorMsg.includes('idempotency_key') || error?.details?.toLowerCase?.().includes('idempotency_key'));

          if (isIdempotencyReplay) {
            // Already synced previously! Mark synced and remove from queue
            totalSyncedInRun++;
            await this.updateMutation(item.id, {
              status: 'synced',
              last_error: undefined,
            });
            await this.removeMutation(item.id);
            continue;
          }

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
                last_error: error.message || 'Sync failed after network attempts. Will retry when connection stabilizes.',
              });
            }
          }
        }
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
      if (totalSyncedInRun > 0) {
        this.notifySyncComplete(totalSyncedInRun);
      }
    }
  }

  /**
   * Classifies whether an error is a business conflict/PostgreSQL constraint violation (D-05, Pitfall 3)
   */
  private isConflictError(error: any): boolean {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const code = error.code || '';
    const details = (error.details || '').toLowerCase();

    // Idempotency key duplicate is NOT a business conflict (it's already synced!)
    if (
      (code === '23505' || msg.includes('unique constraint')) &&
      (msg.includes('idempotency_key') || details.includes('idempotency_key'))
    ) {
      return false;
    }

    return (
      msg.includes('overlap') ||
      msg.includes('cannot be less than start meter') ||
      msg.includes('shift end timestamp') ||
      msg.includes('cannot log before shift end') ||
      msg.includes('breakdown duration') ||
      msg.includes('maintenance or decommissioned') ||
      msg.includes('unauthorized operator') ||
      msg.includes('client id does not match') ||
      msg.includes('assigned to shift') ||
      msg.includes('cannot exceed 24 hours') ||
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
      // Ensure user session exists/is valid if available
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id || null;

      const effectiveOperatorId = (payload.operator_id as string) || currentUserId || '';
      const effectiveEnteredBy = (payload.entered_by as string) || currentUserId || effectiveOperatorId;
      const startMeterNum = Number(payload.start_meter) || 0;
      const endMeterNum = Number(payload.end_meter) || 0;
      const overtimeNum = Number(payload.overtime_hours) || 0;
      const normalHoursNum = Number(payload.normal_working_hours) || 8;
      const breakdownHoursNum = Number(payload.breakdown_hours) || 0;
      const isBreakdown = Boolean(payload.is_breakdown);
      const effectiveKey = idempotency_key || (payload.idempotency_key as string) || generateUUID();

      const rpcParams = {
        p_machine_id: payload.machine_id,
        p_operator_id: effectiveOperatorId,
        p_client_id: payload.client_id || null,
        p_shift_code: payload.shift_code || null,
        p_log_date: payload.log_date || null,
        p_end_date: payload.end_date || payload.log_date || null,
        p_start_datetime: payload.start_datetime || null,
        p_end_datetime: payload.end_datetime || null,
        p_start_meter: startMeterNum,
        p_end_meter: endMeterNum,
        p_start_time: typeof payload.start_time === 'string' ? payload.start_time.trim() : null,
        p_end_time: typeof payload.end_time === 'string' ? payload.end_time.trim() : null,
        p_overtime_hours: overtimeNum,
        p_normal_working_hours: normalHoursNum,
        p_is_breakdown: isBreakdown,
        p_breakdown_start_time: payload.breakdown_start_time || null,
        p_breakdown_end_time: payload.breakdown_end_time || null,
        p_breakdown_duration: payload.breakdown_duration || null,
        p_breakdown_hours: breakdownHoursNum,
        p_shift: payload.shift || (payload.shift_code ? `Shift ${payload.shift_code}` : null),
        p_machine_condition: payload.machine_condition || (isBreakdown ? 'breakdown' : 'good'),
        p_location: payload.location || null,
        p_remarks: payload.remarks || null,
        p_idempotency_key: effectiveKey,
        p_entered_by: effectiveEnteredBy,
      };

      // 1. Try atomic PostgreSQL RPC execution first
      let rpcSucceeded = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc(
          'submit_operator_hour_log_atomic',
          rpcParams
        );

        if (!rpcErr && rpcRes && (rpcRes as any).success) {
          rpcSucceeded = true;
          return;
        } else if (rpcErr) {
          // If already inserted with this idempotency key, treat as success!
          const rpcErrMsg = (rpcErr.message || '').toLowerCase();
          if (
            (rpcErr.code === '23505' || rpcErrMsg.includes('unique constraint')) &&
            (rpcErrMsg.includes('idempotency_key') || rpcErr.details?.toLowerCase?.().includes('idempotency_key'))
          ) {
            rpcSucceeded = true;
            return;
          }

          if (this.isConflictError(rpcErr)) {
            throw rpcErr;
          }
        }
      } catch (rpcCatchErr: any) {
        const catchMsg = (rpcCatchErr?.message || '').toLowerCase();
        if (
          (rpcCatchErr?.code === '23505' || catchMsg.includes('unique constraint')) &&
          (catchMsg.includes('idempotency_key') || rpcCatchErr?.details?.toLowerCase?.().includes('idempotency_key'))
        ) {
          return;
        }

        if (this.isConflictError(rpcCatchErr)) {
          throw rpcCatchErr;
        }
      }

      // 2. Fallback direct table insert if RPC unavailable or had non-conflict error
      if (!rpcSucceeded) {
        const insertPayload: Record<string, any> = {
          machine_id: payload.machine_id,
          operator_id: effectiveOperatorId,
          client_id: payload.client_id || null,
          site_id: payload.site_id || null,
          log_date: payload.log_date,
          end_date: payload.end_date || payload.log_date || null,
          start_datetime: payload.start_datetime || null,
          end_datetime: payload.end_datetime || null,
          start_time: typeof payload.start_time === 'string' ? payload.start_time.trim() : null,
          end_time: typeof payload.end_time === 'string' ? payload.end_time.trim() : null,
          start_meter: startMeterNum,
          end_meter: endMeterNum,
          overtime_hours: overtimeNum,
          normal_working_hours: normalHoursNum,
          is_breakdown: isBreakdown,
          breakdown_start_time: payload.breakdown_start_time || null,
          breakdown_end_time: payload.breakdown_end_time || null,
          breakdown_duration: payload.breakdown_duration || null,
          breakdown_hours: breakdownHoursNum,
          shift: payload.shift || (payload.shift_code ? `Shift ${payload.shift_code}` : null),
          shift_code: payload.shift_code || null,
          machine_condition: payload.machine_condition || (isBreakdown ? 'breakdown' : 'good'),
          location: payload.location || null,
          remarks: payload.remarks || null,
          idempotency_key: effectiveKey,
          entered_by: effectiveEnteredBy,
          entry_source: payload.entry_source || 'operator',
        };

        // Remove any undefined keys to avoid SQL syntax/column mismatches
        Object.keys(insertPayload).forEach((k) => {
          if (insertPayload[k] === undefined) delete insertPayload[k];
        });

        const { error: insertErr } = await supabase
          .from('machine_hour_logs')
          .insert([insertPayload]);

        if (insertErr) {
          const insertErrMsg = (insertErr.message || '').toLowerCase();
          if (
            (insertErr.code === '23505' || insertErrMsg.includes('unique constraint')) &&
            (insertErrMsg.includes('idempotency_key') || insertErr.details?.toLowerCase?.().includes('idempotency_key'))
          ) {
            // Already saved!
            return;
          }
          throw insertErr;
        }

        // Update machine meter reading & health status
        const machineId = payload.machine_id as string;
        if (machineId && endMeterNum > 0) {
          await supabase
            .from('machines')
            .update({
              hour_meter: endMeterNum,
              health_status: isBreakdown ? 'breakdown' : 'active',
              updated_at: new Date().toISOString(),
              ...(effectiveOperatorId ? { current_operator_id: effectiveOperatorId } : {}),
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
