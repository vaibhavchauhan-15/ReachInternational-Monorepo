import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from './ThemeProvider';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  animate?: boolean;
  variant?: 'rect' | 'circle' | 'text' | 'badge';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius,
  style,
  animate = true,
  variant = 'rect',
}) => {
  const { theme } = useTheme();
  const opacityAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!animate) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [animate, opacityAnim]);

  const computedRadius =
    borderRadius !== undefined
      ? borderRadius
      : variant === 'circle'
      ? 9999
      : variant === 'badge'
      ? 9999
      : variant === 'text'
      ? radiusNumeric.xs
      : radiusNumeric.sm;

  const computedHeight =
    height !== undefined
      ? height
      : variant === 'circle' && typeof width === 'number'
      ? width
      : variant === 'badge'
      ? 22
      : variant === 'text'
      ? 14
      : 20;

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height: computedHeight,
          borderRadius: computedRadius,
          backgroundColor: theme.colors.hairlineSoft,
          opacity: animate ? opacityAnim : 0.6,
        },
        style,
      ]}
    />
  );
};

export interface SkeletonTextProps {
  lines?: number;
  barHeight?: number;
  widths?: (number | `${number}%`)[];
  gap?: number;
  animate?: boolean;
  style?: ViewStyle;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 2,
  barHeight = 14,
  widths = ['100%', '75%'],
  gap = 6,
  animate = true,
  style,
}) => {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          width={widths[idx % widths.length] || '100%'}
          height={barHeight}
          borderRadius={radiusNumeric.xs}
          animate={animate}
          variant="text"
          style={styles.noMargin}
        />
      ))}
    </View>
  );
};

export interface SkeletonBadgeProps {
  width?: number | `${number}%`;
  height?: number;
  animate?: boolean;
  style?: ViewStyle;
}

export const SkeletonBadge: React.FC<SkeletonBadgeProps> = ({
  width = 64,
  height = 22,
  animate = true,
  style,
}) => {
  return (
    <Skeleton
      width={width}
      height={height}
      borderRadius={9999}
      animate={animate}
      variant="badge"
      style={[styles.noMargin, style]}
    />
  );
};

export interface SkeletonCardProps {
  children?: React.ReactNode;
  animate?: boolean;
  style?: ViewStyle;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  children,
  style,
}) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.cardShell,
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    marginVertical: 4,
  },
  noMargin: {
    marginVertical: 0,
  },
  cardShell: {
    borderRadius: radiusNumeric.lg,
    borderWidth: 1,
    padding: spacingNumeric.md,
    marginBottom: spacingNumeric.md,
  },
});
