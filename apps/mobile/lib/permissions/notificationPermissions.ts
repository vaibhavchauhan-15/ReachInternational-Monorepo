/**
 * ReachInternational Mobile — System & Notification Permissions Service
 * Manages runtime and install-time permissions:
 * - INTERNET: Install-time (Supabase API & Data Sync)
 * - ACCESS_NETWORK_STATE: Install-time (NetInfo offline/online telemetry)
 * - POST_NOTIFICATIONS: Runtime on Android 13+ (API 33+), Web Notification API, & persistent app state
 */

import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface AppPermissionItem {
  key: string;
  name: string;
  required: boolean;
  status: PermissionStatus;
  type: 'install_time' | 'runtime';
  description: string;
}

export interface AppPermissionsOverview {
  internet: AppPermissionItem;
  networkState: AppPermissionItem;
  notifications: AppPermissionItem;
}

const STORAGE_KEY_STATUS = '@reach:notif_permission_status';
const STORAGE_KEY_DISMISSED_AT = '@reach:notif_permission_dismissed_at';
const STORAGE_KEY_PROMPTED_COUNT = '@reach:notif_permission_prompted_count';

// 7 days cooldown between soft dismissals
const DISMISSAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Evaluates real-time Notification permission status across platforms
 */
export async function getNotificationPermissionStatus(): Promise<PermissionStatus> {
  try {
    // 1. Android Native Check
    if (Platform.OS === 'android') {
      const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
      
      // Android < 13 (API < 33) grants notification permission automatically upon install
      if (androidVersion < 33) {
        return 'granted';
      }

      // Android 13+ requires POST_NOTIFICATIONS runtime check
      if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (hasPermission) {
          await AsyncStorage.setItem(STORAGE_KEY_STATUS, 'granted');
          return 'granted';
        }
      }
    }

    // 2. Web Browser Notification API Check
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      const webStatus = window.Notification.permission;
      if (webStatus === 'granted') {
        await AsyncStorage.setItem(STORAGE_KEY_STATUS, 'granted');
        return 'granted';
      }
      if (webStatus === 'denied') {
        await AsyncStorage.setItem(STORAGE_KEY_STATUS, 'denied');
        return 'denied';
      }
      return 'undetermined';
    }

    // 3. Fallback to AsyncStorage state
    const saved = await AsyncStorage.getItem(STORAGE_KEY_STATUS);
    if (saved === 'granted') return 'granted';
    if (saved === 'denied') return 'denied';

    return 'undetermined';
  } catch (error) {
    console.warn('[Permissions] Failed to check notification permission status:', error);
    return 'undetermined';
  }
}

/**
 * Triggers the native platform or browser permission prompt for notifications
 */
export async function requestNotificationPermission(): Promise<PermissionStatus> {
  try {
    // 1. Android Native Request
    if (Platform.OS === 'android') {
      const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);

      if (androidVersion < 33) {
        await AsyncStorage.setItem(STORAGE_KEY_STATUS, 'granted');
        return 'granted';
      }

      if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Enable Fleet & Shift Notifications',
            message:
              'ReachInternational requires notification access to alert you about shift conflicts, machine assignments, and emergency maintenance notices.',
            buttonPositive: 'Allow',
            buttonNegative: 'Not Now',
          }
        );

        const status: PermissionStatus =
          result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';

        await AsyncStorage.setItem(STORAGE_KEY_STATUS, status);
        return status;
      }
    }

    // 2. Web Browser Notification Request
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      const result = await window.Notification.requestPermission();
      const status: PermissionStatus =
        result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'undetermined';

      await AsyncStorage.setItem(STORAGE_KEY_STATUS, status);
      return status;
    }

    // 3. Default Simulated/Granted fallback for development and non-APIs
    await AsyncStorage.setItem(STORAGE_KEY_STATUS, 'granted');
    return 'granted';
  } catch (error) {
    console.warn('[Permissions] Error requesting notification permission:', error);
    await AsyncStorage.setItem(STORAGE_KEY_STATUS, 'denied');
    return 'denied';
  }
}

/**
 * Determines whether the user should be prompted for notification permissions
 * Called after installation / user login.
 */
export async function shouldPromptNotificationPermission(): Promise<boolean> {
  try {
    const currentStatus = await getNotificationPermissionStatus();
    if (currentStatus === 'granted') {
      return false;
    }

    const dismissedAt = await AsyncStorage.getItem(STORAGE_KEY_DISMISSED_AT);
    if (!dismissedAt) {
      return true; // Never prompted before -> prompt immediately
    }

    const lastDismissedTime = parseInt(dismissedAt, 10);
    const now = Date.now();

    // Re-prompt only after cooldown
    return now - lastDismissedTime > DISMISSAL_COOLDOWN_MS;
  } catch {
    return false;
  }
}

/**
 * Records when a user chooses "Maybe Later" / "Not Now"
 */
export async function dismissNotificationPrompt(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_DISMISSED_AT, String(Date.now()));
    const countStr = await AsyncStorage.getItem(STORAGE_KEY_PROMPTED_COUNT);
    const count = countStr ? parseInt(countStr, 10) + 1 : 1;
    await AsyncStorage.setItem(STORAGE_KEY_PROMPTED_COUNT, String(count));
  } catch (err) {
    console.warn('[Permissions] Failed to record dismissal:', err);
  }
}

/**
 * Returns structured overview of all declared app permissions
 */
export async function getAppPermissionsOverview(): Promise<AppPermissionsOverview> {
  const notifStatus = await getNotificationPermissionStatus();

  return {
    internet: {
      key: 'INTERNET',
      name: 'Internet Access',
      required: true,
      status: 'granted',
      type: 'install_time',
      description: 'Supabase database synchronization and live fleet telemetry communication.',
    },
    networkState: {
      key: 'ACCESS_NETWORK_STATE',
      name: 'Network State Monitor',
      required: true,
      status: 'granted',
      type: 'install_time',
      description: 'Real-time connectivity tracking and offline queue management.',
    },
    notifications: {
      key: 'POST_NOTIFICATIONS',
      name: 'Push & System Notifications',
      required: false,
      status: notifStatus,
      type: 'runtime',
      description: 'Critical shift conflict alerts, machine assignments, and safety reminders.',
    },
  };
}
