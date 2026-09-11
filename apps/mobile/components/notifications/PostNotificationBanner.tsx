/**
 * ReachInternational Mobile — Ambient Post Notification Banner
 * Floating in-app toast banner displaying real-time operational notifications
 * for Machines, Users, Logs Entry, Logs Export/Manage, and Profile updates.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ui/ThemeProvider';
import {
  subscribeToPostNotifications,
  PostNotificationPayload,
} from '../../lib/notifications';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import {
  Truck,
  Users,
  Clock,
  FileText,
  UserCheck,
  Bell,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react-native';

const AUTO_DISMISS_DURATION_MS = 4500;

export const PostNotificationBanner: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const [currentNotif, setCurrentNotif] = useState<PostNotificationPayload | null>(null);

  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setCurrentNotif(null);
    });
  }, [translateY, opacity]);

  useEffect(() => {
    const unsubscribe = subscribeToPostNotifications((notification) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setCurrentNotif(notification);

      // Reset values
      translateY.setValue(-100);
      opacity.setValue(0);

      // Animate In
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: Platform.OS !== 'web',
          tension: 70,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      // Set Auto Dismiss
      timerRef.current = setTimeout(() => {
        dismiss();
      }, AUTO_DISMISS_DURATION_MS);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, translateY, opacity]);

  if (!currentNotif) return null;

  // Icon Resolution by Category & Severity
  const renderIcon = () => {
    const size = 16;
    if (currentNotif.severity === 'error') {
      return <AlertTriangle size={size} color="#ef4444" />;
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
        return <Bell size={size} color={theme.colors.link} />;
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
          transform: [{ translateY }],
          opacity,
          pointerEvents: 'box-none',
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
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
        <TouchableOpacity
          onPress={dismiss}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Dismiss notification"
        >
          <X size={14} color={theme.colors.mute} />
        </TouchableOpacity>
      </TouchableOpacity>
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 20,
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
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 9,
    fontWeight: '500',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  body: {
    fontSize: 11,
    lineHeight: 15,
  },
  closeBtn: {
    padding: 4,
    marginTop: 1,
  },
});
