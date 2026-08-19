/**
 * ServiceCentric Mobile — Accessibility & Device UX Manager (Phase 29)
 * Handles Android hardware back button listeners, screen-reader announcements,
 * accessibility labels, 44x44 dp touch targets, and reduced motion detection.
 */

import { useEffect } from 'react';
import { BackHandler, AccessibilityInfo, Platform } from 'react-native';

export const MIN_TOUCH_TARGET_SIZE = 44; // 44x44 dp per iOS/Android Human Interface Guidelines

/**
 * Screen reader announcement helper for form validation or loading state changes.
 */
export function announceForAccessibility(message: string): void {
  if (Platform.OS !== 'web') {
    AccessibilityInfo.announceForAccessibility(message);
    console.log(`[A11y Announcement]: ${message}`);
  }
}

/**
 * Custom React Hook for intercepting Android hardware back button presses on modal dialogs.
 */
export function useAndroidBackHandler(onBackPress: () => boolean): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      return onBackPress();
    });

    return () => subscription.remove();
  }, [onBackPress]);
}

/**
 * Standardized Accessibility Props builder for custom button & touchable components.
 */
export function buildAccessibilityProps(label: string, hint?: string, role: 'button' | 'link' | 'tab' | 'header' = 'button') {
  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: role,
  };
}
