/**
 * SyncStatusBadge — 4-State Tactical Status Pill for Machine Logs
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-02, D-08, and Vercel Geist design tokens.
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Clock, Check, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../ui/ThemeProvider';
import { radiusNumeric } from '@reachinternational/design-tokens';
import { MutationStatus } from '../../lib/offline/types';

export interface SyncStatusBadgeProps {
  status: MutationStatus;
  customLabel?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ status, customLabel }) => {
  const { isDark } = useTheme();

  let bg = isDark ? '#451a03' : '#fffbeb';
  let border = isDark ? '#78350f' : '#fef3c7';
  let text = isDark ? '#fbbf24' : '#d97706';
  let label = customLabel || 'Pending Sync';
  let icon = <Clock size={11} color={text} />;

  if (status === 'syncing') {
    bg = isDark ? '#172554' : '#eff6ff';
    border = isDark ? '#1e40af' : '#dbeafe';
    text = isDark ? '#60a5fa' : '#2563eb';
    label = customLabel || 'Syncing...';
    icon = (
      <ActivityIndicator
        size="small"
        color={text}
        style={{ transform: [{ scale: 0.6 }], marginRight: -2, marginLeft: -2 }}
      />
    );
  } else if (status === 'synced') {
    bg = isDark ? '#052e16' : '#f0fdf4';
    border = isDark ? '#166534' : '#dcfce7';
    text = isDark ? '#4ade80' : '#16a34a';
    label = customLabel || 'Synced';
    icon = <Check size={11} color={text} />;
  } else if (status === 'conflict') {
    bg = isDark ? '#450a0a' : '#fef2f2';
    border = isDark ? '#991b1b' : '#fee2e2';
    text = isDark ? '#f87171' : '#dc2626';
    label = customLabel || 'Sync Overlap';
    icon = <AlertTriangle size={11} color={text} />;
  } else if (status === 'failed') {
    bg = isDark ? '#450a0a' : '#fef2f2';
    border = isDark ? '#991b1b' : '#fee2e2';
    text = isDark ? '#f87171' : '#dc2626';
    label = customLabel || 'Sync Error';
    icon = <AlertTriangle size={11} color={text} />;
  }

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: border }]}>
      {icon}
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.1,
    textTransform: 'uppercase',
  },
});
