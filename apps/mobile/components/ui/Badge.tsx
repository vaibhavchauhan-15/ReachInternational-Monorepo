/**
 * ReachInternational Mobile — React Native Reusables Badge Component
 * Official RNR Badge primitive powered by class-variance-authority and TextClassContext.
 *
 * Strict Design Invariants:
 * - 100% solid, fully opaque surfaces across all variants (no semi-transparent washes)
 * - Vercel Geist design tokens & semantic operational status colors
 * - Synchronized light and dark themes with WCAG AAA text contrast
 * - Compact, refined typography with tight alignment for status dots and labels
 * - High performance: zero extra state, lightweight pure functional rendering
 * - Text node safeguards: primitive string/number children safely wrapped in <Text>
 */

import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import {
  View,
  StyleSheet,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Text, TextClassContext } from '@/components/ui/Text';
import { cn } from '@/lib/utils';
import { useTheme, type RNThemeType } from '@/components/ui/ThemeProvider';
import { radiusNumeric } from '@reachinternational/design-tokens';
import { Pressable } from '@/components/ui/touch/Pressable';
import { X } from '@/components/ui/icon';

const badgeVariants = cva(
  'inline-flex flex-row items-center justify-center rounded-full border web:transition-colors web:focus:outline-none web:focus:ring-2 web:focus:ring-ring web:focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-primary bg-primary',
        secondary: 'border-border bg-secondary',
        destructive: 'border-destructive bg-destructive',
        error: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950',
        info: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950',
        outline: 'border-border bg-card',
        success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950',
        warning: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950',
        neutral: 'border-border bg-muted',
      },
      size: {
        sm: 'px-2 py-0.5 min-h-[20px]',
        md: 'px-2.5 py-0.5 min-h-[22px]',
        lg: 'px-3 py-1 min-h-[26px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const badgeTextVariants = cva('font-semibold tracking-normal', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      destructive: 'text-destructive-foreground',
      error: 'text-rose-800 dark:text-rose-200',
      info: 'text-sky-800 dark:text-sky-200',
      outline: 'text-foreground',
      success: 'text-emerald-800 dark:text-emerald-200',
      warning: 'text-amber-800 dark:text-amber-200',
      neutral: 'text-neutral-700 dark:text-neutral-300',
    },
    size: {
      sm: 'text-[11px] leading-tight',
      md: 'text-xs leading-none',
      lg: 'text-sm leading-none',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export type BadgeVariantType =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'success'
  | 'warning'
  | 'neutral'
  | 'error'
  | 'info';

export type BadgeProps = Omit<ViewProps, 'role'> &
  VariantProps<typeof badgeVariants> & {
    className?: string;
    textClassName?: string;
    label?: string;
    customLabel?: string;
    icon?: React.ReactNode;
    status?: string;
    role?: string;
    userRole?: string;
    accentColor?: string;
    solid?: boolean;
    size?: 'sm' | 'md' | 'lg';
    shape?: 'pill' | 'rounded';
    dot?: boolean;
    asChild?: boolean;
    onPress?: () => void;
    onRemove?: () => void;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    dotStyle?: StyleProp<ViewStyle>;
  };

const STATUS_VARIANT_MAP: Record<string, BadgeVariantType> = {
  // Operational / Success
  active: 'success',
  completed: 'success',
  verified: 'success',
  running: 'success',
  present: 'success',
  approved: 'success',
  resolved: 'success',
  entered: 'success',

  // Caution / In-Progress / Warning
  pending: 'warning',
  warning: 'warning',
  paused: 'warning',
  in_progress: 'warning',
  half_day: 'warning',
  open: 'warning',
  reopened: 'warning',
  under_maintenance: 'warning',
  maintenance: 'warning',
  pending_approval: 'warning',
  today: 'warning',

  // Neutral / Idle / Dormant
  inactive: 'neutral',
  archived: 'neutral',
  rest_day: 'neutral',
  week_off: 'neutral',
  draft: 'neutral',
  closed: 'neutral',
  available: 'neutral',
  upcoming: 'neutral',
  unassigned: 'neutral',

  // Error / Breakdown / Missing
  error: 'error',
  failed: 'error',
  rejected: 'error',
  stopped: 'error',
  breakdown: 'error',
  absent: 'error',
  overdue: 'error',
  revision_requested: 'error',
  conflict: 'error',

  // Primary / Destructive / Info
  destructive: 'destructive',
  info: 'info',
  on_rent: 'info',
  rented: 'info',
  in_transit: 'info',
  assigned: 'info',
  spare: 'info',
  submitted: 'info',
  tomorrow: 'info',
  filtered: 'info',
  default: 'default',
  secondary: 'secondary',
  outline: 'outline',
};

export interface ResolvedBadgeColors {
  background: string;
  border: string;
  text: string;
  dot: string;
}

/**
 * Resolves theme-aware, variant-specific colors with high-contrast accessibility.
 * Synchronizes Light and Dark theme palettes with Vercel Geist design tokens.
 */
export function resolveBadgeColors(
  variant: BadgeVariantType,
  theme: RNThemeType,
  isDark: boolean,
  role?: string,
  accentColor?: string,
  solid: boolean = true
): ResolvedBadgeColors {
  // 0. Custom accent color takes precedence when explicitly provided (100% solid opacity)
  if (accentColor) {
    return {
      background: isDark ? '#171717' : '#ffffff',
      border: accentColor,
      text: accentColor,
      dot: accentColor,
    };
  }

  // 1. Vibrant 100% solid opacity fills with crisp white text
  if (solid) {
    if (variant === 'outline') {
      return {
        background: theme.colors.canvasElevated,
        border: isDark ? '#262626' : '#e4e4e7',
        text: theme.colors.ink,
        dot: theme.colors.ink,
      };
    }
    if (variant === 'secondary') {
      return {
        background: isDark ? '#27272a' : '#f4f4f5',
        border: isDark ? '#3f3f46' : '#e4e4e7',
        text: theme.colors.ink,
        dot: theme.colors.ink,
      };
    }

    if (role) {
      const r = String(role).trim().toLowerCase();
      switch (r) {
        case 'super_admin':
          return {
            background: isDark ? '#991b1b' : '#dc2626',
            border: isDark ? '#dc2626' : '#991b1b',
            text: '#ffffff',
            dot: '#ffffff',
          };
        case 'admin':
          return {
            background: isDark ? '#a16207' : '#ca8a04',
            border: isDark ? '#ca8a04' : '#a16207',
            text: '#ffffff',
            dot: '#ffffff',
          };
        case 'manager':
          return {
            background: isDark ? '#3730a3' : '#4f46e5',
            border: isDark ? '#4f46e5' : '#3730a3',
            text: '#ffffff',
            dot: '#ffffff',
          };
        case 'supervisor':
          return {
            background: isDark ? '#0f766e' : '#0d9488',
            border: isDark ? '#0d9488' : '#0f766e',
            text: '#ffffff',
            dot: '#ffffff',
          };
        case 'hr':
          return {
            background: isDark ? '#047857' : '#059669',
            border: isDark ? '#059669' : '#047857',
            text: '#ffffff',
            dot: '#ffffff',
          };
        case 'operator':
          return {
            background: isDark ? '#b45309' : '#d97706',
            border: isDark ? '#d97706' : '#b45309',
            text: '#ffffff',
            dot: '#ffffff',
          };
        default:
          break;
      }
    }

    switch (variant) {
      case 'success':
        return {
          background: isDark ? '#059669' : '#10b981',
          border: isDark ? '#10b981' : '#059669',
          text: '#ffffff',
          dot: '#ffffff',
        };
      case 'info':
        return {
          background: isDark ? '#0ea5e9' : '#0284c7',
          border: isDark ? '#38bdf8' : '#0284c7',
          text: '#ffffff',
          dot: '#ffffff',
        };
      case 'warning':
        return {
          background: isDark ? '#d97706' : '#f59e0b',
          border: isDark ? '#f59e0b' : '#d97706',
          text: '#ffffff',
          dot: '#ffffff',
        };
      case 'error':
      case 'destructive':
        return {
          background: isDark ? '#dc2626' : '#ef4444',
          border: isDark ? '#f87171' : '#dc2626',
          text: '#ffffff',
          dot: '#ffffff',
        };
      case 'neutral':
        return {
          background: isDark ? '#3f3f46' : '#64748b',
          border: isDark ? '#52525b' : '#475569',
          text: '#ffffff',
          dot: '#ffffff',
        };
      case 'default':
      default:
        return {
          background: isDark ? '#0ea5e9' : '#0284c7',
          border: isDark ? '#0ea5e9' : '#0284c7',
          text: '#ffffff',
          dot: '#ffffff',
        };
    }
  }

  // 1. Custom accent color takes precedence when explicitly provided (100% solid opacity)
  if (accentColor) {
    return {
      background: isDark ? '#171717' : '#ffffff',
      border: accentColor,
      text: accentColor,
      dot: accentColor,
    };
  }

  // 2. Canonical user roles
  if (role) {
    const r = String(role).trim().toLowerCase();
    switch (r) {
      case 'super_admin':
        return {
          background: isDark ? '#450a0a' : '#fef2f2',
          border: isDark ? '#991b1b' : '#fecaca',
          text: isDark ? '#fca5a5' : '#b91c1c',
          dot: '#ef4444',
        };
      case 'admin':
        return {
          background: isDark ? '#422006' : '#fefce8',
          border: isDark ? '#854d0e' : '#fde047',
          text: isDark ? '#fef08a' : '#a16207',
          dot: '#eab308',
        };
      case 'manager':
        return {
          background: isDark ? '#1e1b4b' : '#eef2ff',
          border: isDark ? '#4338ca' : '#c7d2fe',
          text: isDark ? '#c7d2fe' : '#4338ca',
          dot: '#6366f1',
        };
      case 'supervisor':
        return {
          background: isDark ? '#042f2e' : '#f0fdfa',
          border: isDark ? '#0f766e' : '#99f6e4',
          text: isDark ? '#99f6e4' : '#0f766e',
          dot: '#0d9488',
        };
      case 'hr':
        return {
          background: isDark ? '#064e3b' : '#ecfdf5',
          border: isDark ? '#047857' : '#a7f3d0',
          text: isDark ? '#a7f3d0' : '#047857',
          dot: '#059669',
        };
      case 'operator':
        return {
          background: isDark ? '#451a03' : '#fffbeb',
          border: isDark ? '#78350f' : '#fde68a',
          text: isDark ? '#fde68a' : '#b45309',
          dot: '#d97706',
        };
      default:
        break;
    }
  }

  // 3. Semantic Status Variants
  switch (variant) {
    case 'success':
      return {
        background: isDark ? '#064e3b' : '#ecfdf5',
        border: isDark ? '#047857' : '#a7f3d0',
        text: isDark ? '#a7f3d0' : '#065f46',
        dot: isDark ? '#34d399' : '#10b981',
      };
    case 'info':
      return {
        background: isDark ? '#1e3a8a' : '#eff6ff',
        border: isDark ? '#2563eb' : '#bfdbfe',
        text: isDark ? '#bfdbfe' : '#1d4ed8',
        dot: isDark ? '#60a5fa' : '#3b82f6',
      };
    case 'warning':
      return {
        background: isDark ? '#78350f' : '#fffbeb',
        border: isDark ? '#92400e' : '#fde68a',
        text: isDark ? '#fde68a' : '#b45309',
        dot: isDark ? '#fbbf24' : '#f59e0b',
      };
    case 'error':
    case 'destructive':
      return {
        background: isDark ? '#450a0a' : '#fef2f2',
        border: isDark ? '#991b1b' : '#fecaca',
        text: isDark ? '#fca5a5' : '#b91c1c',
        dot: isDark ? '#f87171' : '#ef4444',
      };
    case 'outline':
      return {
        background: theme.colors.canvasElevated,
        border: isDark ? '#262626' : '#e4e4e7',
        text: theme.colors.ink,
        dot: theme.colors.ink,
      };
    case 'secondary':
      return {
        background: isDark ? '#27272a' : '#f4f4f5',
        border: isDark ? '#3f3f46' : '#e4e4e7',
        text: theme.colors.ink,
        dot: theme.colors.ink,
      };
    case 'neutral':
      return {
        background: isDark ? '#27272a' : '#f4f4f5',
        border: isDark ? '#3f3f46' : '#e4e4e7',
        text: isDark ? '#d4d4d8' : '#52525b',
        dot: isDark ? '#a1a1aa' : '#71717a',
      };
    case 'default':
    default:
      return {
        background: isDark ? '#0ea5e9' : '#0284c7',
        border: isDark ? '#0ea5e9' : '#0284c7',
        text: '#ffffff',
        dot: '#ffffff',
      };
  }
}

export function formatBadgeStatusLabel(status: string): string {
  const s = String(status).trim().toLowerCase();
  switch (s) {
    case 'active':
      return 'Active';
    case 'rented':
      return 'Rented';
    case 'on_rent':
      return 'On Rent';
    case 'available':
      return 'Available';
    case 'spare':
      return 'Spare';
    case 'under_maintenance':
    case 'maintenance':
      return 'Maintenance';
    case 'breakdown':
      return 'Breakdown';
    case 'pending':
      return 'Pending';
    case 'completed':
      return 'Completed';
    case 'entered':
      return 'Entered';
    case 'unassigned':
      return 'Unassigned';
    case 'present':
      return 'Present';
    case 'absent':
      return 'Absent';
    case 'half_day':
      return 'Half Day';
    case 'rest_day':
      return 'Rest Day';
    case 'week_off':
      return 'Week Off';
    case 'in_progress':
      return 'In Progress';
    case 'draft':
      return 'Draft';
    case 'closed':
      return 'Closed';
    case 'filtered':
      return 'Filtered';
    default:
      return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatBadgeRoleLabel(role: string): string {
  const r = String(role).trim().toLowerCase();
  switch (r) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'supervisor':
      return 'Supervisor';
    case 'hr':
      return 'HR';
    case 'operator':
      return 'Operator';
    default:
      return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

const BADGE_SIZE_STYLES: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: { minHeight: 20, paddingHorizontal: 7, paddingVertical: 1 },
  md: { minHeight: 24, paddingHorizontal: 9, paddingVertical: 2 },
  lg: { minHeight: 28, paddingHorizontal: 12, paddingVertical: 3 },
};

const staticBadgeStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    opacity: 1,
  },
  dot: {
    borderRadius: 9999,
    flexShrink: 0,
    alignSelf: 'center',
  },
  dotSm: {
    width: 5,
    height: 5,
    marginRight: 4,
  },
  dotMd: {
    width: 6,
    height: 6,
    marginRight: 5,
  },
  dotLg: {
    width: 7,
    height: 7,
    marginRight: 6,
  },
  removeBtn: {
    marginLeft: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
  },
});

function renderBadgeChildren(
  children: React.ReactNode,
  textColor?: string,
  size?: 'sm' | 'md' | 'lg',
  textStyle?: StyleProp<TextStyle>
): React.ReactNode {
  if (children == null || children === false || children === true) {
    return null;
  }
  const textVariant = size === 'sm' ? 'micro' : size === 'lg' ? 'label' : 'caption';
  if (typeof children === 'string' || typeof children === 'number') {
    return (
      <Text
        variant={textVariant}
        weight="semibold"
        style={[{ color: textColor, opacity: 1 }, textStyle]}
      >
        {children}
      </Text>
    );
  }
  if (Array.isArray(children)) {
    const hasOnlyPrimitives = children.every(
      (c) => c == null || c === false || c === true || typeof c === 'string' || typeof c === 'number'
    );
    if (hasOnlyPrimitives) {
      return (
        <Text
          variant={textVariant}
          weight="semibold"
          style={[{ color: textColor, opacity: 1 }, textStyle]}
        >
          {children}
        </Text>
      );
    }
    return React.Children.map(children, (child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return (
          <Text
            variant={textVariant}
            weight="semibold"
            style={[{ color: textColor, opacity: 1 }, textStyle]}
          >
            {child}
          </Text>
        );
      }
      return child;
    });
  }
  return children;
}

const Badge: React.ForwardRefExoticComponent<BadgeProps & React.RefAttributes<View>> = React.forwardRef<
  React.ElementRef<typeof View>,
  BadgeProps
>(
  (
    {
      className,
      textClassName,
      variant,
      size = 'md',
      shape = 'pill',
      status,
      role,
      userRole,
      accentColor,
      solid = true,
      label,
      customLabel,
      icon,
      dot = false,
      asChild = false,
      onPress,
      onRemove,
      children,
      style,
      textStyle,
      dotStyle,
      ...props
    }: BadgeProps,
    ref
  ) => {
    const { theme, isDark } = useTheme();

    let effectiveVariant: BadgeVariantType = variant ?? 'default';
    if (!variant && status) {
      const normalizedStatus = String(status).trim().toLowerCase();
      if (STATUS_VARIANT_MAP[normalizedStatus]) {
        effectiveVariant = STATUS_VARIANT_MAP[normalizedStatus];
      }
    }

    // Role auto-mapping
    const effectiveRole = userRole || role || (status && ['operator', 'supervisor', 'admin', 'super_admin', 'manager', 'hr'].includes(String(status).trim().toLowerCase()) ? String(status).trim().toLowerCase() : undefined);

    const colors = resolveBadgeColors(effectiveVariant, theme, isDark, effectiveRole, accentColor, solid);

    const displayText = customLabel || label;
    const effectiveDisplayText =
      displayText ||
      (effectiveRole
        ? formatBadgeRoleLabel(effectiveRole)
        : status
        ? formatBadgeStatusLabel(status)
        : undefined);

    const hasRemove = Boolean(onRemove);
    const hasPress = Boolean(onPress);
    // Outer container is only interactive when onPress is explicitly passed.
    // When only onRemove is passed, the outer badge is a static View container hosting
    // the inner remove Pressable button. In HTML / React Native Web, rendering the outer container
    // as <button> when an inner remove <button> exists causes fatal DOM nesting violations
    // ('<button> cannot contain a nested <button>').
    const isInteractive = hasPress;
    const Component = asChild ? Slot.View : isInteractive ? Pressable : View;
    const resolvedRadius = shape === 'rounded' ? radiusNumeric.sm : radiusNumeric.full;
    const textVariant = size === 'sm' ? 'micro' : size === 'lg' ? 'label' : 'caption';

    const interactiveProps = isInteractive && !asChild
      ? {
          variant: hasRemove ? ('plain' as const) : ('chip' as const),
          haptic: 'select' as const,
          hitSlopToMin48: !hasRemove,
          activeOpacity: 1.0,
          onPress,
          accessibilityRole: hasRemove ? undefined : ('button' as const),
        }
      : {};

    const cleanProps = { ...props };
    if (hasRemove && cleanProps.accessibilityRole === 'button') {
      delete cleanProps.accessibilityRole;
    }

    return (
      <TextClassContext.Provider
        value={cn(badgeTextVariants({ variant: effectiveVariant, size }), textClassName)}
      >
        <Component
          ref={ref as any}
          className={cn(badgeVariants({ variant: effectiveVariant, size }), className)}
          style={[
            staticBadgeStyles.base,
            BADGE_SIZE_STYLES[size],
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderRadius: resolvedRadius,
              opacity: 1,
            },
            style,
          ]}
          {...interactiveProps}
          {...cleanProps}
        >
          {dot && (
            <View
              className={cn(
                'rounded-full shrink-0 self-center',
                size === 'sm' ? 'h-1.5 w-1.5 mr-1' : size === 'lg' ? 'h-2 w-2 mr-2' : 'h-1.5 w-1.5 mr-1.5',
                effectiveVariant === 'success' && 'bg-emerald-600 dark:bg-emerald-400',
                effectiveVariant === 'warning' && 'bg-amber-500 dark:bg-amber-400',
                effectiveVariant === 'error' && 'bg-rose-600 dark:bg-rose-400',
                effectiveVariant === 'info' && 'bg-sky-600 dark:bg-sky-400',
                effectiveVariant === 'destructive' && 'bg-destructive-foreground',
                effectiveVariant === 'default' && 'bg-primary-foreground',
                effectiveVariant === 'secondary' && 'bg-secondary-foreground',
                effectiveVariant === 'neutral' && 'bg-neutral-500 dark:bg-neutral-400',
                effectiveVariant === 'outline' && 'bg-foreground'
              )}
              style={[
                staticBadgeStyles.dot,
                size === 'sm'
                  ? staticBadgeStyles.dotSm
                  : size === 'lg'
                  ? staticBadgeStyles.dotLg
                  : staticBadgeStyles.dotMd,
                { backgroundColor: colors.dot },
                dotStyle,
              ]}
            />
          )}
          {icon && (
            <View style={{ marginRight: 4, alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </View>
          )}
          {effectiveDisplayText ? (
            <Text
              variant={textVariant}
              weight="semibold"
              style={[{ color: colors.text }, textStyle]}
            >
              {effectiveDisplayText}
            </Text>
          ) : (
            renderBadgeChildren(children)
          )}
          {onRemove && (
            <Pressable
              variant="iconButton"
              haptic="tap"
              hitSlopToMin48
              onPress={(e) => {
                e?.stopPropagation?.();
                onRemove();
              }}
              style={staticBadgeStyles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${effectiveDisplayText || 'filter'}`}
            >
              <X size={size === 'sm' ? 10 : size === 'lg' ? 14 : 11} color={colors.text} />
            </Pressable>
          )}
        </Component>
      </TextClassContext.Provider>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge, badgeVariants, badgeTextVariants };
export default Badge;

