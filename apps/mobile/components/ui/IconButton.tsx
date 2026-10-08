/**
 * ReachInternational Mobile — Canonical Icon Button Primitive
 * Borderless ripple, radius 24, minimum 48dp touch target, optional tap haptics,
 * and automatic pressNudge spring feedback on the child icon.
 */

import React, { memo } from 'react';
import { type ViewStyle } from 'react-native';
import { Pressable } from './touch/Pressable';
import { Icon, type IconName, type IconTone } from './icon';
import type { SemanticHapticKind } from '../../lib/haptics';

export interface IconButtonProps {
  /** ReactNode icon or omit to use the name prop */
  icon?: React.ReactNode;
  /** Icon name from the canonical icon registry */
  name?: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  radius?: number;
  iconSize?: number;
  color?: string;
  tone?: IconTone;
  haptic?: SemanticHapticKind | false;
  disabled?: boolean;
  style?: ViewStyle;
}

export const IconButton = memo(function IconButton({
  icon,
  name,
  onPress,
  accessibilityLabel,
  size = 40,
  radius = 24,
  iconSize = 20,
  color,
  tone,
  haptic,
  disabled = false,
  style,
}: IconButtonProps) {
  const content = icon ?? (name ? <Icon name={name} size={iconSize} color={color} tone={tone} animate="press" /> : null);

  return (
    <Pressable
      variant="iconButton"
      haptic={haptic}
      rippleRadius={radius}
      hitSlopToMin48={true}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
});

export default IconButton;
