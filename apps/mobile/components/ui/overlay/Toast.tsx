/**
 * ReachInternational Mobile — Motion Toast / Snackbar Primitive
 * Physics-driven in-app notification snackbar.
 * Features:
 * - Slide up 16 dp + fade EFFECTS.fast
 * - Fade exit (~100ms)
 * - Safe area & bottom nav aware
 * - Pan gesture swipe-to-dismiss (swipe down or horizontal)
 * - Queue max 1 visible
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
import { useMotion } from '../../../lib/motion/useMotion';
import { EFFECTS, DUR, DIST } from '../../../lib/motion/tokens';
import { useTheme } from '../ThemeProvider';

export interface ToastProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  durationMs?: number;
  bottomOffset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  onDismiss,
  children,
  durationMs = 4000,
  bottomOffset,
  style,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const { isReduced } = useMotion();
  const { theme } = useTheme();

  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(visible ? 1 : 0);
  const translateY = useSharedValue(visible ? 0 : DIST.toastSlide);
  const dismissX = useSharedValue(0);

  const handleDismissFinished = useCallback(() => {
    setMounted(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
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

      // Auto dismiss timer
      if (durationMs > 0) {
        const timer = setTimeout(() => {
          onDismiss();
        }, durationMs);
        return () => clearTimeout(timer);
      }
    } else {
      if (isReduced) {
        opacity.value = 0;
        translateY.value = DIST.toastSlide;
        setMounted(false);
      } else {
        opacity.value = withTiming(0, {
          duration: DUR.xs,
          reduceMotion: ReduceMotion.System,
        });
        translateY.value = withTiming(
          DIST.toastSlide,
          {
            duration: DUR.xs,
            reduceMotion: ReduceMotion.System,
          },
          (finished) => {
            if (finished) {
              runOnJS(handleDismissFinished)();
            }
          },
        );
      }
    }
  }, [visible, isReduced, durationMs, opacity, translateY, dismissX, onDismiss, handleDismissFinished]);

  // Swipe gesture to dismiss toast
  const swipeGesture = useMemo(() => {
    return Gesture.Pan()
      .onUpdate((e) => {
        'worklet';
        dismissX.value = e.translationX;
      })
      .onEnd((e) => {
        'worklet';
        if (Math.abs(e.translationX) > 80 || Math.abs(e.velocityX) > 400) {
          dismissX.value = withTiming(
            e.translationX > 0 ? 300 : -300,
            { duration: 120 },
            (finished) => {
              if (finished) {
                runOnJS(onDismiss)();
              }
            },
          );
        } else {
          dismissX.value = withSpring(0, {
            ...EFFECTS.fast,
            reduceMotion: ReduceMotion.System,
          });
        }
      });
  }, [dismissX, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: dismissX.value },
    ],
  }));

  if (!mounted) return null;

  const defaultBottom = Math.max(insets.bottom, 16) + 68; // Sits comfortably above floating bottom nav
  const bottomPosition = bottomOffset !== undefined ? bottomOffset : defaultBottom;

  return (
    <View
      style={[styles.toastContainer, { bottom: bottomPosition }]}
      pointerEvents="box-none"
      testID={testID}
    >
      <GestureDetector gesture={swipeGesture}>
        <Animated.View
          style={[
            styles.toastCard,
            {
              backgroundColor: theme.colors.canvasElevated,
              borderColor: theme.colors.hairline,
            },
            animatedStyle,
            style,
          ]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 14,
        elevation: 16,
      },
    }),
  },
});
