import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from './ThemeProvider';
import { Text, useTypeStyle } from './Text';
import { Icon } from './Icon';
import { haptics } from '../../lib/interaction/haptics';

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

  const handleTogglePassword = () => {
    haptics.select();
    setIsPasswordVisible((prev) => !prev);
  };

  const effectiveSecureTextEntry = isPassword
    ? !isPasswordVisible
    : secureTextEntry;

  const inputBg = isDark
    ? '#121212'
    : '#fafafa';

  const borderColor = error
    ? '#ef4444'
    : isFocused
    ? (isDark ? '#38bdf8' : '#0284c7')
    : (isDark ? '#262626' : '#ebebeb');

  const inputTypeStyle = useTypeStyle('body');

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="label" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
            {label}
            {required && <Text variant="label" style={{ color: '#ef4444' }}> *</Text>}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: error
              ? (isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.04)')
              : inputBg,
            borderColor,
            borderWidth: isFocused || error ? 1.5 : 1,
          },
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <TextInput
          placeholderTextColor={isDark ? '#71717a' : '#9ca3af'}
          secureTextEntry={effectiveSecureTextEntry}
          style={[
            styles.input,
            inputTypeStyle,
            {
              color: isDark ? '#f8fafc' : '#0f172a',
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
            onPress={handleTogglePassword}
            hitSlop={12}
            activeOpacity={0.7}
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <Icon
              icon={isPasswordVisible ? EyeOff : Eye}
              variant="body"
              color={isDark ? '#9ca3af' : '#6b7280'}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={12}
            activeOpacity={0.7}
          >
            {rightIcon}
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text variant="caption" style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
      ) : helperText ? (
        <Text variant="caption" style={[styles.helperText, { color: theme.colors.mute }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
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
    paddingVertical: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  errorText: {
    marginTop: 4,
  },
  helperText: {
    marginTop: 4,
  },
});
