/**
 * ServiceCentric Mobile — Offline Sync Status Banner (Phase 26)
 * Renders offline network status, pending offline mutations badge, and manual sync trigger.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from './ThemeProvider';
import { getPendingQueueCount, processOfflineSyncQueue } from '../../lib/offline-sync';
import { spacingNumeric, radiusNumeric } from '@servicecentric/design-tokens';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react-native';

export interface OfflineSyncBannerProps {
  isOffline?: boolean;
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({ isOffline = false }) => {
  const { theme } = useTheme();

  const [pendingCount, setPendingCount] = useState(getPendingQueueCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const handleManualSync = async () => {
    setIsSyncing(true);
    setLastSyncStatus('idle');
    try {
      const res = await processOfflineSyncQueue();
      setPendingCount(getPendingQueueCount());
      setLastSyncStatus(res.failed === 0 ? 'success' : 'failed');
    } catch {
      setLastSyncStatus('failed');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOffline && pendingCount === 0 && lastSyncStatus === 'idle') {
    return null;
  }

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: isOffline ? theme.colors.warning + '22' : theme.colors.link + '15',
          borderColor: isOffline ? theme.colors.warning : theme.colors.link,
        },
      ]}
    >
      <View style={styles.leftRow}>
        {isOffline ? (
          <WifiOff size={16} color={theme.colors.warning} />
        ) : (
          <CheckCircle2 size={16} color={theme.colors.success} />
        )}
        <View style={styles.textStack}>
          <Text style={[styles.title, { color: theme.colors.ink }]}>
            {isOffline ? 'Offline Mode Active' : 'Offline Changes Pending'}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.mute }]}>
            {pendingCount > 0 ? `${pendingCount} offline update(s) saved locally` : 'All changes synced'}
          </Text>
        </View>
      </View>

      {pendingCount > 0 && (
        <TouchableOpacity
          onPress={handleManualSync}
          disabled={isSyncing}
          style={[styles.syncBtn, { backgroundColor: theme.colors.primary }]}
        >
          <RefreshCw size={12} color="#ffffff" />
          <Text style={styles.syncBtnText}>{isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: spacingNumeric.md,
    paddingVertical: spacingNumeric.xs,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingNumeric.xs,
  },
  textStack: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacingNumeric.xs,
    borderRadius: radiusNumeric.full,
  },
  syncBtnText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: '700',
  },
});
