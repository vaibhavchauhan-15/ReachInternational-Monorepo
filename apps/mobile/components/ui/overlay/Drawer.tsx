/**
 * ReachInternational Mobile — Motion Right Drawer Primitive
 * Android 16 Material 3 Expressive physics slide-in drawer.
 * Features:
 * - UI-thread gesture drag-to-dismiss (swipe right)
 * - Velocity handoff with flick dismissal
 * - Scrim bound to progress
 * - Overshoot clamped on close
 * - Top-most BackHandler dismissal priority
 */

import React, { useEffect, useState, useMemo, useId, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
  Platform,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
  ReduceMotion,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scrim } from './Scrim';
import { useOverlayHost } from './OverlayHost';
import { useMotion } from '../../../lib/motion/useMotion';
import { project } from '../../../lib/motion/springs';
import { useTheme } from '../ThemeProvider';

export interface DrawerProps {
  visible: boolean;
  onClose: () => void;
  onDismissComplete?: () => void;
  children: React.ReactNode;
  overlay?: React.ReactNode;
  widthRatio?: number;
  maxPixelWidth?: number;
  persistent?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

// Tuned 60/120fps fluid curves matching web 220ms/180ms cubic-bezier for silky smooth, lightweight drawer motion
const OPEN_EASING = Easing.bezier(0.16, 1, 0.3, 1);
const CLOSE_EASING = Easing.bezier(0.3, 0, 0.8, 0.15);

export const Drawer: React.FC<DrawerProps> = ({
  visible,
  onClose,
  onDismissComplete,
  children,
  overlay,
  widthRatio = 0.86,
  maxPixelWidth = 340,
  persistent = false,
  style,
  contentStyle,
  testID,
}) => {
  const instanceId = useId();
  const { registerOverlay, unregisterOverlay } = useOverlayHost();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isReduced } = useMotion();
  const { theme } = useTheme();

  const drawerWidth = Math.min(screenWidth * widthRatio, maxPixelWidth);
  const [mounted, setMounted] = useState(visible);

  const translateX = useSharedValue(visible ? 0 : drawerWidth);
  const contextX = useSharedValue(0);

  const onDismissRef = useRef(onClose);
  onDismissRef.current = onClose;

  // Synchronized scrim opacity linked directly to drawer position on UI thread
  const scrimOpacity = useDerivedValue(() => {
    'worklet';
    const norm = Math.max(0, Math.min(1, 1 - translateX.value / drawerWidth));
    return norm * 0.45;
  });

  const handleDismissComplete = useCallback(() => {
    setMounted(false);
    onDismissComplete?.();
  }, [onDismissComplete]);

  useEffect(() => {
    if (visible) {
      registerOverlay({ id: instanceId, onDismiss: () => onDismissRef.current() });
    } else {
      unregisterOverlay(instanceId);
    }
    return () => unregisterOverlay(instanceId);
  }, [visible, instanceId, registerOverlay, unregisterOverlay]);

  // Guaranteed fallback unmount timer in case animation is preempted
  useEffect(() => {
    if (!visible && mounted) {
      const fallbackTimer = setTimeout(() => {
        handleDismissComplete();
      }, 220);
      return () => clearTimeout(fallbackTimer);
    }
  }, [visible, mounted, handleDismissComplete]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (isReduced) {
        translateX.value = 0;
      } else {
        translateX.value = withTiming(0, {
          duration: 200,
          easing: OPEN_EASING,
          reduceMotion: ReduceMotion.System,
        });
      }
    } else {
      if (isReduced) {
        translateX.value = drawerWidth;
        handleDismissComplete();
      } else {
        translateX.value = withTiming(
          drawerWidth,
          {
            duration: 170,
            easing: CLOSE_EASING,
            reduceMotion: ReduceMotion.System,
          },
          () => {
            runOnJS(handleDismissComplete)();
          },
        );
      }
    }
  }, [visible, isReduced, drawerWidth, translateX, handleDismissComplete]);

  // Gesture to swipe right to close drawer.
  // CRITICAL: activeOffsetX(25) ensures normal taps (translationX = 0) NEVER activate the Pan gesture,
  // preventing child Pressable / Touchable touch cancellation and stuck ripple artifacts.
  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX(25)
      .failOffsetX(-15)
      .failOffsetY([-25, 25])
      .cancelsTouchesInView(false)
      .onStart(() => {
        'worklet';
        contextX.value = translateX.value;
      })
      .onUpdate((e) => {
        'worklet';
        const next = contextX.value + e.translationX;
        // Only allow dragging to the right (closing)
        if (next >= 0) {
          translateX.value = next;
        }
      })
      .onEnd((e) => {
        'worklet';
        const projectedX = translateX.value + project(e.velocityX);
        const dismissThreshold = drawerWidth * 0.3;

        if (projectedX > dismissThreshold || e.velocityX > 350) {
          translateX.value = withTiming(
            drawerWidth,
            {
              duration: 160,
              easing: CLOSE_EASING,
              reduceMotion: ReduceMotion.System,
            },
            () => {
              runOnJS(onClose)();
              runOnJS(handleDismissComplete)();
            },
          );
        } else {
          translateX.value = withTiming(0, {
            duration: 170,
            easing: OPEN_EASING,
            reduceMotion: ReduceMotion.System,
          });
        }
      });
  }, [drawerWidth, translateX, contextX, onClose, handleDismissComplete]);

  const drawerAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const norm = Math.max(0, Math.min(1, 1 - translateX.value / drawerWidth));
    return {
      transform: [{ translateX: translateX.value }],
      opacity: 0.2 + norm * 0.8,
    };
  });

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <View style={styles.portalLayer} testID={testID} pointerEvents="box-none">
          <Scrim
            visible={visible}
            animatedOpacity={scrimOpacity}
            onPress={persistent ? undefined : onClose}
            persistent={persistent}
          />
          <View style={styles.rightAlignWrapper} pointerEvents="box-none">
            {Platform.OS !== 'web' ? (
              <GestureDetector gesture={panGesture}>
                <Animated.View
                  style={[
                    styles.drawerPanel,
                    {
                      width: drawerWidth,
                      backgroundColor: theme.colors.canvasElevated,
                      borderColor: theme.colors.hairline,
                      paddingTop: insets.top,
                      paddingBottom: insets.bottom,
                    },
                    drawerAnimatedStyle,
                    contentStyle,
                    style,
                  ]}
                >
                  {children}
                </Animated.View>
              </GestureDetector>
            ) : (
              <Animated.View
                style={[
                  styles.drawerPanel,
                  {
                    width: drawerWidth,
                    backgroundColor: theme.colors.canvasElevated,
                    borderColor: theme.colors.hairline,
                    paddingTop: insets.top,
                    paddingBottom: insets.bottom,
                  },
                  drawerAnimatedStyle,
                  contentStyle,
                  style,
                ]}
              >
                {children}
              </Animated.View>
            )}
          </View>
          {overlay}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  portalLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 9985,
  },
  rightAlignWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  drawerPanel: {
    height: '100%',
    borderLeftWidth: 1,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: -6, height: 0 },
        shadowOpacity: 0.24,
        shadowRadius: 20,
        elevation: 24,
      },
    }),
  },
});
