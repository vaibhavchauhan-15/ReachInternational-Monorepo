/**
 * ReachInternational Mobile — EmptyState & ErrorState Primitives
 * Powered by React Native Reusables Card, Text, and Button.
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  style,
  icon,
}) => {
  return (
    <Card
      className="items-center justify-center p-6 my-4 w-full text-center"
      style={style}
    >
      {icon ? <View className="mb-3 items-center justify-center">{icon}</View> : null}
      <Text variant="heading" className="text-center font-semibold text-lg text-foreground mb-1">
        {title}
      </Text>
      {description ? (
        <Text variant="body" className="text-center text-sm text-muted-foreground mb-4">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          variant="outline"
          size="sm"
          onPress={onAction}
          label={actionLabel}
          className="mt-1"
        />
      ) : null}
    </Card>
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
  return (
    <Card
      className="items-center justify-center p-6 my-4 w-full border-destructive/30 bg-destructive/5 text-center"
      style={style}
    >
      <Text variant="heading" className="text-center font-semibold text-lg text-destructive mb-1">
        Something Went Wrong
      </Text>
      <Text variant="body" className="text-center text-sm text-muted-foreground mb-4">
        {message}
      </Text>
      {onRetry ? (
        <Button
          variant="destructive"
          size="sm"
          onPress={onRetry}
          label="Retry"
          className="mt-1"
        />
      ) : null}
    </Card>
  );
};

export default EmptyState;
