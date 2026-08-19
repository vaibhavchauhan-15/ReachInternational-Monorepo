/**
 * ServiceCentric Mobile — Native Input Primitive
 * Text input with label, error text, helper text, and theme support.
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet, type TextInputProps, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@servicecentric/design-tokens';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  containerStyle,
  style,
  ...textInputProps
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: theme.colors.body }]}>{label}</Text>}
      <TextInput
        placeholderTextColor={theme.colors.faint}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.canvasElevated,
            borderColor: error ? theme.colors.error : theme.colors.hairline,
            color: theme.colors.ink,
          },
          style,
        ]}
        {...textInputProps}
      />
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
    marginBottom: spacingNumeric.sm,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacingNumeric.xxs,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: radiusNumeric.md,
    paddingHorizontal: spacingNumeric.sm,
    fontSize: 15,
  },
  errorText: {
    fontSize: 12,
    marginTop: spacingNumeric.xxs,
  },
  helperText: {
    fontSize: 12,
    marginTop: spacingNumeric.xxs,
  },
});
