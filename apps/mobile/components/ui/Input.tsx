/**
 * Reach International Mobile — Native Input Primitive
 * Text input with label, required asterisk, left icon, right icon/password toggle, error text, and theme support.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface InputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  isPassword?: boolean;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  required,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  isPassword = false,
  secureTextEntry,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...textInputProps
}) => {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const borderColor = error
    ? theme.colors.error
    : isFocused
    ? '#0ea5e9'
    : isDark
    ? '#292c2f'
    : theme.colors.hairline;

  const effectiveSecureTextEntry = isPassword
    ? !isPasswordVisible
    : secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.colors.ink }]}>
            {label}
            {required && <Text style={{ color: '#ef4444', fontWeight: '700' }}> *</Text>}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: isDark ? '#121212' : theme.colors.canvasElevated,
            borderColor,
          },
          error
            ? { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.06)' : 'rgba(239, 68, 68, 0.04)' }
            : isFocused
            ? { borderColor: '#0ea5e9' }
            : null,
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <TextInput
          placeholderTextColor={isDark ? '#525252' : '#9ca3af'}
          secureTextEntry={effectiveSecureTextEntry}
          style={[
            styles.input,
            {
              color: theme.colors.ink,
            },
            style,
          ]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...textInputProps}
        />

        {isPassword ? (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            hitSlop={8}
            activeOpacity={0.7}
          >
            {isPasswordVisible ? (
              <EyeOff size={16} color={isDark ? '#737373' : '#9ca3af'} />
            ) : (
              <Eye size={16} color={isDark ? '#737373' : '#9ca3af'} />
            )}
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={8}
            activeOpacity={0.7}
          >
            {rightIcon}
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.colors.mute }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacingNumeric.sm + 2,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderWidth: 1,
    borderRadius: radiusNumeric.sm + 2,
    paddingHorizontal: 12,
  },
  leftIconContainer: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconContainer: {
    marginLeft: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    paddingVertical: 0,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
});
