import { useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { motion } from '@reachinternational/design-tokens';

export type AppModalVariant = 'center' | 'bottom' | 'right' | 'fullscreen';

export interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  variant?: AppModalVariant;
  children: ReactNode;
  backdropColor?: string;
  style?: StyleProp<ViewStyle>;
  panelStyle?: StyleProp<ViewStyle>;
  persistent?: boolean;
  testID?: string;
}

const LAYOUT = {
  center: { justifyContent: 'center' as const, padding: 24 },
  bottom: { justifyContent: 'flex-end' as const },
  right: { alignItems: 'flex-end' as const },
  fullscreen: {},
} as const;

export function AppModal({
  visible,
  onClose,
  variant = 'center',
  children,
  backdropColor = 'rgba(0,0,0,0.45)',
  style,
  panelStyle,
  persistent = false,
  testID,
}: AppModalProps) {
  const { width, height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const t = useSharedValue(visible ? 1 : 0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (visible) {
      setMounted(true);
      t.value = withTiming(1, {
        duration: motion.duration.base,
        easing: Easing.bezier(...motion.easing.decelerate),
      });
    } else {
      t.value = withTiming(
        0,
        {
          duration: motion.duration.fast,
          easing: Easing.bezier(...motion.easing.accelerate),
        },
        (done) => {
          if (done) runOnJS(setMounted)(false);
        }
      );
    }
  }, [visible, t]);

  const backdrop = useAnimatedStyle(() => ({
    opacity: t.value,
  }));

  const panel = useAnimatedStyle(() => {
    if (reduce) {
      return {
        opacity: t.value,
      };
    }

    switch (variant) {
      case 'bottom':
        return {
          opacity: t.value,
          transform: [{ translateY: (1 - t.value) * height }],
        };
      case 'right':
        return {
          opacity: t.value,
          transform: [{ translateX: (1 - t.value) * width }],
        };
      case 'fullscreen':
        return {
          opacity: t.value,
          transform: [{ scale: 0.98 + t.value * 0.02 }],
        };
      default:
        return {
          opacity: t.value,
          transform: [{ scale: 0.96 + t.value * 0.04 }],
        };
    }
  });

  return (
    <Modal
      transparent
      animationType="none"
      visible={mounted}
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: backdropColor },
          backdrop,
        ]}
      >
        {variant !== 'fullscreen' && !persistent && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close"
          />
        )}
      </Animated.View>
      <View
        pointerEvents="box-none"
        style={[styles.base, LAYOUT[variant], style]}
      >
        <Animated.View
          style={[
            variant === 'bottom' && styles.fullWidth,
            variant === 'right' && styles.fullHeight,
            panel,
            panelStyle,
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
  },
  fullHeight: {
    height: '100%',
  },
  fullWidth: {
    width: '100%',
  },
});
