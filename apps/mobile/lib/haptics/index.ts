/**
 * ReachInternational Mobile — Semantic Touch Feedback & Soft Haptics API
 * Centralized, guarded semantic haptics following Android 16+ / Material 3 principles.
 * ONLY file in the repository allowed to import expo-haptics or native ReachHaptics.
 */

import { Platform, AccessibilityInfo } from 'react-native';
import * as H from 'expo-haptics';
import { performNativeHaptic } from './native';
import { shouldAllowHaptic, recordHapticFired, resetHapticRateLimiter } from './rateLimit';
import { isHapticsEnabled } from '../preferences/store';

let isScreenReaderRunning = false;

// Track screen reader / TalkBack status to avoid audio-haptic collisions
if (typeof AccessibilityInfo?.isScreenReaderEnabled === 'function') {
  AccessibilityInfo.isScreenReaderEnabled()
    .then((enabled) => {
      isScreenReaderRunning = !!enabled;
    })
    .catch(() => {});

  AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
    isScreenReaderRunning = !!enabled;
  });
}

function isScreenReaderHapticsConflict(): boolean {
  return isScreenReaderRunning;
}

export type SemanticHapticKind =
  | 'tap'
  | 'select'
  | 'toggle'
  | 'toggleOn'
  | 'toggleOff'
  | 'longPress'
  | 'dragStart'
  | 'dragEnd'
  | 'threshold'
  | 'confirm'
  | 'reject';

// Backward compatibility kinds
export type LegacyHapticKind = 'light' | 'success' | 'warning' | 'error' | 'none';
export type HapticKind = SemanticHapticKind | LegacyHapticKind;

async function triggerExpoFallback(kind: SemanticHapticKind): Promise<void> {
  switch (kind) {
    case 'tap':
      await H.impactAsync(H.ImpactFeedbackStyle.Light);
      break;
    case 'select':
    case 'toggle':
    case 'toggleOn':
    case 'toggleOff':
      await H.selectionAsync();
      break;
    case 'longPress':
      await H.impactAsync(H.ImpactFeedbackStyle.Medium);
      break;
    case 'dragStart':
    case 'threshold':
      await H.impactAsync(H.ImpactFeedbackStyle.Light);
      break;
    case 'dragEnd':
      await H.selectionAsync();
      break;
    case 'confirm':
      await H.notificationAsync(H.NotificationFeedbackType.Success);
      break;
    case 'reject':
      await H.notificationAsync(H.NotificationFeedbackType.Error);
      break;
  }
}

function fire(kind: SemanticHapticKind, androidNativeKind?: string): void {
  // 1. Silent on Web
  if (Platform.OS === 'web') return;

  // 2. Settings check (in-app toggle)
  if (!isHapticsEnabled()) return;

  // 3. Skip when screen reader / TalkBack is announcing
  if (isScreenReaderHapticsConflict()) return;

  // 4. Rate limit (60ms) and dedupe burst (120ms)
  if (!shouldAllowHaptic(kind)) return;

  // Record allowed trigger
  recordHapticFired(kind);

  // 5. Try Android semantic constant via ReachHaptics Kotlin module
  if (Platform.OS === 'android') {
    const performed = performNativeHaptic(androidNativeKind || kind);
    if (performed) return;
  }

  // 6. iOS or Android fallback path
  triggerExpoFallback(kind).catch(() => {});
}

export const haptics = {
  /**
   * Bottom-nav tab press, FAB, primary icon buttons that change state
   * Android: CLOCK_TICK (fallback VIRTUAL_KEY)
   */
  tap: () => fire('tap'),

  /**
   * Option picked in dropdown/segmented/date-time picker, filter chip toggle
   * Android: SEGMENT_TICK (fallback CLOCK_TICK)
   */
  select: () => fire('select'),

  /**
   * Switch, checkbox, radio toggle
   * Android: TOGGLE_ON / TOGGLE_OFF (fallback CLOCK_TICK)
   */
  toggle: (on: boolean) => fire(on ? 'toggleOn' : 'toggleOff'),
  toggleOn: () => fire('toggleOn'),
  toggleOff: () => fire('toggleOff'),

  /**
   * Long-press opens context menu / selection mode
   * Android: LONG_PRESS
   */
  longPress: () => fire('longPress'),

  /**
   * Reorder item drag, sheet drag start
   * Android: DRAG_START (fallback CLOCK_TICK)
   */
  dragStart: () => fire('dragStart'),

  /**
   * Reorder item drop, sheet snap commit, swipe action commit
   * Android: GESTURE_END (fallback CLOCK_TICK)
   */
  dragEnd: () => fire('dragEnd'),

  /**
   * Pull-to-refresh armed, sheet snap point crossed
   * Android: SEGMENT_FREQUENT_TICK (fallback CLOCK_TICK)
   */
  threshold: () => fire('threshold'),

  /**
   * Server-confirmed submit (log saved, assignment saved, settings updated)
   * Android: CONFIRM (fallback CONTEXT_CLICK)
   */
  confirm: () => fire('confirm'),

  /**
   * Validation / server failure user must notice
   * Android: REJECT (fallback LONG_PRESS)
   */
  reject: () => fire('reject'),

  // ─── Backward compatibility aliases ───
  light: () => fire('tap'),
  success: () => fire('confirm'),
  warning: () => fire('select'),
  error: () => fire('reject'),
  none: () => {},
};

/**
 * Resets throttles and rate-limiters (for testing)
 */
export const _resetThrottleForTesting = () => {
  resetHapticRateLimiter();
};

export default haptics;
