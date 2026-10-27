/**
 * ReachInternational Mobile — Theme Provider
 * Provides reactive light/dark theme objects derived from @reachinternational/design-tokens.
 * Synchronized with Web (apps/web) with 0ms transition lock and atomic DOM updates.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme, Platform } from 'react-native';
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
const WEB_STORAGE_KEY = 'reachinternational-theme';

// Synchronous initial mode reader on Web
const getInitialMode = (): 'light' | 'dark' | 'system' => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(WEB_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Storage access blocked or unavailable
    }
  }
  return 'system';
};

// Atomically apply theme to DOM on Web in 0ms
const applyDomTheme = (isDark: boolean) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
  if (document.body) {
    document.body.style.backgroundColor = isDark ? '#09090b' : '#fafafa';
  }
};

const defaultTheme = getRNTheme(false);
const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  colors: defaultTheme.colors,
  isDark: false,
  setMode: () => {},
  mode: 'system',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<'light' | 'dark' | 'system'>(getInitialMode);
  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      } catch {}
    }
    return systemScheme === 'dark';
  });

  // Track system preference reactively on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = (e: MediaQueryListEvent) => {
        setSystemIsDark(e.matches);
      };
      media.addEventListener('change', handleMediaChange);
      return () => media.removeEventListener('change', handleMediaChange);
    } catch {}
  }, []);

  // Update systemIsDark if RN systemScheme updates
  useEffect(() => {
    if (systemScheme) {
      setSystemIsDark(systemScheme === 'dark');
    }
  }, [systemScheme]);

  const isDark = mode === 'system' ? systemIsDark : mode === 'dark';
  const theme = useMemo(() => getRNTheme(isDark), [isDark]);

  // Initial synchronization
  useEffect(() => {
    if (Platform.OS === 'web') {
      applyDomTheme(isDark);
      try {
        colorScheme.set(mode);
      } catch {}
    } else {
      AsyncStorage.getItem(STORAGE_KEY)
        .then((savedMode) => {
          if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
            setModeState(savedMode);
            try {
              colorScheme.set(savedMode);
            } catch {}
          }
        })
        .catch(() => {});
    }
  }, []);

  const setMode = useCallback((newMode: 'light' | 'dark' | 'system') => {
    setModeState(newMode);

    const nextIsDark = newMode === 'system' ? systemIsDark : newMode === 'dark';

    // 1. Instant 0ms atomic DOM synchronization on Web
    applyDomTheme(nextIsDark);

    // 2. Synchronize NativeWind non-blockingly on next frame so current gesture & animation render at 60/120fps
    requestAnimationFrame(() => {
      try {
        colorScheme.set(newMode);
      } catch {}
    });

    // 3. Persist asynchronously
    AsyncStorage.setItem(STORAGE_KEY, newMode).catch(() => {});
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, newMode);
        localStorage.setItem(WEB_STORAGE_KEY, newMode);
      } catch {}
    }
  }, [systemIsDark]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      colors: theme.colors,
      isDark,
      setMode,
      mode,
    }),
    [theme, isDark, setMode, mode]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);
