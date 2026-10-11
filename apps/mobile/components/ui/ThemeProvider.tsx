/**
 * ServiceCentric Mobile — Theme Provider
 * Provides reactive light/dark theme objects derived from @reachinternational/design-tokens.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRNTheme } from '@reachinternational/design-tokens';
import { colorScheme } from 'nativewind';

export type RNThemeType = ReturnType<typeof getRNTheme>;

export interface ThemeContextType {
  theme: RNThemeType;
  colors: RNThemeType['colors'];
  isDark: boolean;
  setMode: (mode: 'light' | 'dark' | 'system') => void;
  mode: 'light' | 'dark' | 'system';
}

const STORAGE_KEY = '@reachinternational_theme';

const defaultTheme = getRNTheme(false);
const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  colors: defaultTheme.colors,
  isDark: false,
  setMode: () => {},
  mode: 'light',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<'light' | 'dark' | 'system'>('light');

  // Initial sync: Ensure NativeWind starts aligned with default 'light' mode
  useEffect(() => {
    colorScheme.set('light');
    AsyncStorage.getItem(STORAGE_KEY)
      .then((savedMode) => {
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setModeState(savedMode);
          colorScheme.set(savedMode);
        }
      })
      .catch(() => {});
  }, []);

  // Synchronize NativeWind whenever mode changes
  useEffect(() => {
    colorScheme.set(mode);
  }, [mode]);

  const setMode = (newMode: 'light' | 'dark' | 'system') => {
    setModeState(newMode);
    colorScheme.set(newMode);
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
  };

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const theme = getRNTheme(isDark);

  return (
    <ThemeContext.Provider value={{ theme, colors: theme.colors, isDark, setMode, mode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);
