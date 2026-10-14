/**
 * ReachInternational Mobile — Motion Centered Dialog Primitive
 * Android 16 Material 3 Expressive centered modal dialog.
 * Features:
 * - Scrim fade EFFECTS.default
 * - Card scale 0.92 -> 1.0 + fade on enter (~200ms)
 * - Card exit scale 1.0 -> 0.96 + fade (~120ms)
 * - Top-most BackHandler dismissal priority
 * - IME & keyboard safe
 */

import React, { useEffect, useState, useId, useRef } from 'react';
import {
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  ReduceMotion,
} from 'react-native-reanimated';
import { Scrim } from './Scrim';
import { useOverlayHost } from './OverlayHost';
import { useMotion } from '../../../lib/motion/useMotion';
import { SPATIAL, EFFECTS, DUR, SCALE } from '../../../lib/motion/tokens';
import { useTheme } from '../ThemeProvider';

export interface DialogProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  persistent?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  visible,
  onClose,
  children,
  persistent = false,
  style,
  contentStyle,
  testID,
}) => {
  const instanceId = useId();
  const { registerOverlay, unregisterOverlay } = useOverlayHost();
  const { isReduced } = useMotion();
  const { theme } = useTheme();

  const [mounted, setMounted] = useState(visible);
  const opacity = useSharedValue(visible ? 1 : 0);
  const scale = useSharedValue(visible ? 1 : SCALE.dialogFrom);

  const onDismissRef = useRef(onClose);
  onDismissRef.current = onClose;

  // Register in top-level overlay stack for hardware back priority
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
        scale.value = 1;
      } else {
        opacity.value = withSpring(1, {
          ...EFFECTS.default,
          reduceMotion: ReduceMotion.System,
        });
        scale.value = withSpring(1, {
          ...SPATIAL.default,
          reduceMotion: ReduceMotion.System,
        });
      }
    } else {
      if (isReduced) {
        opacity.value = 0;
        scale.value = 1;
        setMounted(false);
      } else {
        opacity.value = withTiming(0, {
          duration: DUR.sm,
          reduceMotion: ReduceMotion.System,
        });
        scale.value = withTiming(
          0.96,
          {
            duration: DUR.sm,
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
  }, [visible, isReduced, opacity, scale]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
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
      <View style={styles.portalLayer} testID={testID} pointerEvents="box-none">
        <Scrim visible={visible} onPress={persistent ? undefined : onClose} persistent={persistent} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.centerContainer}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.dialogCard,
              {
                backgroundColor: theme.colors.canvasElevated,
                borderColor: theme.colors.hairline,
              },
              cardAnimatedStyle,
              contentStyle,
              style,
            ]}
          >
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  portalLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 9990,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.32)',
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
        shadowRadius: 24,
        elevation: 24,
      },
    }),
  },
});
