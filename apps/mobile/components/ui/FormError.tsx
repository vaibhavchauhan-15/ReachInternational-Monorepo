/**
 * ReachInternational Mobile — FormError Primitive
 * 
 * Standardized inline field validation message with warning/error icon,
 * Geist Design System token coloring, and 0 raw typography property adherence.
 */

import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Text } from './Text';
import { AlertCircle } from './icon';

export interface FormErrorProps {
  message?: string | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const FormError: React.FC<FormErrorProps> = ({
  message,
  style,
  testID = 'form-field-error',
}) => {
  const { theme } = useTheme();

  if (!message) return null;

  return (
    <View
      style={[styles.errorRow, style]}
      accessibilityRole="alert"
      accessibilityLabel={message}
      testID={testID}
    >
      <AlertCircle size={12} color={theme.colors.error} style={styles.errorIcon} />
      <Text
        variant="caption"
        style={[styles.errorText, { color: theme.colors.error }]}
        numberOfLines={2}
      >
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  errorIcon: {
    flexShrink: 0,
  },
  errorText: {
    flex: 1,
  },
});

export default FormError;
