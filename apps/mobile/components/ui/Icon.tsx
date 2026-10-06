import React, { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
import {
  iconSize,
  scaled,
  type TypeVariant,
} from '@reachinternational/design-tokens';
import { usePressProgress } from './Touchable';
import { useTypeScale } from '../../lib/typography/TypeScaleProvider';

export interface IconProps {
  as?: React.ComponentType<any>;
  icon?: LucideIcon | React.ComponentType<any>;
  name?: LucideIcon | React.ComponentType<any>;
  level?: keyof typeof iconSize;
  variant?: TypeVariant;
  size?: number;
  anim?: 'pop' | 'nudge' | 'spin' | 'none';
  spinning?: boolean;
  color?: string;
  strokeWidth?: number;
  style?: any;
}

export function Icon({
  as,
  icon,
  name,
  level,
  variant = 'body',
  size: explicitSize,
  anim = 'pop',
  spinning = false,
  color,
  strokeWidth = 2,
  style,
}: IconProps) {
  const Glyph = as || icon || name;
  const press = usePressProgress();
  const spin = useSharedValue(0);
  const reduce = useReducedMotion();
  const { scale } = useTypeScale();

  useEffect(() => {
    if (spinning || anim === 'spin') {
      spin.value = withRepeat(
        withTiming(360, { duration: 900, easing: Easing.linear }),
        -1
      );
    } else {
      spin.value = 0;
    }
  }, [spinning, anim]);

  const s = useAnimatedStyle(() => {
    const p = press?.value ?? 0;
    return {
      transform: [
        { scale: anim === 'pop' && !reduce ? 1 + p * 0.15 : 1 },
        { translateX: anim === 'nudge' && !reduce ? p * 3 : 0 },
        { rotate: `${spin.value}deg` },
      ],
    };
  });

  if (!Glyph) return null;

  const effectiveLevel = level || (variant as keyof typeof iconSize) || 'body';
  const baseSize = explicitSize ?? iconSize[effectiveLevel] ?? 16;
  const computedSize = scaled(baseSize, scale);

  return (
    <Animated.View style={[s, style]}>
      <Glyph size={computedSize} color={color} strokeWidth={strokeWidth} />
    </Animated.View>
  );
}
