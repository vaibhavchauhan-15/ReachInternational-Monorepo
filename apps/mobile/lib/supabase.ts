/**
 * ServiceCentric Mobile — Supabase JS Client Initializer
 * Connects Expo React Native mobile app to the authoritative Supabase backend.
 * Uses EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 *
 * SECURITY & PERSISTENCE INVARIANTS:
 * 1. Hardware-backed expo-secure-store on Native (iOS Keychain / Android Keystore)
 *    is the EXCLUSIVE storage mechanism for authentication and refresh tokens.
 * 2. ZERO Plaintext Fallback: Session tokens are NEVER written unencrypted to AsyncStorage.
 * 3. Keystore Chunking: Payloads exceeding 1800 characters are safely partitioned into
 *    multiple SecureStore keys, ensuring 100% hardware keystore encryption across all Android/iOS versions.
 * 4. AppState-driven token auto-refresh listener registered strictly as a singleton.
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import { getSupabaseUrl, getSupabaseAnonKey } from './env';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

// In-memory fallback for non-native web SSR / test environments
const memoryStore = new Map<string, string>();

/**
 * Android KeyStore entry threshold: 1800 chars (well below Android 2048 byte limit)
 */
const SECURE_CHUNK_SIZE = 1800;

/**
 * Format key to be compliant with Android KeyStore / iOS Keychain naming rules
 */
function sanitizeSecureKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Hardware-backed secure storage adapter for Supabase Auth.
 * All token data is encrypted via hardware KeyStore / Keychain with zero plaintext AsyncStorage fallback.
 */
export const mobileSecureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    // 1. Web Environment
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          return window.localStorage.getItem(key);
        } catch {
          return memoryStore.get(key) || null;
        }
      }
      return memoryStore.get(key) || null;
    }

    // 2. Native Environment (iOS Keychain / Android KeyStore)
    const sanitizedKey = sanitizeSecureKey(key);
    try {
      // Check if value was stored across multiple secure chunks
      const chunksCountStr = await SecureStore.getItemAsync(`${sanitizedKey}__count`);
      if (chunksCountStr !== null) {
        const count = parseInt(chunksCountStr, 10);
        if (!isNaN(count) && count > 0) {
          const chunkPromises: Promise<string | null>[] = [];
          for (let i = 0; i < count; i++) {
            chunkPromises.push(SecureStore.getItemAsync(`${sanitizedKey}__chunk_${i}`));
          }
          const chunks = await Promise.all(chunkPromises);
          if (chunks.every((c) => c !== null)) {
            return chunks.join('');
          }
        }
      }

      // Read single chunk
      const value = await SecureStore.getItemAsync(sanitizedKey);
      if (value !== null) {
        return value;
      }

      // Clean up any legacy unencrypted fallback keys from older versions
      AsyncStorage.removeItem(`@secure_fallback_${sanitizedKey}`).catch(() => {});

      return null;
    } catch (error) {
      if (__DEV__) {
        console.warn(`[mobileSecureStorage] SecureStore read failure for ${sanitizedKey}:`, error);
      }
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    // 1. Web Environment
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(key, value);
          return;
        } catch {
          memoryStore.set(key, value);
          return;
        }
      }
      memoryStore.set(key, value);
      return;
    }

    // 2. Native Environment (iOS Keychain / Android KeyStore)
    const sanitizedKey = sanitizeSecureKey(key);
    try {
      // Purge any legacy unencrypted fallback from disk
      AsyncStorage.removeItem(`@secure_fallback_${sanitizedKey}`).catch(() => {});

      if (value.length <= SECURE_CHUNK_SIZE) {
        // Direct single entry
        await SecureStore.setItemAsync(sanitizedKey, value);

        // Clean up any previous chunk markers if payload shrank
        const previousCountStr = await SecureStore.getItemAsync(`${sanitizedKey}__count`).catch(() => null);
        if (previousCountStr) {
          const prevCount = parseInt(previousCountStr, 10);
          const deletions: Promise<void>[] = [SecureStore.deleteItemAsync(`${sanitizedKey}__count`)];
          for (let i = 0; i < prevCount; i++) {
            deletions.push(SecureStore.deleteItemAsync(`${sanitizedKey}__chunk_${i}`));
          }
          await Promise.allSettled(deletions);
        }
      } else {
        // Partition into encrypted chunks inside SecureStore
        const chunkCount = Math.ceil(value.length / SECURE_CHUNK_SIZE);
        const setPromises: Promise<void>[] = [
          SecureStore.setItemAsync(`${sanitizedKey}__count`, String(chunkCount)),
        ];

        for (let i = 0; i < chunkCount; i++) {
          const chunk = value.slice(i * SECURE_CHUNK_SIZE, (i + 1) * SECURE_CHUNK_SIZE);
          setPromises.push(SecureStore.setItemAsync(`${sanitizedKey}__chunk_${i}`, chunk));
        }

        await Promise.all(setPromises);

        // Remove single key if it previously existed
        SecureStore.deleteItemAsync(sanitizedKey).catch(() => {});
      }
    } catch (error) {
      if (__DEV__) {
        console.warn(`[mobileSecureStorage] SecureStore write failure for ${sanitizedKey}:`, error);
      }
      // Never store unencrypted in AsyncStorage. Fail securely.
    }
  },

  removeItem: async (key: string): Promise<void> => {
    // 1. Web Environment
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          memoryStore.delete(key);
        }
      }
      memoryStore.delete(key);
      return;
    }

    // 2. Native Environment
    const sanitizedKey = sanitizeSecureKey(key);
    memoryStore.delete(key);

    try {
      const deletions: Promise<any>[] = [
        SecureStore.deleteItemAsync(sanitizedKey).catch(() => {}),
        AsyncStorage.removeItem(`@secure_fallback_${sanitizedKey}`).catch(() => {}),
      ];

      const chunksCountStr = await SecureStore.getItemAsync(`${sanitizedKey}__count`).catch(() => null);
      if (chunksCountStr !== null) {
        const count = parseInt(chunksCountStr, 10);
        deletions.push(SecureStore.deleteItemAsync(`${sanitizedKey}__count`).catch(() => {}));
        for (let i = 0; i < count; i++) {
          deletions.push(SecureStore.deleteItemAsync(`${sanitizedKey}__chunk_${i}`).catch(() => {}));
        }
      }

      await Promise.allSettled(deletions);
    } catch {
      // Non-fatal cleanup error
    }
  },
};

export const mobileStorage = mobileSecureStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: mobileSecureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Singleton registration guard for AppState auto-refresh listener
let isAppStateListenerBound = false;

export function initSupabaseAppStateLifecycle(): () => void {
  if (Platform.OS === 'web' || isAppStateListenerBound) {
    return () => {};
  }

  isAppStateListenerBound = true;

  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
      // On foreground, verify session freshness safely
      supabase.auth.getSession().catch(() => {});
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);

  return () => {
    subscription.remove();
    isAppStateListenerBound = false;
  };
}

// Automatically bind singleton lifecycle listener on native
if (Platform.OS !== 'web' && !isAppStateListenerBound) {
  initSupabaseAppStateLifecycle();
}
