/**
 * ReachInternational Mobile — Native Button Primitive
 * Standardized button system with variants (primary, secondary, outline, ghost, danger, success),
 * Android RenderThread native ripple, 0.98 spring scale, and 48dp minimum touch target.
 */

import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric, type TypeVariant } from '@reachinternational/design-tokens';
import { InteractiveIcon } from './InteractiveIcon';
import { Text } from './Text';
import { Pressable } from './touch/Pressable';
import type { TouchVariant } from './touch/feedback';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'pill' | 'square';

export interface ButtonProps {
  label: string;
  onPress?: () => void | Promise<any>;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  icon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  shape = 'pill',
  icon,
  isLoading = false,
  disabled = false,
  fullWidth = false,
  style,
}) => {
  const { theme } = useTheme();

  const [internalLoading, setInternalLoading] = useState(false);
  const isExecutingRef = useRef(false);

  const effectiveLoading = Boolean(isLoading || internalLoading);

  const handlePress = async () => {
    if (disabled || effectiveLoading || isExecutingRef.current) return;
    if (!onPress) return;

    try {
      const result: unknown = (onPress as () => unknown)();
      if (result && typeof (result as { then?: unknown }).then === 'function') {
        isExecutingRef.current = true;
        setInternalLoading(true);
        await (result as Promise<unknown>);
      }
    } finally {
      isExecutingRef.current = false;
      setInternalLoading(false);
    }
  };

  const getContainerStyle = (): ViewStyle => {
    let bg = theme.colors.primary;
    let border = 'transparent';

    if (variant === 'secondary') {
      bg = theme.colors.hairlineSoft;
      border = theme.colors.hairline;
    } else if (variant === 'outline') {
      bg = 'transparent';
      border = theme.colors.hairline;
    } else if (variant === 'ghost') {
      bg = 'transparent';
    } else if (variant === 'danger') {
      bg = theme.colors.error;
    } else if (variant === 'success') {
      bg = theme.colors.success;
    }

    let paddingVertical: number = 10;
    let paddingHorizontal: number = spacingNumeric.md;
    // Android 48dp minimum target (M3 standard)
    let minHeight: number = 48;

    if (size === 'sm') {
      paddingVertical = 6;
      paddingHorizontal = 12;
      minHeight = 36;
    } else if (size === 'lg') {
      paddingVertical = 14;
      paddingHorizontal = spacingNumeric.lg;
      minHeight = 52;
    }

    const borderRadius = shape === 'pill' ? radiusNumeric.pill : radiusNumeric.md;

    return {
      backgroundColor: bg,
      borderColor: border,
      borderWidth: variant === 'outline' || variant === 'secondary' ? 1 : 0,
      borderRadius,
      paddingVertical,
      paddingHorizontal,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 6,
      minHeight,
      minWidth: 48,
      width: fullWidth ? '100%' : 'auto',
      overflow: 'hidden',
    };
  };

  const getTextStyle = (): { color: string } => {
    let color = theme.colors.ink;
    if (variant === 'primary') {
      color = theme.colors.onPrimary;
    } else if (variant === 'danger' || variant === 'success') {
      color = '#ffffff';
    } else if (variant === 'outline' || variant === 'ghost') {
      color = theme.colors.link;
    }

    return { color };
  };

  const textVariant: TypeVariant = size === 'sm' ? 'caption' : size === 'lg' ? 'subheading' : 'label';

  const touchVariant: TouchVariant =
    variant === 'primary'
      ? 'buttonPrimary'
      : variant === 'danger'
      ? 'buttonDanger'
      : variant === 'outline'
      ? 'buttonOutline'
      : variant === 'ghost'
      ? 'buttonGhost'
      : 'buttonSecondary';

  const borderRadius = shape === 'pill' ? radiusNumeric.pill : radiusNumeric.md;

  return (
    <Pressable
      variant={touchVariant}
      haptic={false} // Buttons don't buzz on raw touch; confirm/reject come from result
      rippleRadius={borderRadius}
      hitSlopToMin48={true}
      onPress={handlePress}
      disabled={disabled}
      loading={effectiveLoading}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={[getContainerStyle(), style]}
    >
      {({ pressed }) =>
        effectiveLoading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? theme.colors.onPrimary : theme.colors.link}
          />
        ) : (
          <>
            {icon ? (
              <InteractiveIcon
                icon={icon}
                pressed={pressed && !disabled && !effectiveLoading}
                variant="bounce"
              />
            ) : null}
            <Text variant={textVariant} style={getTextStyle()}>
              {label}
            </Text>
          </>
        )
      }
    </Pressable>
  );
};
