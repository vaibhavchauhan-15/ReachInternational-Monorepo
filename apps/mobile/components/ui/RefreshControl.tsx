import React from 'react';
import {
  RefreshControl as RNRefreshControl,
  type RefreshControlProps as RNRefreshControlProps,
} from 'react-native';
import { useTheme } from './ThemeProvider';

export interface AppRefreshControlProps extends Omit<RNRefreshControlProps, 'tintColor' | 'colors'> {
  refreshing: boolean;
  onRefresh: () => void;
  enabled?: boolean;
}

/**
 * Standardized, thin convenience wrapper around React Native's platform-native RefreshControl.
 * Automatically wires Vercel Geist theme accent link colors for iOS and Android.
 */
export function AppRefreshControl({
  refreshing,
  onRefresh,
  enabled = true,
  ...rest
}: AppRefreshControlProps) {
  const { theme } = useTheme();

  return (
    <RNRefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      enabled={enabled}
      tintColor={theme.colors.link}
      colors={[theme.colors.link]}
      {...rest}
    />
  );
}
