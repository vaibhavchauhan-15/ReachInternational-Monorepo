/**
 * ReachInternational Mobile — React Native Reusables Skeleton Component
 * Official RNR Skeleton primitive with animate-pulse and helper variants.
 */

import { cn } from '@/lib/utils';
import * as React from 'react';
import { View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

export interface SkeletonProps extends ViewProps {
  className?: string;
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  variant?: 'rect' | 'circle' | 'text' | 'badge';
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}

function Skeleton({
  className,
  width,
  height,
  borderRadius,
  variant,
  animate = true,
  style,
  ...props
}: SkeletonProps) {
  const dynamicStyle: ViewStyle = {};
  if (width !== undefined) dynamicStyle.width = width as any;
  if (height !== undefined) dynamicStyle.height = height;
  if (borderRadius !== undefined) dynamicStyle.borderRadius = borderRadius;
  if (variant === 'circle') dynamicStyle.borderRadius = 9999;
  if (variant === 'badge') dynamicStyle.borderRadius = 9999;

  return (
    <View
      className={cn(
        'rounded-md bg-muted',
        animate && 'animate-pulse',
        variant === 'circle' && 'rounded-full',
        variant === 'badge' && 'rounded-full h-5 w-16',
        variant === 'text' && 'h-4 w-full rounded',
        className
      )}
      style={[dynamicStyle, style]}
      {...props}
    />
  );
}

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
          animate={animate}
          variant="text"
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
      animate={animate}
      variant="badge"
      style={style}
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
      className="rounded-xl border border-border bg-card p-4 mb-4"
      style={[{ backgroundColor: theme.colors.canvasElevated, borderColor: theme.colors.hairline }, style]}
    >
      {children}
    </View>
  );
};

export { Skeleton };
export default Skeleton;
