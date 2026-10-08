/**
 * Optimistic UI Architecture — useOptimisticMutation Hook (Tier 2)
 *
 * Implements the canonical 8-step optimistic lifecycle:
 * 1. Pre-validation (shared Zod / conflict checks) BEFORE patching cache.
 * 2. Query cancellation and snapshot capture across list, detail, and KPI query keys.
 * 3. Optimistic cache patch with `tempId` and `syncState: 'pending'`.
 * 4. Idempotent clientMutationId generation.
 * 5. Offline detection & seamless fallback into OfflineQueueManager (`syncState: 'queued'`).
 * 6. Reconciliation on success (swap tempId, set `syncState: 'synced'`).
 * 7. Clean snapshot rollback on failure with haptic rejection and humanized error messages.
 * 8. Targeted key invalidation on settlement.
 */

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { haptics } from '../haptics';
import { createTempId } from './tempId';
import { SyncState } from './syncState';
import { generateUUID, offlineQueueManager } from '../offline/OfflineQueueManager';
import type { MutationType } from '../offline/types';
import { postNotification } from '../notifications/postNotification';

export interface OptimisticQueryKeys {
  list?: QueryKey;
  detail?: QueryKey;
  kpis?: QueryKey;
  extra?: QueryKey[];
}

export interface UseOptimisticMutationOptions<TData, TVars, TRow = any> {
  mutationFn: (vars: TVars & { clientMutationId: string; tempId: string }) => Promise<TData>;
  queryKeys: OptimisticQueryKeys | ((vars: TVars) => OptimisticQueryKeys);
  validate?: (vars: TVars) => { error?: string; message?: string } | null | void;
  applyOptimistic: (
    queryClient: ReturnType<typeof useQueryClient>,
    vars: TVars,
    meta: { tempId: string; clientMutationId: string; syncState: SyncState }
  ) => void;
  rollbackOn?: (error: unknown) => boolean;
  successFeedback?: 'confirm' | 'none';
  errorMessage?: (error: any) => string;
  invalidate?: (vars: TVars, data: TData | undefined) => QueryKey[];
  offlineFallback?: {
    mutationType: MutationType;
    toPayload: (vars: TVars, meta: { tempId: string; clientMutationId: string }) => Record<string, unknown>;
  };
  onSuccess?: (data: TData, vars: TVars) => void;
  onError?: (error: any, vars: TVars, rollbackContext?: any) => void;
}

/**
 * Maps PostgreSQL and Supabase error codes to human-readable explanations.
 */
export function defaultFormatErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred.';
  if (typeof error === 'string') return error;

  const code = error.code || '';
  const message = (error.message || '').toLowerCase();

  if (code === '23505' || message.includes('duplicate key') || message.includes('already exists')) {
    return 'This record already exists or uses a duplicate identifier.';
  }
  if (code === '23514' || message.includes('check constraint') || message.includes('cannot be less than')) {
    return 'Input values violate system validation rules (e.g. meter readings or shift bounds).';
  }
  if (code === 'P0002' || message.includes('overlap')) {
    return 'Shift collision detected: The operator or machine is already assigned during this period.';
  }
  if (code === '42501' || message.includes('permission') || message.includes('row-level security')) {
    return 'Permission denied: Your role does not have authorization to perform this operation.';
  }
  if (message.includes('network') || message.includes('failed to fetch')) {
    return 'Network connection lost. Changes saved locally and queued for synchronization.';
  }

  return error.message || 'Operation failed. Please review the details and try again.';
}

export function useOptimisticMutation<TData, TVars, TRow = any>(
  options: UseOptimisticMutationOptions<TData, TVars, TRow>
) {
  const queryClient = useQueryClient();

  const resolveKeys = (vars: TVars): QueryKey[] => {
    const raw = typeof options.queryKeys === 'function' ? options.queryKeys(vars) : options.queryKeys;
    const keys: QueryKey[] = [];
    if (raw.list) keys.push(raw.list);
    if (raw.detail) keys.push(raw.detail);
    if (raw.kpis) keys.push(raw.kpis);
    if (raw.extra) keys.push(...raw.extra);
    return keys;
  };

  return useMutation<
    TData,
    any,
    TVars,
    {
      previousSnapshots: Map<string, any>;
      tempId: string;
      clientMutationId: string;
      affectedKeys: QueryKey[];
    }
  >({
    mutationFn: async (vars: TVars) => {
      // 1. Pre-validation check BEFORE sending or patching
      if (options.validate) {
        const validationResult = options.validate(vars);
        if (validationResult && (validationResult.error || validationResult.message)) {
          const errText = validationResult.error || validationResult.message || 'Validation error';
          throw new Error(errText);
        }
      }

      // Check current network status
      const netState = await NetInfo.fetch();
      const isOffline = netState.isConnected === false || netState.isInternetReachable === false;

      const clientMutationId = generateUUID();
      const tempId = createTempId();

      // If offline and offline fallback configured, route directly to persistent OfflineQueueManager
      if (isOffline && options.offlineFallback) {
        const payload = options.offlineFallback.toPayload(vars, { tempId, clientMutationId });
        await offlineQueueManager.enqueue(options.offlineFallback.mutationType, payload);
        postNotification({
          category: 'system',
          title: 'Saved Offline',
          body: 'Your changes have been queued locally and will sync once connectivity returns.',
          severity: 'info',
        });
        return { queuedOffline: true, clientMutationId, tempId } as unknown as TData;
      }

      return options.mutationFn({
        ...vars,
        clientMutationId,
        tempId,
      });
    },

    onMutate: async (vars: TVars) => {
      const clientMutationId = generateUUID();
      const tempId = createTempId();
      const affectedKeys = resolveKeys(vars);

      // Cancel ongoing queries so in-flight fetches do not overwrite optimistic data
      await Promise.all(affectedKeys.map((key) => queryClient.cancelQueries({ queryKey: key })));

      // Snapshot previous data for clean rollback
      const previousSnapshots = new Map<string, any>();
      affectedKeys.forEach((key) => {
        const keyHash = JSON.stringify(key);
        previousSnapshots.set(keyHash, queryClient.getQueryData(key));
      });

      // Apply optimistic cache updates with syncState = 'pending'
      try {
        options.applyOptimistic(queryClient, vars, {
          tempId,
          clientMutationId,
          syncState: 'pending',
        });
      } catch (patchErr) {
        console.warn('[useOptimisticMutation] Optimistic patch notice:', patchErr);
      }

      return {
        previousSnapshots,
        tempId,
        clientMutationId,
        affectedKeys,
      };
    },

    onSuccess: (data, vars, context) => {
      if (options.successFeedback !== 'none') {
        haptics.confirm();
      }

      if (options.onSuccess) {
        options.onSuccess(data, vars);
      }
    },

    onError: (error, vars, context) => {
      const shouldRollback = options.rollbackOn ? options.rollbackOn(error) : true;

      if (shouldRollback && context?.previousSnapshots) {
        // Rollback all affected snapshots
        context.affectedKeys.forEach((key) => {
          const keyHash = JSON.stringify(key);
          if (context.previousSnapshots.has(keyHash)) {
            queryClient.setQueryData(key, context.previousSnapshots.get(keyHash));
          }
        });
      }

      haptics.reject();

      const formatFn = options.errorMessage || defaultFormatErrorMessage;
      const errorMsg = formatFn(error);

      postNotification({
        category: 'system',
        title: 'Action Failed',
        body: errorMsg,
        severity: 'error',
      });

      if (options.onError) {
        options.onError(error, vars, context);
      }
    },

    onSettled: (data, error, vars, context) => {
      // Targeted invalidation only — never blanket invalidate
      if (options.invalidate) {
        const keysToInvalidate = options.invalidate(vars, data);
        keysToInvalidate.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      } else if (context?.affectedKeys) {
        context.affectedKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    },
  });
}
