/**
 * ReachInternational Mobile — Navigation Motion Presets
 * Centralized screenOptions presets for Expo Router, Tabs, and Native Stack.
 * Eliminates ad-hoc animation literals, configures predictive-back gestures,
 * and dynamically respects system reduced-motion accessibility preferences.
 */

import { useMemo } from 'react';
import { Dimensions, Easing, type Animated } from 'react-native';
import { DUR } from './tokens';
import { isReducedMotionActive, useReducedMotion } from '../preferences/useReducedMotion';

/**
 * Directional horizontal slide transition interpolator for Bottom Tabs.
 * - Navigating to a tab on the right (higher index): incoming enters from right (+width -> 0), outgoing exits to left (0 -> -width).
 * - Navigating to a tab on the left (lower index): incoming enters from left (-width -> 0), outgoing exits to right (0 -> +width).
 * - Background stability: screen remains 100% opaque during the entire slide to completely eradicate whole-screen ghosting.
 * - Inactive cutoff: drops opacity to 0 once fully settled off-screen (<= -1 or >= 1).
 */
export function forTabDirectionalSlide({
  current,
}: {
  current: { progress: Animated.Value };
}) {
  const { width } = Dimensions.get('window');

  const translateX = current.progress.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-width, 0, width],
  });

  const opacity = current.progress.interpolate({
    inputRange: [-1, -0.99, 0, 0.99, 1],
    outputRange: [0, 1, 1, 1, 0],
    extrapolate: 'clamp',
  });

  return {
    sceneStyle: {
      transform: [{ translateX }],
      opacity,
    },
  };
}

/**
 * Standard 240ms tab slide timing spec with smooth native deceleration curve
 */
export const tabSlideTransitionSpec = {
  animation: 'timing' as const,
  config: {
    duration: 240, // 200–280 ms responsive range
    easing: Easing.bezier(0.2, 0, 0, 1), // Native deceleration easing
  },
};

/**
 * Instant tab transition spec for accessibility reduced motion
 */
export const tabNoneTransitionSpec = {
  animation: 'timing' as const,
  config: {
    duration: 0,
  },
};

/**
 * Builds dynamic navigation presets respecting the reduced-motion preference.
 */
export function getNavigationPresets(isReduced: boolean = isReducedMotionActive()) {
  return {
    /**
     * Default native-stack push/pop screen preset:
     * - Forward navigation: smooth horizontal slide from right
     * - Back navigation: smooth reverse slide to right
     * - Android 14+ predictive back and iOS interactive swipe gestures enabled
     */
    stackDefault: {
      animation: isReduced ? ('none' as const) : ('slide_from_right' as const),
      animationDuration: isReduced ? 0 : DUR.md,
      gestureEnabled: true,
    },

    /**
     * Detail screens (e.g. machine details, user details, client details)
     */
    stackDetailScreen: {
      animation: isReduced ? ('none' as const) : ('slide_from_right' as const),
      animationDuration: isReduced ? 0 : DUR.md,
      gestureEnabled: true,
    },

    /**
     * Full modal sheet route:
     * - Forward navigation: smooth vertical slide from bottom
     * - Back / dismissal: smooth reverse vertical slide to bottom
     */
    stackModalSheet: {
      presentation: 'modal' as const,
      animation: isReduced ? ('none' as const) : ('slide_from_bottom' as const),
      animationDuration: isReduced ? 0 : DUR.md,
      gestureEnabled: true,
    },

    /**
     * Transparent modal route:
     * - Cross-fade transition
     */
    stackModalTransparent: {
      presentation: 'transparentModal' as const,
      animation: isReduced ? ('none' as const) : ('fade' as const),
      animationDuration: isReduced ? 0 : DUR.sm,
    },

    /**
     * Primary bottom tabs smooth directional slide preset:
     * - Directional horizontal slide (left-to-right / right-to-left based on relative tab position)
     * - Native 240ms duration with smooth cubic bezier easing
     * - Solid, stable background with zero ghosting and zero whole-screen highlight
     */
    tabsSlide: {
      sceneStyleInterpolator: isReduced ? undefined : forTabDirectionalSlide,
      transitionSpec: isReduced ? tabNoneTransitionSpec : tabSlideTransitionSpec,
      freezeOnBlur: true,
      lazy: true,
    },

    /**
     * Top-level peer tabs preset (preserves backward compatibility with existing layout configs):
     * - Uses directional horizontal slide when motion enabled
     * - Inactive screens frozen and lazy mounted to conserve low-end device memory
     */
    tabsFade: {
      animation: isReduced ? ('none' as const) : ('fade' as const),
      sceneStyleInterpolator: isReduced ? undefined : forTabDirectionalSlide,
      transitionSpec: isReduced ? tabNoneTransitionSpec : tabSlideTransitionSpec,
      animationDuration: isReduced ? 0 : 240,
      freezeOnBlur: true,
      lazy: true,
    },

    /**
     * Sub-screen / detail shift inside bottom tabs:
     * - Shared-axis horizontal shift with opacity interpolation on the native driver
     * - Forward navigation shifts in from right; back navigation shifts out to right
     */
    tabsShift: {
      animation: isReduced ? ('none' as const) : ('shift' as const),
      animationDuration: isReduced ? 0 : DUR.sm,
      freezeOnBlur: true,
      lazy: true,
    },

    /**
     * Instant tab switch when reduced motion is requested
     */
    tabsNone: {
      animation: 'none' as const,
      freezeOnBlur: true,
      lazy: true,
    },
  } as const;
}

/**
 * Static navigation presets for non-hook configuration blocks.
 * Dynamically queries system reduced motion state at evaluation time.
 */
export const navigationPresets = {
  stackDefault: {
    animation: isReducedMotionActive() ? ('none' as const) : ('slide_from_right' as const),
    animationDuration: isReducedMotionActive() ? 0 : DUR.md,
    gestureEnabled: true,
  } as const,

  stackDetailScreen: {
    animation: isReducedMotionActive() ? ('none' as const) : ('slide_from_right' as const),
    animationDuration: isReducedMotionActive() ? 0 : DUR.md,
    gestureEnabled: true,
  } as const,

  stackModalSheet: {
    presentation: 'modal' as const,
    animation: isReducedMotionActive() ? ('none' as const) : ('slide_from_bottom' as const),
    animationDuration: isReducedMotionActive() ? 0 : DUR.md,
    gestureEnabled: true,
  } as const,

  stackModalTransparent: {
    presentation: 'transparentModal' as const,
    animation: isReducedMotionActive() ? ('none' as const) : ('fade' as const),
    animationDuration: isReducedMotionActive() ? 0 : DUR.sm,
  } as const,

  tabsSlide: {
    sceneStyleInterpolator: isReducedMotionActive() ? undefined : forTabDirectionalSlide,
    transitionSpec: isReducedMotionActive() ? tabNoneTransitionSpec : tabSlideTransitionSpec,
    freezeOnBlur: true,
    lazy: true,
  } as const,

  tabsFade: {
    animation: isReducedMotionActive() ? ('none' as const) : ('fade' as const),
    sceneStyleInterpolator: isReducedMotionActive() ? undefined : forTabDirectionalSlide,
    transitionSpec: isReducedMotionActive() ? tabNoneTransitionSpec : tabSlideTransitionSpec,
    animationDuration: isReducedMotionActive() ? 0 : 240,
    freezeOnBlur: true,
    lazy: true,
  } as const,

  tabsShift: {
    animation: isReducedMotionActive() ? ('none' as const) : ('shift' as const),
    animationDuration: isReducedMotionActive() ? 0 : DUR.sm,
    freezeOnBlur: true,
    lazy: true,
  } as const,

  tabsNone: {
    animation: 'none' as const,
    freezeOnBlur: true,
    lazy: true,
  } as const,
} as const;

/**
 * Canonical screen animation presets for Expo Router screens.
 */
export const screenAnim = {
  tab: navigationPresets.tabsSlide,
  slide: navigationPresets.tabsSlide,
  shift: navigationPresets.tabsShift,
  detail: navigationPresets.tabsShift,
  modal: navigationPresets.stackModalSheet,
  stack: navigationPresets.stackDefault,
  fade: navigationPresets.tabsFade,
} as const;

/**
 * Reactive hook for layouts that dynamically update screenOptions
 * when system accessibility reduced-motion changes at runtime.
 */
export function useNavigationMotion() {
  const isReduced = useReducedMotion();
  return useMemo(() => getNavigationPresets(isReduced), [isReduced]);
}
