import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from './ThemeProvider';

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
    Haptics.selectionAsync().catch(() => {});
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

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: isDark ? '#ffffff' : '#0f172a' }]}>
            {label}
            {required && <Text style={{ color: '#ef4444', fontWeight: '700' }}> *</Text>}
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
            {isPasswordVisible ? (
              <EyeOff size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            ) : (
              <Eye size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
            )}
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
        <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.colors.mute }]}>{helperText}</Text>
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
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
    fontSize: 13.5,
    fontWeight: '500',
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  errorText: {
    fontSize: 11.5,
    marginTop: 4,
    fontWeight: '500',
  },
  helperText: {
    fontSize: 11.5,
    marginTop: 4,
  },
});
