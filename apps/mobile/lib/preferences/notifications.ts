/**
 * ReachInternational Mobile — Reactive Notification Preferences Store
 * Provides synchronous optimistic reads/writes using useSyncExternalStore
 * backed by persistent AsyncStorage caching and authoritative Supabase synchronization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore, useEffect } from 'react';
import { supabase } from '../supabase';

export const NOTIF_PREFS_KEY = '@reach:notification_preferences_v2';

export interface NotificationPreferences {
  push: boolean;
  shiftReminders: boolean;
  breakdownAlerts: boolean;
  assignmentAlerts: boolean;
  adminAlerts: boolean;
  payrollAlerts: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  // Deprecated legacy channels preserved for backward compatibility
  overtimeAlerts?: boolean;
  logSubmissions?: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotificationPreferences = {
  push: true,
  shiftReminders: true,
  breakdownAlerts: true,
  assignmentAlerts: true,
  adminAlerts: true,
  payrollAlerts: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '06:00',
  overtimeAlerts: false,
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
 * Synchronizes user notification preferences from Supabase database
 */
export async function fetchServerPreferences(userId: string): Promise<NotificationPreferences | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[NotificationPrefsStore] Failed to fetch server preferences:', error);
      return null;
    }

    if (data) {
      const mapped: NotificationPreferences = {
        push: Boolean(data.push_enabled),
        shiftReminders: Boolean(data.shift_reminders),
        breakdownAlerts: Boolean(data.breakdown_alerts),
        assignmentAlerts: Boolean(data.assignment_alerts),
        adminAlerts: Boolean(data.admin_alerts),
        payrollAlerts: Boolean(data.payroll_alerts),
        quietHoursEnabled: Boolean(data.quiet_hours_enabled),
        quietHoursStart: data.quiet_hours_start ? String(data.quiet_hours_start).slice(0, 5) : '22:00',
        quietHoursEnd: data.quiet_hours_end ? String(data.quiet_hours_end).slice(0, 5) : '06:00',
      };

      cachedNotifPrefs = { ...cachedNotifPrefs, ...mapped };
      await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(cachedNotifPrefs));
      notify();
      return cachedNotifPrefs;
    }
  } catch (err) {
    console.warn('[NotificationPrefsStore] Error loading server preferences:', err);
  }
  return null;
}

/**
 * Synchronous snapshot getter for React / non-React callers
 */
export function getNotificationPreferences(): NotificationPreferences {
  return cachedNotifPrefs;
}

/**
 * Updates notification preferences optimistically and persists to AsyncStorage and Supabase
 */
export async function setNotificationPreferences(
  updater:
    | Partial<NotificationPreferences>
    | ((prev: NotificationPreferences) => NotificationPreferences),
  userId?: string
): Promise<NotificationPreferences> {
  const next =
    typeof updater === 'function'
      ? updater(cachedNotifPrefs)
      : { ...cachedNotifPrefs, ...updater };

  cachedNotifPrefs = next;
  notify();

  try {
    await AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next));

    if (userId) {
      const { error } = await supabase.from('user_notification_preferences').upsert({
        user_id: userId,
        push_enabled: next.push,
        shift_reminders: next.shiftReminders,
        breakdown_alerts: next.breakdownAlerts,
        assignment_alerts: next.assignmentAlerts,
        admin_alerts: next.adminAlerts,
        payroll_alerts: next.payrollAlerts,
        quiet_hours_enabled: next.quietHoursEnabled,
        quiet_hours_start: next.quietHoursStart.length === 5 ? `${next.quietHoursStart}:00` : next.quietHoursStart,
        quiet_hours_end: next.quietHoursEnd.length === 5 ? `${next.quietHoursEnd}:00` : next.quietHoursEnd,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.warn('[NotificationPrefsStore] Failed to sync preferences to Supabase:', error);
      }
    }
  } catch (err) {
    console.warn('[NotificationPrefsStore] Failed to persist:', err);
  }

  return next;
}

/**
 * Toggles a single notification preference channel optimistically
 */
export async function toggleNotificationChannel(
  key: keyof NotificationPreferences,
  userId?: string
): Promise<boolean> {
  const updatedValue = !cachedNotifPrefs[key];
  await setNotificationPreferences({ [key]: updatedValue }, userId);
  return Boolean(updatedValue);
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
export function useNotificationPreferences(userId?: string) {
  const prefs = useSyncExternalStore(
    subscribeNotificationPreferences,
    getNotificationPreferences,
    getNotificationPreferences
  );

  useEffect(() => {
    if (userId) {
      fetchServerPreferences(userId).catch(() => {});
    }
  }, [userId]);

  const activeCount = [
    prefs.shiftReminders,
    prefs.breakdownAlerts,
    prefs.assignmentAlerts,
    prefs.adminAlerts,
    prefs.payrollAlerts,
  ].filter(Boolean).length;

  return {
    prefs,
    pushEnabled: prefs.push,
    activeCount,
    setPreferences: (updater: Partial<NotificationPreferences> | ((prev: NotificationPreferences) => NotificationPreferences)) =>
      setNotificationPreferences(updater, userId),
    toggleChannel: (key: keyof NotificationPreferences) => toggleNotificationChannel(key, userId),
    isHydrated,
  };
}
