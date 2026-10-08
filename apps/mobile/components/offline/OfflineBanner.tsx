import { Text } from '../ui/Text';
/**
 * OfflineBanner — Persistent Ambient Offline Telemetry Banner
 * Phase 14: Mobile Offline Sync & Network Resilience
 * Conforms to decisions D-03, D-07, and Vercel Geist design tokens.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../../lib/offline/useNetworkStatus';
import { useOfflineQueue } from '../../lib/offline/useOfflineQueue';
import { useTheme } from '../ui/ThemeProvider';
import { Pressable } from '../ui/touch/Pressable';
import { WifiOff, RefreshCw, AlertCircle } from '../ui/icon';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { haptics } from '../../lib/haptics';
import { OfflineCollisionModal } from './OfflineCollisionModal';

export const OfflineBanner: React.FC = () => {
  const { isOffline, checkConnectivity } = useNetworkStatus();
  const { pendingCount, syncingCount, failedCount, conflictCount, isSyncing, syncNow, queue } = useOfflineQueue();
  const { theme, isDark } = useTheme();
  const [isChecking, setIsChecking] = useState(false);
  const [showCollisionModal, setShowCollisionModal] = useState(false);

  let insets = { top: 0, bottom: 0, left: 0, right: 0 };
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    insets = useSafeAreaInsets();
  } catch {
    // Graceful fallback
  }

  const totalQueued = pendingCount + syncingCount + failedCount + conflictCount;
  const conflictingMutation = queue.find((item) => item.status === 'conflict') || null;

  // Auto-sync when online: If offline shift entries exist in local storage, sync automatically to cloud DB
  useEffect(() => {
    if (!isOffline && (pendingCount > 0 || failedCount > 0) && !isSyncing && !isChecking) {
      syncNow().catch((err) => {
        console.warn('[OfflineBanner] Auto-sync on online error:', err);
      });
    }
  }, [isOffline, pendingCount, failedCount, isSyncing, isChecking, syncNow]);

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

    // If there are server conflicts, open the collision resolution modal
    if (conflictCount > 0) {
      setShowCollisionModal(true);
      return;
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

  // Vercel Geist subtle amber token palette
  const bannerBg = isDark ? '#1a1306' : '#fffbeb';
  const bannerBorder = isDark ? '#3d2605' : '#fef08a';
  const bannerText = isDark ? '#fde047' : '#92400e';
  const bannerAccent = isDark ? '#eab308' : '#b45309';
  const actionBg = isDark ? 'rgba(250, 204, 21, 0.12)' : 'rgba(180, 83, 9, 0.08)';
  const actionBorder = isDark ? 'rgba(250, 204, 21, 0.25)' : 'rgba(180, 83, 9, 0.18)';

  // Absolute clearance for Android notification bar and iOS notch
  const androidStatusBar = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 0;
  const safeTop = Math.max(insets.top, androidStatusBar, Platform.OS === 'ios' ? 44 : 0);
  const paddingTop = Platform.OS === 'web' ? spacingNumeric.xxs : safeTop + 4;

  // Status Title & Subtitle Context (minimal, compact)
  const statusTitle = isOffline
    ? 'Offline'
    : isSyncing
    ? 'Syncing...'
    : conflictCount > 0
    ? 'Conflict'
    : failedCount > 0 && pendingCount === 0
    ? 'Sync Retry'
    : 'Queued';

  const statusSubtitle = isOffline
    ? conflictCount > 0
      ? `${conflictCount} conflict${conflictCount > 1 ? 's' : ''}`
      : totalQueued > 0
      ? `${totalQueued} ${totalQueued === 1 ? 'log' : 'logs'} queued`
      : 'Changes save locally'
    : isSyncing
    ? `${totalQueued} ${totalQueued === 1 ? 'log' : 'logs'}`
    : conflictCount > 0
    ? `${conflictCount} conflict • Tap Review`
    : failedCount > 0 && pendingCount === 0
    ? `${failedCount} failed • Tap retry`
    : `${totalQueued} ${totalQueued === 1 ? 'log' : 'logs'} pending`;

  const buttonLabel = conflictCount > 0
    ? 'Review'
    : isOffline
    ? isChecking
      ? 'Checking...'
      : 'Check'
    : isSyncing
    ? 'Syncing...'
    : failedCount > 0 && pendingCount === 0
    ? 'Retry'
    : 'Sync Now';

  const isButtonDisabled = isSyncing || isChecking;

  return (
    <>
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
              <WifiOff size={12} color={bannerAccent} animate="mount" style={styles.icon} />
            ) : conflictCount > 0 ? (
              <AlertCircle size={12} color={theme.colors.error} animate="mount" style={styles.icon} />
            ) : (
              <RefreshCw size={12} color={bannerAccent} loading={isSyncing} style={styles.icon} />
            )}

            <Text variant="micro" style={[styles.title, { color: bannerText }]} numberOfLines={1}>
              {statusTitle}
            </Text>

            <Text variant="micro" style={[styles.bullet, { color: bannerAccent }]}>•</Text>

            <Text
              variant="micro"
              style={[styles.countText, { color: bannerText }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {statusSubtitle}
            </Text>
          </View>

          {/* Right CTA: Action Pill (Min 44px touch target via hitSlopToMin48) */}
          <Pressable
            variant="chip"
            haptic="tap"
            onPress={handleActionPress}
            disabled={isButtonDisabled}
            style={[
              styles.actionButton,
              {
                backgroundColor: actionBg,
                borderColor: actionBorder,
              },
            ]}
            hitSlopToMin48={true}
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
          >
            {isSyncing || isChecking ? (
              <ActivityIndicator size="small" color={bannerAccent} style={styles.spinner} />
            ) : (
              <RefreshCw size={10} color={bannerAccent} style={styles.buttonIcon} />
            )}
            <Text variant="micro" style={[styles.buttonText, { color: bannerText }]}>
              {buttonLabel}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Conflict Resolution Modal */}
      {conflictingMutation && (
        <OfflineCollisionModal
          visible={showCollisionModal}
          onClose={() => setShowCollisionModal(false)}
          queuedMutation={conflictingMutation}
          onResubmitSuccess={() => {
            setShowCollisionModal(false);
            syncNow().catch(() => {});
          }}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: spacingNumeric.md,
    paddingBottom: 5,
    borderBottomWidth: 1,
    zIndex: 999,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 26,
    gap: 8,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 5,
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
    opacity: 0.85,
    flexShrink: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radiusNumeric.full,
    borderWidth: 1,
    minHeight: 24,
    justifyContent: 'center',
    gap: 3,
    flexShrink: 0,
  },
  buttonIcon: {
    marginRight: 1,
  },
  spinner: {
    width: 10,
    height: 10,
    marginRight: 2,
    transform: [{ scale: 0.65 }],
  },
  buttonText: {
  },
});
