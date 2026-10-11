/**
 * ReachInternational Mobile — Motion Popover / Dropdown Primitive
 * Anchored popover for dropdown menus, action pickers, and submenus.
 * Features:
 * - ScaleY 0.8 -> 1.0 + fade enter (~120ms)
 * - Fade exit (~75ms)
 * - Automatic flip above anchor when screen boundary is reached
 * - Back button and backdrop dismiss
 */

import React, { useEffect, useState, useId, useRef } from 'react';
import {
  View,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  ReduceMotion,
} from 'react-native-reanimated';
import { useOverlayHost } from './OverlayHost';
import { useMotion } from '../../../lib/motion/useMotion';
import { EFFECTS, SPATIAL, DUR } from '../../../lib/motion/tokens';
import { useTheme } from '../ThemeProvider';

export interface PopoverAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PopoverProps {
  visible: boolean;
  onClose: () => void;
  anchor?: PopoverAnchor | null;
  children: React.ReactNode;
  offsetY?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Popover: React.FC<PopoverProps> = ({
  visible,
  onClose,
  anchor,
  children,
  offsetY = 6,
  style,
  contentStyle,
  testID,
}) => {
  const instanceId = useId();
  const { registerOverlay, unregisterOverlay } = useOverlayHost();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { isReduced } = useMotion();
  const { theme } = useTheme();

  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(visible ? 1 : 0);
  const scaleY = useSharedValue(visible ? 1 : 0.8);

  const onDismissRef = useRef(onClose);
  onDismissRef.current = onClose;

  useEffect(() => {
    if (visible) {
      registerOverlay({ id: instanceId, onDismiss: () => onDismissRef.current() });
    } else {
      unregisterOverlay(instanceId);
    }
    return () => unregisterOverlay(instanceId);
  }, [visible, instanceId, registerOverlay, unregisterOverlay]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (isReduced) {
        opacity.value = 1;
        scaleY.value = 1;
      } else {
        opacity.value = withSpring(1, {
          ...EFFECTS.fast,
          reduceMotion: ReduceMotion.System,
        });
        scaleY.value = withSpring(1, {
          ...SPATIAL.fast,
          reduceMotion: ReduceMotion.System,
        });
      }
    } else {
      if (isReduced) {
        opacity.value = 0;
        scaleY.value = 1;
        setMounted(false);
      } else {
        opacity.value = withTiming(0, {
          duration: DUR.xs,
          reduceMotion: ReduceMotion.System,
        });
        scaleY.value = withTiming(
          0.85,
          {
            duration: DUR.xs,
            reduceMotion: ReduceMotion.System,
          },
          (finished) => {
            if (finished) {
              runOnJS(setMounted)(false);
            }
          },
        );
      }
    }
  }, [visible, isReduced, opacity, scaleY]);

  // Compute positioning relative to anchor
  const anchorY = anchor?.y ?? 0;
  const anchorH = anchor?.height ?? 0;
  const shouldFlipAbove = anchor ? anchorY + anchorH + 240 > screenHeight : false;

  const topPosition = anchor
    ? shouldFlipAbove
      ? Math.max(12, anchorY - offsetY - 220)
      : anchorY + anchorH + offsetY
    : 80;

  const leftPosition = anchor ? Math.max(12, Math.min(anchor.x, screenWidth - 280)) : 16;
  const popoverWidth = anchor ? Math.max(anchor.width, 220) : screenWidth - 32;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scaleY: scaleY.value }],
  }));

  if (!mounted) return null;

  return (
    <View style={styles.portalLayer} testID={testID} pointerEvents="box-none">
      {/* Invisible full-screen dismiss backdrop */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />

      <Animated.View
        style={[
          styles.popoverCard,
          {
            top: topPosition,
            left: leftPosition,
            width: popoverWidth,
            backgroundColor: theme.colors.canvasElevated,
            borderColor: theme.colors.hairline,
          },
          animatedStyle,
          contentStyle,
          style,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  portalLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 9995,
  },
  popoverCard: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 16,
  },
});
