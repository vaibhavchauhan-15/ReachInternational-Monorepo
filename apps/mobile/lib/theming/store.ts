/**
 * ReachInternational Mobile — Ultra-Lightweight Theme Store
 * Powered by React 18/19 useSyncExternalStore with 0ms pointer swaps.
 *
 * Invariants:
 * - Single source of truth for mobile theme mode & resolved appearance
 * - Decoupled from React Component tree: 0 Context re-renders on unrelated changes
 * - Single deduplicated Appearance listener with Android background suppression
 * - Atomic native chrome synchronization (expo-system-ui / StatusBar)
 * - Deferred storage persistence off interaction path
 */

import { useSyncExternalStore, useCallback } from 'react';
import { Appearance, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import { colorScheme } from 'nativewind';
import {
  LIGHT_THEME,
  DARK_THEME,
  getFrozenTheme,
  type RNThemeType,
} from './palettes';
import type { ColorTokens } from '@reachinternational/design-tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeSnapshot {
  mode: ThemeMode;
  isDark: boolean;
  theme: RNThemeType;
  colors: RNThemeType['colors'];
  ready: boolean;
}

const STORAGE_KEY = '@reachinternational_theme';
const WEB_STORAGE_KEY = 'reachinternational-theme';

// Read initial mode synchronously on web, default to 'system' on native
function getInitialMode(): ThemeMode {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEY) ||
        localStorage.getItem(WEB_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Storage access restricted
    }
  }
  return 'system';
}

// Initial system color scheme
function getInitialSystemScheme(): 'light' | 'dark' {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {}
  }
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

// Module-level state
let currentMode: ThemeMode = getInitialMode();
let currentSystemScheme: 'light' | 'dark' = getInitialSystemScheme();
let isReady = Platform.OS === 'web';

// Resolve isDark from mode and system scheme
function resolveIsDark(mode: ThemeMode, systemScheme: 'light' | 'dark'): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return systemScheme === 'dark';
}

let currentIsDark = resolveIsDark(currentMode, currentSystemScheme);
let currentTheme = getFrozenTheme(currentIsDark);

// Stable cached snapshot
let cachedSnapshot: ThemeSnapshot = {
  mode: currentMode,
  isDark: currentIsDark,
  theme: currentTheme,
  colors: currentTheme.colors,
  ready: isReady,
};

// Store subscribers
const listeners = new Set<() => void>();

function notify(): void {
  const nextIsDark = resolveIsDark(currentMode, currentSystemScheme);
  const nextTheme = getFrozenTheme(nextIsDark);

  currentIsDark = nextIsDark;
  currentTheme = nextTheme;

  cachedSnapshot = {
    mode: currentMode,
    isDark: currentIsDark,
    theme: currentTheme,
    colors: currentTheme.colors,
    ready: isReady,
  };

  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Guard against faulty listeners
    }
  });
}

// Web DOM theme synchronization
function applyDomTheme(isDark: boolean): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
  if (document.body) {
    document.body.style.backgroundColor = isDark ? '#09090b' : '#fafafa';
  }
}

// Native chrome synchronization (SystemUI, StatusBar, DOM)
function syncNativeChrome(theme: RNThemeType, isDark: boolean): void {
  if (Platform.OS === 'android') {
    SystemUI.setBackgroundColorAsync(theme.colors.canvas).catch(() => {});
  } else if (Platform.OS === 'web') {
    applyDomTheme(isDark);
  }
}

// Initialize native chrome on startup
syncNativeChrome(currentTheme, currentIsDark);

// Single Appearance listener registered once for the entire app lifetime
if (Platform.OS !== 'web') {
  Appearance.addChangeListener(({ colorScheme: nextScheme }) => {
    // 1. Android quirk defense: Ignore transient events when app is backgrounded
    if (AppState.currentState && AppState.currentState !== 'active') {
      return;
    }

    const normalized = nextScheme === 'dark' ? 'dark' : 'light';
    // 2. Deduplicate identical events
    if (normalized === currentSystemScheme) {
      return;
    }

    currentSystemScheme = normalized;
    if (currentMode === 'system') {
      const nextIsDark = normalized === 'dark';
      syncNativeChrome(getFrozenTheme(nextIsDark), nextIsDark);
      notify();
    }
  });
} else if (typeof window !== 'undefined') {
  try {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', (e) => {
      currentSystemScheme = e.matches ? 'dark' : 'light';
      if (currentMode === 'system') {
        syncNativeChrome(getFrozenTheme(e.matches), e.matches);
        notify();
      }
    });
  } catch {}
}

/**
 * Hydrates persisted theme preference at earliest app startup.
 */
export async function hydrateThemeStore(): Promise<ThemeSnapshot> {
  if (Platform.OS === 'web') {
    isReady = true;
    notify();
    return cachedSnapshot;
  }

  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      currentMode = saved;
      currentIsDark = resolveIsDark(saved, currentSystemScheme);
      currentTheme = getFrozenTheme(currentIsDark);
      syncNativeChrome(currentTheme, currentIsDark);

      // Synchronize NativeWind non-blockingly
      try {
        colorScheme.set(saved);
      } catch {}
    }
  } catch (err) {
    // Non-fatal fallback to system
  } finally {
    isReady = true;
    notify();
  }

  return cachedSnapshot;
}

// Early boot hydration
hydrateThemeStore().catch(() => {});

/**
 * Dispatcher: Sets theme mode instantly, updates native chrome, and defers storage I/O.
 */
export function setThemeMode(mode: ThemeMode): void {
  if (mode === currentMode) return;

  currentMode = mode;
  const nextIsDark = resolveIsDark(mode, currentSystemScheme);
  const nextTheme = getFrozenTheme(nextIsDark);

  // 1. Synchronous native chrome update in the same tick (0ms lag, no white/black flash)
  syncNativeChrome(nextTheme, nextIsDark);

  // 2. Notify subscribers synchronously via useSyncExternalStore
  notify();

  // 3. Update NativeWind off the main frame so current gesture/touch completes at 60/120fps
  if (Platform.OS === 'web') {
    try {
      colorScheme.set(mode);
    } catch {}
  } else {
    requestAnimationFrame(() => {
      try {
        colorScheme.set(mode);
      } catch {}
    });
  }

  // 4. Deferred persistent storage write off the critical path
  const persist = () => {
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
        localStorage.setItem(WEB_STORAGE_KEY, mode);
      } catch {}
    }
  };

  setTimeout(persist, 0);
}

// Snapshot getters
export function getThemeSnapshot(): ThemeSnapshot {
  return cachedSnapshot;
}

export function getIsDark(): boolean {
  return currentIsDark;
}

export function getThemeMode(): ThemeMode {
  return currentMode;
}

export function getTheme(): RNThemeType {
  return currentTheme;
}

export function getThemeColors(): RNThemeType['colors'] {
  return currentTheme.colors;
}

export function isThemeReady(): boolean {
  return isReady;
}

/**
 * Store subscription helper for useSyncExternalStore
 */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FINE-GRAINED SELECTOR HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Subscribes ONLY to isDark boolean. Zero re-renders when mode toggles between
 * system and dark/light if the resolved boolean does not change.
 */
export function useIsDark(): boolean {
  return useSyncExternalStore(subscribeTheme, getIsDark, getIsDark);
}

/**
 * Subscribes to the theme mode ('light' | 'dark' | 'system').
 */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeTheme, getThemeMode, getThemeMode);
}

/**
 * Subscribes to the frozen theme colors object pointer.
 */
export function useThemeColors(): RNThemeType['colors'] {
  return useSyncExternalStore(subscribeTheme, getThemeColors, getThemeColors);
}

/**
 * Fine-grained selector for a single color token.
 */
export function useThemeColor<K extends keyof ColorTokens>(tokenKey: K): ColorTokens[K] {
  const getSelectedColor = useCallback(() => currentTheme.colors[tokenKey], [tokenKey]);
  return useSyncExternalStore(subscribeTheme, getSelectedColor, getSelectedColor);
}

/**
 * Returns stable setThemeMode callback (0 re-renders on theme change).
 */
export function useSetThemeMode(): (mode: ThemeMode) => void {
  return setThemeMode;
}

/**
 * Full backward-compatible hook matching ThemeContextType.
 * Reads from useSyncExternalStore.
 */
export function useTheme(): {
  theme: RNThemeType;
  colors: RNThemeType['colors'];
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  mode: ThemeMode;
  ready: boolean;
} {
  const snapshot = useSyncExternalStore(
    subscribeTheme,
    getThemeSnapshot,
    getThemeSnapshot
  );

  return {
    theme: snapshot.theme,
    colors: snapshot.colors,
    isDark: snapshot.isDark,
    setMode: setThemeMode,
    mode: snapshot.mode,
    ready: snapshot.ready,
  };
}

