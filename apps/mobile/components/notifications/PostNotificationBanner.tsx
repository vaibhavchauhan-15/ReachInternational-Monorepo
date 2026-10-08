import { Text } from '../ui/Text';
/**
 * ReachInternational Mobile — Ambient Post Notification Banner
 * Floating in-app toast banner displaying real-time operational notifications
 * for Machines, Users, Logs Entry, Logs Export/Manage, and Profile updates.
 * Powered by Reanimated 4 & Gesture Handler with Material 3 Expressive motion.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  ReduceMotion,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/ThemeProvider';
import { Pressable } from '../ui/touch/Pressable';
import {
  subscribeToPostNotifications,
  PostNotificationPayload,
} from '../../lib/notifications';
import { radiusNumeric } from '@reachinternational/design-tokens';
import {
  Truck,
  Users,
  Clock,
  FileText,
  UserCheck,
  Bell,
  X,
  AlertTriangle,
} from '../ui/icon';
import { EFFECTS, SPATIAL, DUR } from '../../lib/motion/tokens';
import { useMotion } from '../../lib/motion/useMotion';

const AUTO_DISMISS_DURATION_MS = 4500;

export const PostNotificationBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { isReduced } = useMotion();
  const [currentNotif, setCurrentNotif] = useState<PostNotificationPayload | null>(null);

  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);
  const dragY = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCurrent = useCallback(() => {
    setCurrentNotif(null);
  }, []);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (isReduced) {
      opacity.value = 0;
      translateY.value = -120;
      clearCurrent();
    } else {
      opacity.value = withTiming(0, {
        duration: DUR.xs,
        reduceMotion: ReduceMotion.System,
      });
      translateY.value = withTiming(
        -120,
        {
          duration: DUR.sm,
          reduceMotion: ReduceMotion.System,
        },
        (finished) => {
          if (finished) {
            runOnJS(clearCurrent)();
          }
        },
      );
    }
  }, [clearCurrent, isReduced, opacity, translateY]);

  useEffect(() => {
    const unsubscribe = subscribeToPostNotifications((notification) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setCurrentNotif(notification);

      // Reset values
      translateY.value = -100;
      opacity.value = 0;
      dragY.value = 0;

      // Animate In with Material 3 Expressive spring
      if (isReduced) {
        translateY.value = 0;
        opacity.value = 1;
      } else {
        translateY.value = withSpring(0, {
          ...SPATIAL.fast,
          reduceMotion: ReduceMotion.System,
        });
        opacity.value = withSpring(1, {
          ...EFFECTS.fast,
          reduceMotion: ReduceMotion.System,
        });
      }

      // Set Auto Dismiss
      timerRef.current = setTimeout(() => {
        dismiss();
      }, AUTO_DISMISS_DURATION_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, isReduced, opacity, translateY, dragY]);

  // Swipe up gesture to dismiss notification
  const swipeGesture = useMemo(() => {
    return Gesture.Pan()
      .onUpdate((e) => {
        'worklet';
        // Only allow upward dragging
        if (e.translationY < 0) {
          dragY.value = e.translationY;
        }
      })
      .onEnd((e) => {
        'worklet';
        if (e.translationY < -30 || e.velocityY < -300) {
          translateY.value = withTiming(
            -120,
            { duration: 120 },
            (finished) => {
              if (finished) {
                runOnJS(clearCurrent)();
              }
            },
          );
        } else {
          dragY.value = withSpring(0, {
            ...SPATIAL.fast,
            reduceMotion: ReduceMotion.System,
          });
        }
      });
  }, [dragY, translateY, clearCurrent]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
    opacity: opacity.value,
  }));

  if (!currentNotif) return null;

  // Icon Resolution by Category & Severity
  const renderIcon = () => {
    const size = 16;
    if (currentNotif.severity === 'error') {
      return <AlertTriangle size={size} color="#ef4444" animate="mount" />;
    }
    switch (currentNotif.category) {
      case 'machine':
        return <Truck size={size} color={isDark ? '#38bdf8' : '#0284c7'} />;
      case 'user':
        return <Users size={size} color={isDark ? '#a78bfa' : '#7c3aed'} />;
      case 'log_entry':
        return <Clock size={size} color={isDark ? '#34d399' : '#059669'} />;
      case 'log_manage':
        return <FileText size={size} color={isDark ? '#fbbf24' : '#d97706'} />;
      case 'profile':
        return <UserCheck size={size} color={theme.colors.link} />;
      default:
        return <Bell size={size} color={theme.colors.link} pulseKey={currentNotif.id} />;
    }
  };

  const getSeverityBorder = () => {
    switch (currentNotif.severity) {
      case 'success':
        return isDark ? '#059669' : '#10b981';
      case 'warning':
        return isDark ? '#d97706' : '#f59e0b';
      case 'error':
        return isDark ? '#dc2626' : '#ef4444';
      default:
        return theme.colors.hairline;
    }
  };

  const getCategoryLabel = () => {
    switch (currentNotif.category) {
      case 'machine':
        return 'FLEET ASSET';
      case 'user':
        return 'PERSONNEL';
      case 'log_entry':
        return 'SHIFT LOG';
      case 'log_manage':
        return 'OPERATIONS';
      case 'profile':
        return 'ACCOUNT';
      default:
        return 'NOTIFICATION';
    }
  };

  const topOffset = Math.max(insets.top, 12) + 6;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          pointerEvents: 'box-none',
        },
        animatedStyle,
      ]}
    >
      <GestureDetector gesture={swipeGesture}>
        <Pressable
          variant="card"
          haptic={false}
          onPress={dismiss}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: getSeverityBorder(),
            },
          ]}
        >
          {/* Left Icon Pill */}
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: isDark ? '#262626' : '#f4f4f5',
                borderColor: theme.colors.hairline,
              },
            ]}
          >
            {renderIcon()}
          </View>

          {/* Content Body */}
          <View style={styles.textCol}>
            <View style={styles.metaRow}>
              <Text style={[styles.categoryBadge, { color: theme.colors.mute }]}>
                {getCategoryLabel()}
              </Text>
              <Text style={[styles.timeText, { color: theme.colors.mute }]}>Just now</Text>
            </View>
            <Text style={[styles.title, { color: theme.colors.ink }]} numberOfLines={1}>
              {currentNotif.title}
            </Text>
            <Text style={[styles.body, { color: theme.colors.body }]} numberOfLines={2}>
              {currentNotif.body}
            </Text>
          </View>

          {/* Dismiss Button (min touch target) */}
          <Pressable
            variant="iconButton"
            haptic="tap"
            onPress={dismiss}
            style={styles.closeBtn}
            hitSlopToMin48={true}
            accessibilityLabel="Dismiss notification"
          >
            <X size={14} color={theme.colors.mute} />
          </Pressable>
        </Pressable>
      </GestureDetector>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 99999,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.28)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 20,
      },
    }),
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radiusNumeric.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textCol: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  categoryBadge: {
    textTransform: 'uppercase',
  },
  timeText: {
  },
  title: {
    marginBottom: 2,
  },
  body: {
  },
  closeBtn: {
    padding: 4,
    marginTop: 1,
  },
});
