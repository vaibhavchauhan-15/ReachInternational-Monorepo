import { cn } from '@/lib/utils';
import * as React from 'react';
import {
  View,
  Animated,
  Platform,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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

// Module-level shared pulse driver for Native (iOS / Android) to guarantee 60fps in-sync animation
const sharedPulse = new Animated.Value(1);
let pulseStarted = false;

function ensurePulseAnimation() {
  if (pulseStarted || Platform.OS === 'web') return;
  pulseStarted = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(sharedPulse, {
        toValue: 0.45,
        duration: 850,
        useNativeDriver: true,
      }),
      Animated.timing(sharedPulse, {
        toValue: 1,
        duration: 850,
        useNativeDriver: true,
      }),
    ])
  ).start();
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
  const { theme, isDark } = useTheme();

  React.useEffect(() => {
    if (animate && Platform.OS !== 'web') {
      ensurePulseAnimation();
    }
  }, [animate]);

  // Authoritative theme-aware skeleton fill:
  // Dark: #262626 (subtle hairline gray against #171717 card / #0a0a0a canvas)
  // Light: #ebebeb (subtle hairline gray against #ffffff card / #fafafa canvas)
  const defaultBg = isDark ? '#262626' : '#ebebeb';

  const dynamicStyle: ViewStyle = {};
  if (width !== undefined) dynamicStyle.width = width as any;
  if (height !== undefined) dynamicStyle.height = height;
  if (borderRadius !== undefined) dynamicStyle.borderRadius = borderRadius;
  if (variant === 'circle') dynamicStyle.borderRadius = 9999;
  if (variant === 'badge') dynamicStyle.borderRadius = 9999;
  if (variant === 'text' && borderRadius === undefined) dynamicStyle.borderRadius = 4;

  const baseContainerStyle: ViewStyle = {
    backgroundColor: defaultBg,
  };

  if (Platform.OS === 'web') {
    return (
      <View
        className={cn(
          'rounded-md',
          animate && 'animate-pulse',
          variant === 'circle' && 'rounded-full',
          variant === 'badge' && 'rounded-full h-5 w-16',
          variant === 'text' && 'h-4 w-full rounded',
          className
        )}
        style={[baseContainerStyle, dynamicStyle, style]}
        {...props}
      />
    );
  }

  return (
    <Animated.View
      className={cn(
        'rounded-md',
        variant === 'circle' && 'rounded-full',
        variant === 'badge' && 'rounded-full h-5 w-16',
        variant === 'text' && 'h-4 w-full rounded',
        className
      )}
      style={[
        baseContainerStyle,
        dynamicStyle,
        animate && { opacity: sharedPulse },
        style,
      ]}
      {...(props as any)}
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
      style={[
        {
          backgroundColor: theme.colors.canvasElevated,
          borderColor: theme.colors.hairline,
          borderRadius: 16,
          borderWidth: 1,
          padding: 16,
          marginBottom: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export { Skeleton };
export default Skeleton;

