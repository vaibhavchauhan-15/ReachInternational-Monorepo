/**
 * Optimistic UI Architecture — Persistent Query Cache
 * Conforms to Section 4.3 of Optimistic UI Implementation Plan:
 * - Uses @tanstack/query-async-storage-persister and AsyncStorage.
 * - 24-hour maxAge, buster derived from app version.
 * - Strict Deny-List: Sensitive queries (payroll, salary, bank, KYC, auth, docs)
 *   are NEVER saved to AsyncStorage (enforced via meta: { sensitive: true } and key checks).
 * - Strips optimistic temporary IDs (`tmp_*`) before dehydration so stale temp rows never persist.
 * - Exposes clearPersistedCache() for logout and role change cleanup.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import Constants from 'expo-constants';
import type { Query, DehydrateOptions } from '@tanstack/react-query';
import { isTempId } from './tempId';

export const PERSIST_CACHE_STORAGE_KEY = '@reach:react_query_cache_v1';
export const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

export const appBuster =
  Constants.expoConfig?.version ||
  Constants.manifest2?.extra?.expoClient?.version ||
  '1.3.0';

/**
 * Strips temporary optimistic rows (`tmp_*`) from cached collections before dehydration.
 */
export function sanitizeDataForPersistence<T>(data: T): T {
  if (!data) return data;

  if (Array.isArray(data)) {
    return data
      .filter((item) => {
        if (item && typeof item === 'object' && 'id' in item) {
          return !isTempId(item.id);
        }
        return true;
      })
      .map((item) => sanitizeDataForPersistence(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const record = data as Record<string, any>;
    // If the record itself is an optimistic temp item, omit or preserve non-temp
    if ('id' in record && isTempId(record.id)) {
      return null as unknown as T;
    }

    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(record)) {
      cleaned[key] = sanitizeDataForPersistence(record[key]);
    }
    return cleaned as T;
  }

  return data;
}

/**
 * Deny-list predicate: ensures sensitive domains NEVER persist into AsyncStorage.
 */
export function isSensitiveQuery(query: Query): boolean {
  if (query.meta?.sensitive === true) {
    return true;
  }

  const keyString = JSON.stringify(query.queryKey).toLowerCase();
  const sensitivePatterns = [
    'payroll',
    'salary',
    'bank',
    'aadhaar',
    'licence',
    'license',
    'document',
    'documents',
    'signed-url',
    'auth',
    'session',
    'token',
    'credential',
    'security',
    'account-deletion',
  ];

  return sensitivePatterns.some((pattern) => keyString.includes(pattern));
}

export const dehydrateOptions = {
  shouldDehydrateQuery: (query: any) => {
    // 1. Exclude sensitive and protected data
    if (isSensitiveQuery(query)) {
      return false;
    }
    // 2. Only dehydrate successful queries
    return query?.state?.status === 'success';
  },
};

/**
 * AsyncStorage persister instance configured for 24h cache persistence.
 */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_CACHE_STORAGE_KEY,
  throttleTime: 1000,
  serialize: (client) => {
    // Deep-sanitize client data to remove tmp_ records before writing to disk
    const sanitizedClient = {
      ...client,
      clientState: {
        ...client.clientState,
        queries: client.clientState.queries.map((q) => ({
          ...q,
          state: {
            ...q.state,
            data: sanitizeDataForPersistence(q.state.data),
          },
        })),
      },
    };
    return JSON.stringify(sanitizedClient);
  },
  deserialize: (cachedString) => JSON.parse(cachedString),
});

/**
 * Purges the entire persisted query cache from disk.
 * MUST be invoked on user logout and role changes.
 */
export async function clearPersistedCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PERSIST_CACHE_STORAGE_KEY);
  } catch (err) {
    console.warn('[OptimisticPersist] Error clearing persisted cache:', err);
  }
}
