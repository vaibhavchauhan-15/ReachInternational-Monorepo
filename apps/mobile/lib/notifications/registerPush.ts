/**
 * ReachInternational Mobile — Push Notification Registration & Lifecycle
 * Expo SDK 58 Push Notifications integration with Android Channels,
 * Supabase device registration, and route allowlist deep-linking.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { isAllowedPushDeepLink } from '@reachinternational/types';
import { supabase } from '../supabase';
import { generateUUID } from '../optimistic/tempId';
import { syncAppBadge } from './badge';

export { syncAppBadge };

const STORAGE_KEY_TOKEN = '@reach:registered_push_token';
const STORAGE_KEY_INSTALLATION = '@reach:installation_id';

/**
 * Stable opaque identifier for this physical app installation. Keying device
 * registrations by installation id guarantees one live push token per install
 * (token refresh / re-registration deactivates the stale token server-side).
 */
export async function getInstallationId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY_INSTALLATION);
    if (existing) return existing;
    const fresh = generateUUID();
    await AsyncStorage.setItem(STORAGE_KEY_INSTALLATION, fresh);
    return fresh;
  } catch {
    return generateUUID();
  }
}

/**
 * Evaluates whether the app is running in the Expo Go client app.
 * In Expo Go on Android, native remote push notifications (FCM) and custom
 * notification channels are unsupported since Expo SDK 53.
 */
export function isExpoGo(): boolean {
  try {
    if (typeof isRunningInExpoGo === 'function' && isRunningInExpoGo()) {
      return true;
    }
  } catch {
    // Graceful fallback if module is unavailable
  }
  return Constants.appOwnership === 'expo';
}

// Safe route prefixes for push deep-links are owned by the shared notification
// registry (@reachinternational/types). This wrapper keeps the historical API.
export function isValidDeepLink(link?: string | null): boolean {
  return isAllowedPushDeepLink(link ?? undefined);
}

/**
 * Configure Android notification channels (must be called before requesting permissions).
 * In Expo Go on Android, custom notification channels cannot be created via
 * ExpoNotificationChannelManager and will throw a NullPointerException.
 * Channel configuration is executed in standalone APKs and EAS development builds.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  if (isExpoGo()) {
    if (__DEV__) {
      console.log('[PushNotification] Skipping Android notification channels setup in Expo Go (requires development build)');
    }
    return;
  }

  try {
    await Promise.all([
      Notifications.setNotificationChannelAsync('breakdown_alerts', {
        name: 'Breakdown & Machine Alerts',
        description: 'Urgent alerts when machines experience breakdowns or critical stops',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: '#ee0000',
        enableLights: true,
        enableVibrate: true,
      }),
      Notifications.setNotificationChannelAsync('shift_reminders', {
        name: 'Shift & Meter Entry Reminders',
        description: 'Reminders for operators to submit closing hours for ended shifts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0284c7',
        enableLights: true,
        enableVibrate: true,
      }),
      Notifications.setNotificationChannelAsync('assignment_updates', {
        name: 'Machine Assignment Updates',
        description: 'Notifications when machine or operator assignments are modified',
        importance: Notifications.AndroidImportance.DEFAULT,
        enableVibrate: true,
      }),
      Notifications.setNotificationChannelAsync('general_updates', {
        name: 'General Operational Alerts',
        description: 'Registration approvals, inquiries, and company updates',
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
    ]);
  } catch (err) {
    if (!isExpoGo()) {
      console.warn('[PushNotification] Failed to configure Android channels:', err);
    }
  }
}

/**
 * Configures the foreground notification display handler.
 * Critical/high priority events keep the native heads-up banner (they must
 * interrupt). Normal/low events shown while the app is foregrounded drop the
 * duplicate system banner and surface instead as an in-app indicator (badge +
 * in-app inbox) — the OS shade entry is still recorded (shouldShowList).
 */
export function setupForegroundNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const priority = notification.request.content.data?.priority;
      const isHighPriority = priority === 'critical' || priority === 'high';

      // Keep the icon badge in step with the authoritative unread count.
      void syncAppBadge();

      return {
        shouldShowAlert: true,
        shouldPlaySound: isHighPriority,
        shouldSetBadge: true,
        shouldShowBanner: isHighPriority,
        shouldShowList: true,
      };
    },
  });
}

/**
 * Registers device for Expo push notifications and stores token in Supabase
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Remote push notifications are only supported on physical devices
  if (!Device.isDevice) {
    console.log('[PushNotification] Skipping push registration on simulator/emulator');
    return null;
  }

  // Remote push notifications (FCM) are unavailable in Expo Go on Android since SDK 53.
  // Attempting to register in Expo Go throws an Error (warnOfExpoGoPushUsage).
  // Development builds (expo-dev-client / EAS build) are required for remote push tokens.
  if (isExpoGo()) {
    if (__DEV__) {
      console.log(
        '[PushNotification] Remote push notifications are unavailable in Expo Go. Use a development build (expo run:android / eas build) to test remote push.'
      );
    }
    return null;
  }

  try {
    // 1. Initialize Android channels
    await setupNotificationChannels();

    // 2. Check and request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[PushNotification] Notification permission not granted');
      return null;
    }

    // 3. Obtain Expo Push Token
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      '40432ac1-55a2-4bfa-985e-a51562398743';

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const token = tokenResponse.data;

    if (!token) {
      console.warn('[PushNotification] Received empty push token');
      return null;
    }

    // 4. Register token with backend RPC (provider + installation identity)
    const appVersion = Constants.expoConfig?.version || '1.4.0';
    const installationId = await getInstallationId();
    const { error: rpcError } = await supabase.rpc('register_push_device', {
      p_token: token,
      p_platform: Platform.OS,
      p_provider: 'expo',
      p_app_version: appVersion,
      p_installation_id: installationId,
    });

    if (rpcError) {
      console.error('[PushNotification] Failed to register device token in Supabase:', rpcError);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY_TOKEN, token);
      console.log('[PushNotification] Successfully registered push device:', token.slice(0, 15) + '...');
    }

    return token;
  } catch (err) {
    console.error('[PushNotification] Push registration encountered error:', err);
    return null;
  }
}

/**
 * Unregisters the current device token from Supabase (called on sign out)
 */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
    if (token) {
      const { error } = await supabase.rpc('unregister_push_device', {
        p_token: token,
      });
      if (error) {
        console.warn('[PushNotification] Failed to unregister device from Supabase:', error);
      }
      await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
      console.log('[PushNotification] Unregistered push device token');
    }
  } catch (err) {
    console.warn('[PushNotification] Error during unregister push token:', err);
  }
}

/**
 * Subscribes to notification response events (deep-linking when user taps a notification)
 */
export function setupNotificationResponseListener(): () => void {
  try {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        void syncAppBadge();
        const data = response.notification.request.content.data;
        const rawLink = data?.link;
        const link = typeof rawLink === 'string' ? rawLink : null;

        if (link && isValidDeepLink(link)) {
          console.log('[PushNotification] Routing to deep-link:', link);
          router.push(link as any);
        } else {
          // Default to operations or dashboard if link is missing/invalid
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('[PushNotification] Error handling notification response:', err);
      }
    });

    return () => {
      subscription.remove();
    };
  } catch (err) {
    if (__DEV__) {
      console.warn('[PushNotification] Could not subscribe to notification response listener:', err);
    }
    return () => {};
  }
}
