/**
 * ServiceCentric Mobile — Theme Provider
 * Provides reactive light/dark theme objects derived from @servicecentric/design-tokens.
 */

import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getRNTheme } from '@servicecentric/design-tokens';

export type RNThemeType = ReturnType<typeof getRNTheme>;

export interface ThemeContextType {
  theme: RNThemeType;
  isDark: boolean;
  setMode: (mode: 'light' | 'dark' | 'system') => void;
  mode: 'light' | 'dark' | 'system';
}

const ThemeContext = createContext<ThemeContextType>({
  theme: getRNTheme(true),
  isDark: true,
  setMode: () => {},
  mode: 'dark',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>('dark');

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';
  const theme = getRNTheme(isDark);

  return (
    <ThemeContext.Provider value={{ theme, isDark, setMode, mode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);
