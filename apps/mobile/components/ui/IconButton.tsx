/**
 * ReachInternational Mobile — Icon Button Primitive
 * Backed by React Native Reusables Button (variant="ghost", size="icon").
 */

import React, { memo } from 'react';
import { type ViewStyle } from 'react-native';
import { Button } from './Button';
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
  className?: string;
}

export const IconButton = memo(function IconButton({
  icon,
  name,
  onPress,
  accessibilityLabel,
  size = 44,
  iconSize = 20,
  color,
  tone,
  disabled = false,
  style,
  className,
}: IconButtonProps) {
  const content = icon ?? (name ? <Icon name={name} size={iconSize} color={color} tone={tone} /> : null);

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      className={className}
      style={[
        {
          width: size,
          height: size,
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {content}
    </Button>
  );
});

export default IconButton;
