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

import React, { useEffect, useState, useMemo, useId, useCallback } from 'react';
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

// Tuned 60/120fps fluid springs matching web 280ms cubic-bezier(.32,.72,0,1) with zero wobble
const OPEN_SPRING = {
  damping: 30,
  stiffness: 320,
  mass: 0.85,
  overshootClamping: true,
};

const CLOSE_SPRING = {
  damping: 32,
  stiffness: 360,
  mass: 0.8,
  overshootClamping: true,
};

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

  const translateX = useSharedValue(drawerWidth);
  const contextX = useSharedValue(0);

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
      registerOverlay({ id: instanceId, onDismiss: onClose });
    } else {
      unregisterOverlay(instanceId);
    }
    return () => unregisterOverlay(instanceId);
  }, [visible, instanceId, onClose, registerOverlay, unregisterOverlay]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (isReduced) {
        translateX.value = 0;
      } else {
        translateX.value = withSpring(0, {
          ...OPEN_SPRING,
          reduceMotion: ReduceMotion.System,
        });
      }
    } else {
      if (isReduced) {
        translateX.value = drawerWidth;
        handleDismissComplete();
      } else {
        translateX.value = withSpring(
          drawerWidth,
          {
            ...CLOSE_SPRING,
            reduceMotion: ReduceMotion.System,
          },
          (finished) => {
            if (finished) {
              runOnJS(handleDismissComplete)();
            }
          },
        );
      }
    }
  }, [visible, isReduced, drawerWidth, translateX, handleDismissComplete]);

  // Gesture to swipe right to close drawer
  const panGesture = useMemo(() => {
    return Gesture.Pan()
      .activeOffsetX([15, 15])
      .failOffsetY([-15, 15])
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
        const dismissThreshold = drawerWidth * 0.35;

        if (projectedX > dismissThreshold || e.velocityX > 400) {
          translateX.value = withSpring(
            drawerWidth,
            {
              ...CLOSE_SPRING,
              velocity: e.velocityX,
              reduceMotion: ReduceMotion.System,
            },
            (finished) => {
              if (finished) {
                runOnJS(onClose)();
                runOnJS(handleDismissComplete)();
              }
            },
          );
        } else {
          translateX.value = withSpring(0, {
            ...OPEN_SPRING,
            velocity: e.velocityX,
            reduceMotion: ReduceMotion.System,
          });
        }
      });
  }, [drawerWidth, translateX, contextX, onClose, handleDismissComplete]);

  const drawerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

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
