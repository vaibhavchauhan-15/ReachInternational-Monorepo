/**
 * ReachInternational Mobile — React Native Reusables Badge Component
 * Official RNR Badge primitive powered by class-variance-authority and TextClassContext.
 */

import * as Slot from '@rn-primitives/slot';
import type { SlottableTextProps, TextRef } from '@rn-primitives/types';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { Text, TextClassContext } from '@/components/ui/Text';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex flex-row items-center rounded-full border web:transition-colors web:focus:outline-none web:focus:ring-2 web:focus:ring-ring web:focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary',
        secondary: 'border-transparent bg-secondary',
        destructive: 'border-transparent bg-destructive',
        error: 'border-rose-500/20 bg-rose-500/10',
        info: 'border-sky-500/20 bg-sky-500/10',
        outline: 'border-border text-foreground',
        success: 'border-emerald-500/20 bg-emerald-500/10',
        warning: 'border-amber-500/20 bg-amber-500/10',
        neutral: 'border-border bg-muted',
      },
      size: {
        sm: 'px-2 py-0',
        md: 'px-2.5 py-0.5',
        lg: 'px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const badgeTextVariants = cva('font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      error: 'text-rose-700 dark:text-rose-400',
      info: 'text-sky-700 dark:text-sky-400',
      outline: 'text-foreground',
      success: 'text-emerald-700 dark:text-emerald-400',
      warning: 'text-amber-700 dark:text-amber-400',
      neutral: 'text-muted-foreground',
    },
    size: {
      sm: 'text-[10px]',
      md: 'text-xs',
      lg: 'text-sm',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export type BadgeProps = ViewProps &
  VariantProps<typeof badgeVariants> & {
    className?: string;
    textClassName?: string;
    label?: string;
    customLabel?: string;
    status?: string;
    size?: 'sm' | 'md' | 'lg';
    dot?: boolean;
    style?: StyleProp<ViewStyle>;
  };

const STATUS_VARIANT_MAP: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'neutral' | 'error' | 'info'> = {
  active: 'success',
  completed: 'success',
  verified: 'success',
  running: 'success',
  present: 'success',
  pending: 'warning',
  warning: 'warning',
  paused: 'warning',
  in_progress: 'warning',
  half_day: 'warning',
  inactive: 'neutral',
  archived: 'neutral',
  rest_day: 'neutral',
  week_off: 'neutral',
  error: 'error',
  failed: 'error',
  rejected: 'error',
  stopped: 'error',
  maintenance: 'error',
  breakdown: 'error',
  absent: 'error',
  destructive: 'destructive',
  info: 'info',
  draft: 'neutral',
};

const Badge: React.ForwardRefExoticComponent<BadgeProps & React.RefAttributes<View>> = React.forwardRef(
  (
    {
      className,
      textClassName,
      variant,
      size = 'md',
      status,
      label,
      customLabel,
      dot = false,
      children,
      style,
      ...props
    }: BadgeProps,
    ref
  ) => {
    let effectiveVariant = variant ?? 'default';
    if (!variant && status && STATUS_VARIANT_MAP[status]) {
      effectiveVariant = STATUS_VARIANT_MAP[status];
    }

    const displayText = customLabel || label;

    return (
      <TextClassContext.Provider
        value={cn(badgeTextVariants({ variant: effectiveVariant, size }), textClassName)}
      >
        <View
          ref={ref}
          className={cn(badgeVariants({ variant: effectiveVariant, size }), className)}
          style={style}
          {...props}
        >
          {dot && (
            <View
              className={cn(
                'h-1.5 w-1.5 rounded-full mr-1.5',
                effectiveVariant === 'success' && 'bg-emerald-500',
                effectiveVariant === 'warning' && 'bg-amber-500',
                effectiveVariant === 'destructive' && 'bg-destructive',
                effectiveVariant === 'error' && 'bg-rose-500',
                effectiveVariant === 'info' && 'bg-sky-500',
                effectiveVariant === 'default' && 'bg-primary-foreground',
                effectiveVariant === 'neutral' && 'bg-muted-foreground',
                effectiveVariant === 'outline' && 'bg-foreground'
              )}
            />
          )}
          {displayText ? <Text>{displayText}</Text> : children}
        </View>
      </TextClassContext.Provider>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants, badgeTextVariants };
export default Badge;
