import { createContext, memo, useContext, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { motion } from '@reachinternational/design-tokens';
import { haptics, type HapticKind } from '@/lib/interaction/haptics';
import { useTheme } from '@/lib/theme';

const APressable = Animated.createAnimatedComponent(Pressable);

const PRESETS = {
  card:   { scale: motion.press.card,   haptic: undefined as HapticKind | undefined },
  row:    { scale: 1,                   haptic: undefined as HapticKind | undefined }, // opacity only
  button: { scale: motion.press.button, haptic: 'light'  as HapticKind | undefined },
  icon:   { scale: motion.press.icon,   haptic: undefined as HapticKind | undefined },
  nav:    { scale: motion.press.nav,    haptic: 'select' as HapticKind | undefined },
};

export type TouchablePreset = keyof typeof PRESETS;

const PressCtx = createContext<SharedValue<number> | null>(null);
export const usePressProgress = () => useContext(PressCtx);

export type TouchableProps = Omit<PressableProps, 'style' | 'children' | 'onPressIn' | 'onPressOut'> & {
  preset?: TouchablePreset;
  haptic?: HapticKind | false;   // override preset default; false = silent
  style?: StyleProp<ViewStyle>;
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
};

export const Touchable = memo(function Touchable({
  preset = 'card',
  haptic,
  style,
  children,
  onPress,
  disabled,
  accessibilityRole,
  ...rest
}: TouchableProps) {
  const p = PRESETS[preset];
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : 1 - progress.value * (1 - p.scale) }],
    opacity: 1 - progress.value * 0.12,
  }));

  const resolvedRole =
    accessibilityRole !== undefined
      ? accessibilityRole
      : preset === 'card' || preset === 'row'
      ? undefined
      : 'button';

  return (
    <PressCtx.Provider value={progress}>
      <APressable
        accessibilityRole={resolvedRole}
        hitSlop={preset === 'icon' || preset === 'nav' ? 8 : undefined}  // >= 44px target
        android_ripple={{ color: colors?.ripple ?? 'rgba(0,0,0,0.08)' }}
        disabled={disabled}
        onPressIn={() => {
          progress.value = withTiming(1, { duration: motion.duration.instant });
        }}
        onPressOut={() => {
          progress.value = withSpring(0, motion.spring.press);
        }}
        onPress={(e) => {
          const h = haptic === undefined ? p.haptic : haptic;
          if (h) haptics[h]();            // fires on release, not on touch-down (no buzz when user starts a scroll)
          onPress?.(e);
        }}
        {...rest}
        style={[style, anim]}
      >
        {children}
      </APressable>
    </PressCtx.Provider>
  );
});
