/**
 * ReachInternational Mobile — Memoized Style Factory
 * Caches StyleSheet instances per color scheme (2 cache slots total: light and dark).
 * Lazily evaluated on first render; zero style allocations during theme switching.
 */

import { StyleSheet } from 'react-native';
import { LIGHT_THEME, DARK_THEME, type RNThemeType } from './palettes';
import { useIsDark } from './store';

type NamedStyles<T> = { [P in keyof T]: any };

/**
 * Creates a theme-aware hook returning a memoized StyleSheet.
 * Strictly 2 cache slots (light and dark).
 * Subscribes only to `isDark` boolean.
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (theme: RNThemeType, isDark: boolean) => T
): () => T {
  let lightSheet: T | null = null;
  let darkSheet: T | null = null;

  return function useGeneratedStyles(): T {
    const isDark = useIsDark();

    if (isDark) {
      if (!darkSheet) {
        darkSheet = StyleSheet.create(factory(DARK_THEME, true));
      }
      return darkSheet;
    }

    if (!lightSheet) {
      lightSheet = StyleSheet.create(factory(LIGHT_THEME, false));
    }
    return lightSheet;
  };
}
