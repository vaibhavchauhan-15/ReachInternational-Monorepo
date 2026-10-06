import * as H from 'expo-haptics';
import { Platform } from 'react-native';

let last = 0;
const fire = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;          // Expo Web: no-op
  const now = Date.now();
  if (now - last < 60) return;                // throttle: never buzz-stack
  last = now;
  fn().catch(() => {});
};

export const haptics = {
  select:  () => fire(() => H.selectionAsync()),                              // softest: tabs, toggles, pickers, chips
  light:   () => fire(() => H.impactAsync(H.ImpactFeedbackStyle.Light)),      // primary action, long-press, refresh trigger
  success: () => fire(() => H.notificationAsync(H.NotificationFeedbackType.Success)),
  warning: () => fire(() => H.notificationAsync(H.NotificationFeedbackType.Warning)),
  error:   () => fire(() => H.notificationAsync(H.NotificationFeedbackType.Error)),
};

export type HapticKind = keyof typeof haptics;

export const _resetThrottleForTesting = () => {
  last = 0;
};
