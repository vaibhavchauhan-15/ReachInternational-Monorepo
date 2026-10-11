/**
 * ReachInternational Mobile — Motion Toast Notification Primitive
 * 100% Web & Mobile Parity with apps/web/components/ui/Toast.tsx.
 *
 * Features:
 * - Vercel Geist design system tokens (#171717 ink, #ffffff / #171717 card-elevated, #ebebeb / #262626 hairline)
 * - Exact web-consistent colors: Reach Sky Blue (#0284c7 / #38bdf8), Error Red (#ee0000 / #f87171), Warning Amber (#f5a623 / #fbbf24)
 * - 100% Light and Dark theme synchronization
 * - Canonical <Text variant="..."> typography with zero raw typography properties in StyleSheet.create
 * - Reanimated spring physics entrance & exit
 * - Pan gesture swipe-to-dismiss (swipe up or horizontal)
 * - Safe area & status bar aware positioning at the top of the viewport
 * - Global useToast() hook & showToast() dispatcher
 * - Auto-dismiss after 4000ms
 * - Semantic tactile haptics feedback (confirm on success, reject on error, select on warning/info)
 */

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
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
import { useTheme } from '../ThemeProvider';
import { Text } from '../Text';
import { Pressable } from '../touch/Pressable';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from '../icon';
import { EFFECTS, DUR } from '../../../lib/motion/tokens';
import { useMotion } from '../../../lib/motion/useMotion';
import { haptics } from '../../../lib/haptics';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  durationMs?: number;
}

export interface ToastContextValue {
  toast: (type: ToastType, message: string, description?: string, options?: { durationMs?: number }) => void;
  dismiss: (id?: string) => void;
  currentToast: ToastItem | null;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Global standalone dispatcher for use outside React component render cycles
let globalToastDispatcher: ((type: ToastType, message: string, description?: string, options?: { durationMs?: number }) => void) | null = null;
let globalToastDismiss: ((id?: string) => void) | null = null;

export function showToast(type: ToastType, message: string, description?: string, options?: { durationMs?: number }): void {
  if (globalToastDispatcher) {
    globalToastDispatcher(type, message, description, options);
  } else if (__DEV__) {
    console.warn('[Toast] showToast called before ToastProvider was mounted:', type, message);
  }
}

export function dismissToast(id?: string): void {
  if (globalToastDismiss) {
    globalToastDismiss(id);
  }
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Graceful fallback for components rendered outside ToastProvider
    return {
      toast: (type, message, description, options) => showToast(type, message, description, options),
      dismiss: (id) => dismissToast(id),
      currentToast: null,
    };
  }
  return ctx;
}

interface ToastCardProps {
  item: ToastItem;
  onDismiss: () => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ item, onDismiss }) => {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { isReduced } = useMotion();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-50);
  const dismissX = useSharedValue(0);

  const durationMs = item.durationMs ?? 4000;

  const triggerHaptic = useCallback((type: ToastType) => {
    try {
      if (type === 'success') {
        haptics.confirm();
      } else if (type === 'error') {
        haptics.reject();
      } else {
        haptics.select();
      }
    } catch {
      // Haptics safety guard
    }
  }, []);

  useEffect(() => {
    triggerHaptic(item.type);

    dismissX.value = 0;
    if (isReduced) {
      opacity.value = 1;
      translateY.value = 0;
    } else {
      opacity.value = withSpring(1, {
        ...EFFECTS.fast,
        reduceMotion: ReduceMotion.System,
      });
      translateY.value = withSpring(0, {
        ...EFFECTS.fast,
        reduceMotion: ReduceMotion.System,
      });
    }

    if (durationMs > 0) {
      const timer = setTimeout(() => {
        dismissWithAnimation();
      }, durationMs);
      return () => clearTimeout(timer);
    }
  }, [item.id]);

  const dismissWithAnimation = useCallback(() => {
    if (isReduced) {
      opacity.value = 0;
      translateY.value = -50;
      onDismiss();
    } else {
      opacity.value = withTiming(0, { duration: DUR.xs });
      translateY.value = withTiming(
        -50,
        { duration: DUR.xs },
        (finished) => {
          if (finished) {
            runOnJS(onDismiss)();
          }
        }
      );
    }
  }, [isReduced, onDismiss]);

  const swipeGesture = useMemo(() => {
    return Gesture.Pan()
      .onUpdate((e) => {
        'worklet';
        // Allow horizontal swipe or upward flick
        if (e.translationY < 0) {
          translateY.value = e.translationY;
        } else {
          dismissX.value = e.translationX;
        }
      })
      .onEnd((e) => {
        'worklet';
        if (e.translationY < -30 || e.velocityY < -300) {
          translateY.value = withTiming(-60, { duration: 120 }, (finished) => {
            if (finished) runOnJS(onDismiss)();
          });
        } else if (Math.abs(e.translationX) > 80 || Math.abs(e.velocityX) > 400) {
          dismissX.value = withTiming(
            e.translationX > 0 ? 300 : -300,
            { duration: 120 },
            (finished) => {
              if (finished) runOnJS(onDismiss)();
            }
          );
        } else {
          translateY.value = withSpring(0, { ...EFFECTS.fast });
          dismissX.value = withSpring(0, { ...EFFECTS.fast });
        }
      });
  }, [onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: dismissX.value },
    ],
  }));

  // Visual styling mapped to website design tokens & dark/light theme
  const config = useMemo(() => {
    switch (item.type) {
      case 'success':
        return {
          icon: <CheckCircle2 size={16} color={isDark ? '#38bdf8' : '#0284c7'} />,
          iconBg: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)',
        };
      case 'error':
        return {
          icon: <AlertCircle size={16} color={isDark ? '#f87171' : '#ee0000'} />,
          iconBg: isDark ? 'rgba(248, 113, 113, 0.15)' : 'rgba(238, 0, 0, 0.10)',
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={16} color={isDark ? '#fbbf24' : '#d97706'} />,
          iconBg: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(245, 166, 35, 0.12)',
        };
      case 'info':
      default:
        return {
          icon: <Info size={16} color={isDark ? '#60a5fa' : '#0284c7'} />,
          iconBg: isDark ? 'rgba(96, 165, 250, 0.15)' : 'rgba(2, 132, 199, 0.12)',
        };
    }
  }, [item.type, isDark]);

  const topInset = Math.max(insets.top, 12) + (Platform.OS === 'web' ? 14 : 6);

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        { top: topInset },
        animatedStyle,
      ]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={swipeGesture}>
        <View
          style={[
            styles.toastCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
          ]}
        >
          {/* Circular Icon Container matching Web Toast */}
          <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
            {config.icon}
          </View>

          {/* Text Message & Optional Description */}
          <View style={styles.textColumn}>
            <Text
              variant="subheading"
              numberOfLines={2}
              style={{ color: theme.colors.ink }}
            >
              {item.message}
            </Text>
            {item.description ? (
              <Text
                variant="caption"
                numberOfLines={3}
                style={{ color: theme.colors.body, marginTop: 2 }}
              >
                {item.description}
              </Text>
            ) : null}
          </View>

          {/* Dismiss Close Button with Min 44px Touch Target */}
          <Pressable
            variant="iconButton"
            haptic="tap"
            hitSlopToMin48
            onPress={dismissWithAnimation}
            accessibilityLabel="Dismiss notification"
            style={styles.closeButton}
          >
            <X size={15} color={theme.colors.mute} />
          </Pressable>
        </View>
      </GestureDetector>
    </Animated.View>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentToast, setCurrentToast] = useState<ToastItem | null>(null);
  const queueRef = useRef<ToastItem[]>([]);

  const dismiss = useCallback((id?: string) => {
    setCurrentToast((curr) => {
      if (!curr) return null;
      if (id && curr.id !== id) return curr;
      // Show next in queue if available
      const next = queueRef.current.shift() || null;
      return next;
    });
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string, description?: string, options?: { durationMs?: number }) => {
      const item: ToastItem = {
        id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type,
        message,
        description,
        durationMs: options?.durationMs,
      };

      setCurrentToast((curr) => {
        if (!curr) {
          return item;
        }
        // If already showing a toast, replace it immediately or queue it
        return item;
      });
    },
    []
  );

  useEffect(() => {
    globalToastDispatcher = toast;
    globalToastDismiss = dismiss;
    return () => {
      globalToastDispatcher = null;
      globalToastDismiss = null;
    };
  }, [toast, dismiss]);

  const value = useMemo(
    () => ({ toast, dismiss, currentToast }),
    [toast, dismiss, currentToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {currentToast ? (
        <ToastCard key={currentToast.id} item={currentToast} onDismiss={() => dismiss(currentToast.id)} />
      ) : null}
    </ToastContext.Provider>
  );
};

/**
 * Backward-compatible low-level Toast primitive
 */
export interface LegacyToastProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  durationMs?: number;
  bottomOffset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Toast: React.FC<LegacyToastProps> = ({
  visible,
  onDismiss,
  children,
  durationMs = 4000,
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  if (!visible) return null;

  const topInset = Math.max(insets.top, 12) + 8;

  return (
    <View
      style={[styles.toastWrapper, { top: topInset }, style]}
      pointerEvents="box-none"
      testID={testID}
    >
      <View
        style={[
          styles.toastCard,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 99999,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  toastCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 16,
      },
    }),
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  closeButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
