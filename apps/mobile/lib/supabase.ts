/**
 * ServiceCentric Mobile — Supabase JS Client Initializer
 * Connects Expo React Native mobile app to the authoritative Supabase backend.
 * Uses EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 *
 * SECURITY: Utilizes hardware-backed expo-secure-store on Native (iOS Keychain / Android Keystore)
 * for encrypted persistent storage of authentication and refresh tokens.
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[Supabase] CRITICAL: Missing required environment variables EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Set these in your .env file or EAS build secrets.'
  );
}

// In-memory fallback for environments without SecureStore or web storage
const memoryStore = new Map<string, string>();

/**
 * Format key to be compliant with Android KeyStore / iOS Keychain naming rules
 */
function sanitizeSecureKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Hardware-backed secure storage adapter for Supabase Auth in React Native & Web
 */
export const mobileSecureStorage = {
  getItem: async (key: string): Promise<string | null> => {
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

    try {
      const sanitizedKey = sanitizeSecureKey(key);
      const value = await SecureStore.getItemAsync(sanitizedKey);
      return value;
    } catch (error) {
      console.warn('[SecureStore] Failed to read key, falling back to memory:', error);
      return memoryStore.get(key) || null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
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

    try {
      const sanitizedKey = sanitizeSecureKey(key);
      await SecureStore.setItemAsync(sanitizedKey, value);
    } catch (error) {
      console.warn('[SecureStore] Failed to persist key, falling back to memory:', error);
      memoryStore.set(key, value);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(key);
          return;
        } catch {
          memoryStore.delete(key);
          return;
        }
      }
      memoryStore.delete(key);
      return;
    }

    try {
      const sanitizedKey = sanitizeSecureKey(key);
      await SecureStore.deleteItemAsync(sanitizedKey);
    } catch (error) {
      console.warn('[SecureStore] Failed to delete key:', error);
      memoryStore.delete(key);
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
