/**
 * Optimistic UI Architecture — Reconciliation Engine
 * Responsibilities:
 * 1. Swap temporary IDs (`tmp_<uuid>`) with server-acknowledged rows/IDs upon mutation success.
 * 2. Deduplicate Supabase Realtime echoes against active clientMutationIds.
 * 3. Preserve optimistic field invariants and transition syncState from 'pending' to 'synced'.
 */

import { isTempId } from './tempId';
import { SyncState } from './syncState';

export interface ReconcilableItem {
  id: string;
  syncState?: SyncState;
  clientMutationId?: string;
  [key: string]: any;
}

/**
 * Replaces an optimistic temp row with the permanent server row.
 * Matches either by tempId or by clientMutationId.
 */
export function reconcileRow<T extends ReconcilableItem>(
  items: T[],
  tempId: string,
  serverRow: Partial<T> & { id: string }
): T[] {
  let found = false;
  const next = items.map((item) => {
    const isMatch =
      item.id === tempId ||
      (serverRow.clientMutationId && item.clientMutationId === serverRow.clientMutationId) ||
      (item.id && isTempId(item.id) && serverRow.id && item.clientMutationId && item.clientMutationId === (serverRow as any).clientMutationId);

    if (isMatch) {
      found = true;
      return {
        ...item,
        ...serverRow,
        id: serverRow.id,
        syncState: 'synced' as SyncState,
        syncErrorMessage: undefined,
      } as T;
    }
    return item;
  });

  // If not found in current items (e.g. paginated or prepended), add it safely
  if (!found) {
    const reconciledItem = {
      ...serverRow,
      syncState: 'synced' as SyncState,
    } as T;
    return [reconciledItem, ...next];
  }

  return next;
}

/**
 * Removes a temporary item on rollback/failure.
 */
export function removeTempRow<T extends { id: string }>(items: T[], tempId: string): T[] {
  return items.filter((item) => item.id !== tempId);
}

/**
 * Checks if a Realtime event payload or incoming row is an echo of an in-flight
 * client mutation by comparing clientMutationId.
 */
export function isRealtimeEcho(
  incomingPayload: Record<string, any> | null | undefined,
  activeMutationIds: Set<string> | string[]
): boolean {
  if (!incomingPayload) return false;
  const mutationId =
    incomingPayload.clientMutationId ||
    incomingPayload.client_mutation_id ||
    incomingPayload.idempotency_key;

  if (!mutationId) return false;

  if (activeMutationIds instanceof Set) {
    return activeMutationIds.has(mutationId);
  }
  return activeMutationIds.includes(mutationId);
}
