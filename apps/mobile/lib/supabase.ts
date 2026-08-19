/**
 * ServiceCentric Mobile — Supabase JS Client Initializer
 * Connects Expo React Native mobile app to the authoritative Supabase backend.
 * Uses EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://reachinternation.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key';

// Mobile storage adapter for session persistence
class MobileStorageAdapter {
  private memoryStore = new Map<string, string>();

  getItem(key: string): string | null {
    return this.memoryStore.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.memoryStore.set(key, value);
  }

  removeItem(key: string): void {
    this.memoryStore.delete(key);
  }
}

export const mobileStorage = new MobileStorageAdapter();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: mobileStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
