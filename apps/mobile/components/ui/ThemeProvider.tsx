/**
 * ReachInternational Mobile — High-Performance Theme Provider & Context
 * Powered by module-level store and useSyncExternalStore.
 * Zero context re-render overhead; 0ms pointer swaps.
 */

import React, { createContext } from 'react';
import {
  useTheme,
  useIsDark,
  useThemeMode,
  useThemeColors,
  useThemeColor,
  useSetThemeMode,
  setThemeMode,
  LIGHT_THEME,
  type RNThemeType,
  type ThemeMode,
} from '../../lib/theming';

export type { RNThemeType, ThemeMode };

export interface ThemeContextType {
  theme: RNThemeType;
  colors: RNThemeType['colors'];
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  mode: ThemeMode;
  ready: boolean;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: LIGHT_THEME,
  colors: LIGHT_THEME.colors,
  isDark: false,
  setMode: () => {},
  mode: 'system',
  ready: true,
});

/**
 * Lightweight Zero-Overhead ThemeProvider
 * Theme state is powered by external store with useSyncExternalStore.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export {
  useTheme,
  useIsDark,
  useThemeMode,
  useThemeColors,
  useThemeColor,
  useSetThemeMode,
  setThemeMode,
};
