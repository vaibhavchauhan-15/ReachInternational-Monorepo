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

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
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
    } else if (variant === 'outline') {
      bg = 'transparent';
      border = theme.colors.hairline;
    } else if (variant === 'ghost') {
      bg = 'transparent';
    } else if (variant === 'danger') {
      bg = theme.colors.error;
    }

    let paddingVertical: number = spacingNumeric.xs;
    let paddingHorizontal: number = spacingNumeric.md;

    if (size === 'sm') {
      paddingVertical = 6;
      paddingHorizontal = spacingNumeric.xs;
    } else if (size === 'lg') {
      paddingVertical = spacingNumeric.md;
      paddingHorizontal = spacingNumeric.lg;
    }

    return {
      backgroundColor: bg,
      borderColor: border,
      borderWidth: variant === 'outline' ? 1 : 0,
      borderRadius: radiusNumeric.md,
      paddingVertical,
      paddingHorizontal,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      opacity: disabled ? 0.5 : 1,
      minHeight: 44,
      minWidth: 44,
      width: fullWidth ? '100%' : 'auto',
    };
  };

  const getTextStyle = (): TextStyle => {
    let color = theme.colors.ink;
    if (variant === 'primary' || variant === 'danger') {
      color = '#ffffff';
    } else if (variant === 'outline' || variant === 'ghost') {
      color = theme.colors.link;
    }

    let fontSize = 14;
    if (size === 'sm') fontSize = 12;
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
      activeOpacity={0.8}
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isLoading }}
      style={[getContainerStyle(), style]}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' ? '#ffffff' : theme.colors.link}
        />
      ) : (
        <Text style={getTextStyle()}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};
