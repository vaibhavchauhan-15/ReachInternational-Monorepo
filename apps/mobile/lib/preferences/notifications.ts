/**
 * ReachInternational Mobile — Reactive Notification Preferences Store
 * Provides synchronous optimistic reads/writes using useSyncExternalStore
 * backed by persistent AsyncStorage caching.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export const NOTIF_PREFS_KEY = '@reach:notification_preferences';

export interface NotificationPreferences {
  push: boolean;
  shiftReminders: boolean;
  breakdownAlerts: boolean;
  assignmentAlerts: boolean;
  overtimeAlerts: boolean;
  logSubmissions: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  push: true,
  shiftReminders: true,
  breakdownAlerts: true,
  assignmentAlerts: true,
  overtimeAlerts: true,
  logSubmissions: true,
};

let cachedNotifPrefs: NotificationPreferences = { ...DEFAULT_NOTIF_PREFS };
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
 * Hydrates notification preferences from AsyncStorage on startup.
 */
export async function hydrateNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        cachedNotifPrefs = {
          ...DEFAULT_NOTIF_PREFS,
          ...parsed,
        };
      }
    }
  } catch (err) {
    console.warn('[NotificationPrefsStore] Failed to hydrate:', err);
  } finally {
    isHydrated = true;
    notify();
  }
  return cachedNotifPrefs;
}

// Trigger early hydration on module import
hydrateNotificationPreferences().catch(() => {});

/**
 * Synchronous snapshot getter for React / non-React callers
 */
export function getNotificationPreferences(): NotificationPreferences {
  return cachedNotifPrefs;
}

/**
 * Updates notification preferences optimistically and persists in background
 */
export async function setNotificationPreferences(
  updater:
    | Partial<NotificationPreferences>
    | ((prev: NotificationPreferences) => NotificationPreferences)
): Promise<NotificationPreferences> {
  const next =
    typeof updater === 'function'
      ? updater(cachedNotifPrefs)
      : { ...cachedNotifPrefs, ...updater };

  cachedNotifPrefs = next;
  notify();

  try {
    await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[NotificationPrefsStore] Failed to persist:', err);
  }

  return next;
}

/**
 * Toggles a single notification preference channel optimistically
 */
export async function toggleNotificationChannel(
  key: keyof NotificationPreferences
): Promise<boolean> {
  const updatedValue = !cachedNotifPrefs[key];
  await setNotificationPreferences({ [key]: updatedValue });
  return updatedValue;
}

/**
 * Store subscriber for useSyncExternalStore
 */
export function subscribeNotificationPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook for consuming and mutating notification preferences optimistically
 */
export function useNotificationPreferences() {
  const prefs = useSyncExternalStore(
    subscribeNotificationPreferences,
    getNotificationPreferences,
    getNotificationPreferences
  );

  const activeCount = Object.entries(prefs).filter(
    ([k, v]) => k !== 'push' && Boolean(v)
  ).length;

  return {
    prefs,
    pushEnabled: prefs.push,
    activeCount,
    setPreferences: setNotificationPreferences,
    toggleChannel: toggleNotificationChannel,
    isHydrated,
  };
}
