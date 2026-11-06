/**
 * ReachInternational Mobile — Precomputed Frozen Theme Palettes
 * Single source of truth: @reachinternational/design-tokens.
 * Palettes are built and deeply frozen at module evaluation.
 * Switching themes is a pointer swap (O(1)), never recomputing color maps.
 */

import {
  lightThemeRN,
  darkThemeRN,
  type ReactNativeTheme,
} from '@reachinternational/design-tokens';
import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavTheme,
} from 'expo-router/react-navigation';

// Deep freeze helper for token trees
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.keys(obj).forEach((prop) => {
    const val = (obj as any)[prop];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return Object.freeze(obj);
}

// Precomputed frozen theme singletons
export const LIGHT_THEME: Readonly<ReactNativeTheme> = deepFreeze({
  ...lightThemeRN,
  colors: { ...lightThemeRN.colors },
  spacing: { ...lightThemeRN.spacing },
  radius: { ...lightThemeRN.radius },
  typography: { ...lightThemeRN.typography },
  fontSizes: { ...lightThemeRN.fontSizes },
  shadows: { ...lightThemeRN.shadows },
});

export const DARK_THEME: Readonly<ReactNativeTheme> = deepFreeze({
  ...darkThemeRN,
  colors: { ...darkThemeRN.colors },
  spacing: { ...darkThemeRN.spacing },
  radius: { ...darkThemeRN.radius },
  typography: { ...darkThemeRN.typography },
  fontSizes: { ...darkThemeRN.fontSizes },
  shadows: { ...darkThemeRN.shadows },
});

export type RNThemeType = Readonly<ReactNativeTheme>;

/**
 * Returns precomputed frozen theme reference.
 * O(1) pointer selection, zero allocations.
 */
export function getFrozenTheme(isDark: boolean): RNThemeType {
  return isDark ? DARK_THEME : LIGHT_THEME;
}

/**
 * Precomputed React Navigation / Expo Router theme definitions
 * Synchronized with Geist design tokens.
 */
export const NAV_THEME: Record<'light' | 'dark', NavTheme> = {
  light: deepFreeze({
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: LIGHT_THEME.colors.canvas,
      border: LIGHT_THEME.colors.hairline,
      card: LIGHT_THEME.colors.canvasElevated,
      notification: LIGHT_THEME.colors.error || '#ee0000',
      primary: LIGHT_THEME.colors.primary || '#0284c7',
      text: LIGHT_THEME.colors.ink,
    },
  }),
  dark: deepFreeze({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: DARK_THEME.colors.canvas,
      border: DARK_THEME.colors.hairline,
      card: DARK_THEME.colors.canvasElevated,
      notification: DARK_THEME.colors.error || '#ee0000',
      primary: DARK_THEME.colors.primary || '#0ea5e9',
      text: DARK_THEME.colors.ink,
    },
  }),
};

