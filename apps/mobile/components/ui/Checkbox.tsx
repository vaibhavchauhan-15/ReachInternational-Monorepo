/**
 * ReachInternational Mobile — Standardized Checkbox Primitive
 * Features check animation, semantic toggle haptics, and 48dp touch target.
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Check } from './icon';
import { motion, radiusNumeric } from '@reachinternational/design-tokens';
import { useTheme } from './ThemeProvider';
import { haptics } from '../../lib/haptics';
import { Pressable } from './touch/Pressable';

export interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  size?: number;
  style?: ViewStyle;
}

export const Checkbox = memo(function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  accessibilityLabel = 'Checkbox',
  size = 20,
  style,
}: CheckboxProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(checked ? 1 : 0, motion.spring.default);
  }, [checked, scale]);

  const handlePress = () => {
    if (disabled) return;
    const nextChecked = !checked;
    haptics.toggle(nextChecked);
    onCheckedChange(nextChecked);
  };

  const checkAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const activeColor = theme.colors.primary;
  const inactiveBorder = isDark ? '#383838' : '#d4d4d4';
  const inactiveBg = isDark ? '#171717' : '#ffffff';

  return (
    <Pressable
      variant="toggle"
      haptic={false}
      hitSlopToMin48={true}
      disabled={disabled}
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.hitBox, style]}
    >
      <View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: radiusNumeric.sm,
            borderColor: checked ? activeColor : inactiveBorder,
            backgroundColor: checked ? activeColor : inactiveBg,
          },
        ]}
      >
        <Animated.View style={checkAnim}>
          <Check size={size - 6} color="#ffffff" strokeWidth={3} />
        </Animated.View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hitBox: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Checkbox;
