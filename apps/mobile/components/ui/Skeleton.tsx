/**
 * ServiceCentric Mobile — Native Skeleton Loading Placeholder
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric } from '@servicecentric/design-tokens';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = radiusNumeric.sm,
  style,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.hairlineSoft,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    opacity: 0.6,
    marginVertical: 4,
  },
});
