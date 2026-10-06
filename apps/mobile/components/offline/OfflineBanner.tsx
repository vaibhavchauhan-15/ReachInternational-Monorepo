import { Text } from '../ui/Text';
/**
 * OfflineBanner — Persistent Ambient Offline Telemetry Banner
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-03, D-07, and Vercel Geist design tokens.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../lib/offline/useNetworkStatus';
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue';
import { useTheme } from '../ui/ThemeProvider';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/interaction/haptics';

const systemFontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: 'System',
});

export const OfflineBanner: React.FC = () => {
  const { isOffline, checkConnectivity } = useNetworkStatus();
  const { pendingCount, syncingCount, failedCount, conflictCount, isSyncing, syncNow } = useOfflineQueue();
  const { theme, isDark } = useTheme();
  const [isChecking, setIsChecking] = useState(false);

  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    // Graceful fallback
  }

  const totalQueued = pendingCount + syncingCount + failedCount + conflictCount;

  // Only render if device is offline or if items are currently queued/syncing
  if (!isOffline && totalQueued === 0 && !isSyncing) {
    return null;
  }

  const handleActionPress = async () => {
    try {
      haptics.light();
    } catch {
      // ignore
    }

    if (isOffline) {
      setIsChecking(true);
      const isNowOnline = await checkConnectivity();
      setIsChecking(false);

      if (isNowOnline) {
        try {
          haptics.success();
        } catch {
          // ignore
        }
        await syncNow().catch((err) => {
          console.warn('[OfflineBanner] Sync error:', err);
        });
      } else {
        try {
          haptics.warning();
        } catch {
          // ignore
        }
      }
      return;
    }

    if (!isSyncing && totalQueued > 0) {
      syncNow().catch((err) => {
        console.warn('[OfflineBanner] Sync error:', err);
      });
    }
  };

  // Vercel Geist amber token palette
  const bannerBg = isDark ? '#261703' : '#fffbeb';
  const bannerBorder = isDark ? '#4a2800' : '#fde68a';
  const bannerText = isDark ? '#fbbf24' : '#92400e';
  const bannerAccent = isDark ? '#f59e0b' : '#b45309';
  const actionBg = isDark ? 'rgba(251, 191, 36, 0.14)' : 'rgba(217, 119, 6, 0.1)';
  const actionBorder = isDark ? 'rgba(251, 191, 36, 0.25)' : 'rgba(217, 119, 6, 0.2)';

  const paddingTop = Platform.OS === 'web' ? 7 : Math.max(insets.top, 7);

  // Status Title & Subtitle Context
  const statusTitle = isOffline
    ? 'Offline Mode'
    : isSyncing
    ? 'Synchronizing...'
    : 'Local Queue';

  const statusSubtitle = isOffline
    ? conflictCount > 0
      ? `${conflictCount} conflict${conflictCount > 1 ? 's' : ''}`
      : totalQueued > 0
      ? `${totalQueued} ${totalQueued === 1 ? 'log' : 'logs'} queued`
      : 'Changes save locally'
    : isSyncing
    ? `${totalQueued} ${totalQueued === 1 ? 'log' : 'logs'}`
    : `${totalQueued} ${totalQueued === 1 ? 'log' : 'logs'} pending`;

  const buttonLabel = isOffline
    ? isChecking
      ? 'Checking...'
      : 'Check'
    : isSyncing
    ? 'Syncing...'
    : 'Sync Now';

  const isButtonDisabled = isSyncing || isChecking;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bannerBg,
          borderBottomColor: bannerBorder,
          paddingTop,
        },
      ]}
    >
      <View style={styles.contentRow}>
        {/* Left Status: Ambient Icon + Status Title + Context Bullet */}
        <View style={styles.leftCol}>
          {isOffline ? (
            <WifiOff size={13} color={bannerAccent} style={styles.icon} />
          ) : conflictCount > 0 ? (
            <AlertCircle size={13} color={theme.colors.error} style={styles.icon} />
          ) : (
            <RefreshCw size={13} color={bannerAccent} style={styles.icon} />
          )}

          <Text style={[styles.title, { color: bannerText }]} numberOfLines={1}>
            {statusTitle}
          </Text>

          <Text style={[styles.bullet, { color: bannerAccent }]}>•</Text>

          <Text
            style={[styles.countText, { color: bannerText }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {statusSubtitle}
          </Text>
        </View>

        {/* Right CTA: Action Pill (Min 44px touch target via hitSlop) */}
        <TouchableOpacity
          onPress={handleActionPress}
          disabled={isButtonDisabled}
          activeOpacity={0.7}
          style={[
            styles.actionButton,
            {
              backgroundColor: actionBg,
              borderColor: actionBorder,
            },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={buttonLabel}
        >
          {isSyncing || isChecking ? (
            <ActivityIndicator size="small" color={bannerAccent} style={styles.spinner} />
          ) : (
            <RefreshCw size={11} color={bannerAccent} style={styles.buttonIcon} />
          )}
          <Text style={[styles.buttonText, { color: bannerText }]}>
            {buttonLabel}
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
    paddingBottom: 7,
    borderBottomWidth: 1,
    zIndex: 999,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
    gap: 8,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  icon: {
    flexShrink: 0,
  },
  title: {
    flexShrink: 0,
  },
  bullet: {
    opacity: 0.5,
    flexShrink: 0,
  },
  countText: {
    opacity: 0.9,
    flexShrink: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 30,
    justifyContent: 'center',
    gap: 4,
    flexShrink: 0,
  },
  buttonIcon: {
    marginRight: 1,
  },
  spinner: {
    width: 11,
    height: 11,
    marginRight: 2,
    transform: [{ scale: 0.7 }],
  },
  buttonText: {
  },
});
