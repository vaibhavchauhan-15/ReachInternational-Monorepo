/**
 * ReachInternational Mobile — Navigation Motion Presets
 * Centralized screenOptions presets for Expo Router, Tabs, and Native Stack.
 * Eliminates ad-hoc animation literals and configures predictive-back gestures.
 */

import { DUR } from './tokens';

export const navigationPresets = {
  /**
   * Default stack push/pop screen preset
   * Uses native-stack slide from right with gesture support
   */
  stackDefault: {
    animation: 'slide_from_right',
    animationDuration: DUR.md,
    gestureEnabled: true,
  } as const,

  /**
   * Detail screens (e.g. machine details, user details, client details)
   */
  stackDetailScreen: {
    animation: 'slide_from_right',
    animationDuration: DUR.md,
    gestureEnabled: true,
  } as const,

  /**
   * Full modal sheet route
   */
  stackModalSheet: {
    presentation: 'modal',
    animation: 'slide_from_bottom',
    animationDuration: DUR.md,
    gestureEnabled: true,
  } as const,

  /**
   * Transparent modal route
   */
  stackModalTransparent: {
    presentation: 'transparentModal',
    animation: 'fade',
    animationDuration: DUR.sm,
  } as const,

  /**
   * Top-level tabs fade-through preset
   * Android 16 fade-through feel: lazy mounting + frozen inactive screens
   */
  tabsFade: {
    animation: 'fade',
    animationDuration: DUR.sm,
    freezeOnBlur: true,
    lazy: true,
  } as const,
} as const;

export const screenAnim = {
  tab: navigationPresets.tabsFade,
  detail: navigationPresets.stackDetailScreen,
  modal: navigationPresets.stackModalSheet,
} as const;

