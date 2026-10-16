/**
 * ReachInternational Mobile — Icon Button Primitive
 * Backed by React Native Reusables Button (variant="ghost", size="icon").
 */

import React, { memo } from 'react';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { Icon, type IconName, type IconTone } from './icon';
import { useTheme } from './ThemeProvider';
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
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
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
  haptic,
  disabled = false,
  style,
  className,
}: IconButtonProps) {
  const { isDark } = useTheme();
  const content = icon ?? (name ? <Icon name={name} size={iconSize} color={color} tone={tone} /> : null);

  return (
    <Button
      variant="ghost"
      size="icon"
      haptic={haptic}
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      className={className}
      style={(state) => [
        {
          width: size,
          height: size,
          minWidth: 44,
          minHeight: 44,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: state.pressed
            ? isDark
              ? 'rgba(255, 255, 255, 0.12)'
              : 'rgba(23, 23, 23, 0.08)'
            : 'transparent',
          ...Platform.select({
            web: {
              transition: 'background-color 150ms ease, opacity 150ms ease',
            } as any,
            default: {},
          }),
        },
        typeof style === 'function' ? (style as any)(state) : style,
      ]}
    >
      {content}
    </Button>
  );
});

export default IconButton;
