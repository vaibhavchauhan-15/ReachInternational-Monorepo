/**
 * ServiceCentric Mobile — EmptyState & ErrorState Primitives
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { Button } from './Button';
import { spacingNumeric, radiusNumeric } from '@reachinternational/design-tokens';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  style,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }, style]}>
      <Text variant="heading" style={[styles.title, { color: theme.colors.ink }]}>{title}</Text>
      {description && <Text variant="body" style={[styles.description, { color: theme.colors.mute }]}>{description}</Text>}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} variant="outline" size="sm" style={styles.actionBtn} />
      )}
    </View>
  );
};

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Failed to load data. Please try again.',
  onRetry,
  style,
}) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.error + '44' }, style]}>
      <Text variant="heading" style={[styles.title, { color: theme.colors.error }]}>Something Went Wrong</Text>
      <Text variant="body" style={[styles.description, { color: theme.colors.body }]}>{message}</Text>
      {onRetry && (
        <Button label="Retry" onPress={onRetry} variant="danger" size="sm" style={styles.actionBtn} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacingNumeric.lg,
    borderRadius: radiusNumeric.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacingNumeric.md,
    width: '100%',
  },
  title: {
    textAlign: 'center',
    marginBottom: spacingNumeric.xxs,
  },
  description: {
    textAlign: 'center',
    marginBottom: spacingNumeric.sm,
  },
  actionBtn: {
    marginTop: spacingNumeric.xs,
  },
});
