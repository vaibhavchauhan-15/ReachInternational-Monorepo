/**
 * ServiceCentric Mobile — Native Button Primitive
 * Standardized button system with variants (primary, secondary, outline, ghost, danger) & loading spinner.
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@servicecentric/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'pill' | 'square';

export interface ButtonProps {
  label: string;
  onPress: () => void;
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
    let minHeight: number = 44;

    if (size === 'sm') {
      paddingVertical = 6;
      paddingHorizontal = 12;
      minHeight = 34;
    } else if (size === 'lg') {
      paddingVertical = 14;
      paddingHorizontal = spacingNumeric.lg;
      minHeight = 48;
    }

    const borderRadius = shape === 'pill' ? radiusNumeric.pill : radiusNumeric.sm;

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
      opacity: disabled ? 0.5 : 1,
      minHeight,
      minWidth: 44,
      width: fullWidth ? '100%' : 'auto',
    };
  };

  const getTextStyle = (): TextStyle => {
    let color = theme.colors.ink;
    if (variant === 'primary') {
      color = theme.colors.onPrimary;
    } else if (variant === 'danger' || variant === 'success') {
      color = '#ffffff';
    } else if (variant === 'outline' || variant === 'ghost') {
      color = theme.colors.link;
    }

    let fontSize = 14;
    if (size === 'sm') fontSize = 13;
    if (size === 'lg') fontSize = 16;

    return {
      color,
      fontSize,
      fontWeight: '600',
    };
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isLoading }}
      style={[getContainerStyle(), style]}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? theme.colors.onPrimary : theme.colors.link}
        />
      ) : (
        <>
          {icon}
          <Text style={getTextStyle()}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
