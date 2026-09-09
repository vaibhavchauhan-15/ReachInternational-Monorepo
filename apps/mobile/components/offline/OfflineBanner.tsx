/**
 * OfflineBanner — Persistent Ambient Offline Telemetry Banner
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-03, D-07, and Vercel Geist design tokens.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNetworkStatus } from '../../lib/offline/useNetworkStatus';
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue';
import { useTheme } from '../ui/ThemeProvider';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';

export const OfflineBanner: React.FC = () => {
  const { isOffline } = useNetworkStatus();
  const { pendingCount, syncingCount, failedCount, conflictCount, isSyncing, syncNow } = useOfflineQueue();
  const { theme, isDark } = useTheme();

  const totalQueued = pendingCount + syncingCount + failedCount + conflictCount;

  // Only render if device is offline or if items are currently queued/syncing
  if (!isOffline && totalQueued === 0 && !isSyncing) {
    return null;
  }

  const handleSyncPress = () => {
    if (!isSyncing) {
      syncNow().catch((err) => {
        console.warn('[OfflineBanner] Sync error:', err);
      });
    }
  };

  const bannerBg = isDark ? '#451a03' : '#fffbeb'; // Amber-950 vs Amber-50
  const bannerBorder = isDark ? '#78350f' : '#fef3c7'; // Amber-900 vs Amber-100
  const bannerText = isDark ? '#fbbf24' : '#b45309'; // Amber-400 vs Amber-700
  const actionBg = isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(217, 119, 6, 0.12)';

  return (
    <View style={[styles.container, { backgroundColor: bannerBg, borderBottomColor: bannerBorder }]}>
      <View style={styles.contentRow}>
        {/* Left Status: Icon + Message */}
        <View style={styles.leftCol}>
          {isOffline ? (
            <WifiOff size={14} color={bannerText} style={styles.icon} />
          ) : conflictCount > 0 ? (
            <AlertCircle size={14} color={theme.colors.error} style={styles.icon} />
          ) : (
            <RefreshCw size={14} color={bannerText} style={styles.icon} />
          )}

          <Text style={[styles.title, { color: bannerText }]} numberOfLines={1}>
            {isOffline ? 'Working Offline' : isSyncing ? 'Synchronizing...' : 'Local Queue'}
          </Text>

          <Text style={[styles.bullet, { color: bannerText }]}>•</Text>

          <Text style={[styles.countText, { color: bannerText }]} numberOfLines={1}>
            {totalQueued === 1 ? '1 log queued' : `${totalQueued} logs queued`}
          </Text>
        </View>

        {/* Right CTA: Sync Now Button (Min 44px touch target) */}
        <TouchableOpacity
          onPress={handleSyncPress}
          disabled={isSyncing}
          activeOpacity={0.7}
          style={[styles.syncButton, { backgroundColor: actionBg }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={bannerText} style={styles.spinner} />
          ) : (
            <RefreshCw size={12} color={bannerText} style={styles.buttonIcon} />
          )}
          <Text style={[styles.buttonText, { color: bannerText }]}>
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    zIndex: 999,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    marginRight: 8,
  },
  icon: {
    marginRight: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bullet: {
    fontSize: 10,
    opacity: 0.6,
  },
  countText: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.9,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radiusNumeric.sm,
    minHeight: 44, // Strict touch target rule
    justifyContent: 'center',
    gap: 5,
  },
  buttonIcon: {
    marginRight: 1,
  },
  spinner: {
    marginRight: 2,
    transform: [{ scale: 0.75 }],
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
