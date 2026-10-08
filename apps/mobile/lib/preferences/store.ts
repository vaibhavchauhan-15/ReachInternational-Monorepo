import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface UserPreferences {
  hapticsEnabled: boolean;
  reduceMotion: 'system';
}

const STORAGE_KEY = '@reach:preferences';
const LEGACY_HAPTICS_KEY = '@reach:haptics_enabled';

let cachedPreferences: UserPreferences = {
  hapticsEnabled: true,
  reduceMotion: 'system',
};

let isHydrated = false;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Safe guard against listener errors
    }
  });
}

/**
 * Hydrates preferences asynchronously from AsyncStorage into module cache.
 */
export async function hydratePreferences(): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        cachedPreferences = {
          ...cachedPreferences,
          ...parsed,
          reduceMotion: 'system', // Always follows system setting per plan
        };
      }
    } else {
      // Check legacy storage key for backward compatibility
      const legacy = await AsyncStorage.getItem(LEGACY_HAPTICS_KEY);
      if (legacy !== null) {
        cachedPreferences.hapticsEnabled = legacy === 'true';
      }
    }
  } catch (err) {
    console.warn('[PreferencesStore] Failed to hydrate preferences:', err);
  } finally {
    isHydrated = true;
    notify();
  }
  return cachedPreferences;
}

// Trigger early hydration on module import
hydratePreferences().catch(() => {});

/**
 * Synchronous snapshot getter for non-React callers (e.g. haptic guards)
 */
export function getPreferences(): UserPreferences {
  return cachedPreferences;
}

/**
 * Synchronous boolean getter specifically for haptic guards
 */
export function isHapticsEnabled(): boolean {
  return cachedPreferences.hapticsEnabled;
}

/**
 * Updates haptics preference and persists to AsyncStorage
 */
export async function setHapticsEnabled(enabled: boolean): Promise<void> {
  cachedPreferences = {
    ...cachedPreferences,
    hapticsEnabled: enabled,
  };
  notify();
  try {
    await Promise.all([
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cachedPreferences)),
      AsyncStorage.setItem(LEGACY_HAPTICS_KEY, String(enabled)),
    ]);
  } catch (err) {
    console.warn('[PreferencesStore] Failed to persist preferences:', err);
  }
}

/**
 * Store subscriber for useSyncExternalStore
 */
export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook for consuming and updating user preferences
 */
export function usePreferences(): {
  preferences: UserPreferences;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
  isHydrated: boolean;
} {
  const prefs = useSyncExternalStore(
    subscribePreferences,
    getPreferences,
    getPreferences
  );

  return {
    preferences: prefs,
    hapticsEnabled: prefs.hapticsEnabled,
    setHapticsEnabled,
    isHydrated,
  };
}

/**
 * Helper to check hydration status
 */
export function isPreferencesHydrated(): boolean {
  return isHydrated;
}
