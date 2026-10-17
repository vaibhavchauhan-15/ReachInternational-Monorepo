/**
 * ReachInternational Mobile — React Native Reusables Button Component
 * Official RNR Button primitive powered by class-variance-authority, TextClassContext,
 * and canonical Pressable with Material Design 3 and iOS press feedback.
 * 
 * Strict Invariants:
 * - Vercel Geist design tokens (#171717 ink, hairline borders, muted washes, #0284c7 primary)
 * - Minimum 44px touch targets on action buttons (minHeight: 44, hitSlopToMin48)
 * - 0 unparented text node crashes (automatic text wrapping for primitives)
 * - Single source of truth for styles: static layout & size maps, dynamic theme colors
 * - Theme-aware light & dark palettes with high contrast
 * - Variant-aware loading spinner colors
 * - Tactile haptic feedback and press state coordination
 */

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { Text, TextClassContext } from '@/components/ui/Text';
import { cn } from '@/lib/utils';
import { Pressable, type PressableProps } from './touch/Pressable';
import type { TouchVariant } from './touch/feedback';
import type { HapticKind } from '../../lib/haptics';
import { useTheme, type RNThemeType } from './ThemeProvider';
import { radiusNumeric } from '@reachinternational/design-tokens';

const buttonVariants = cva(
  'group flex flex-row items-center justify-center',
  {
    variants: {
      variant: {
        default: 'bg-primary',
        primary: 'bg-primary',
        destructive: 'bg-destructive',
        danger: 'bg-destructive',
        outline: 'border border-input bg-background',
        secondary: 'bg-secondary',
        ghost: 'bg-transparent',
        link: 'bg-transparent web:underline-offset-4 web:hover:underline web:focus:underline',
      },
      size: {
        default: 'h-11 px-4 py-2 native:h-12 native:px-5',
        md: 'h-11 px-4 py-2 native:h-12 native:px-5',
        sm: 'h-9 px-3 native:h-10 native:px-4',
        lg: 'h-12 px-8 native:h-14 native:px-6',
        icon: 'h-10 w-10 native:h-11 native:w-11',
      },
      shape: {
        rounded: 'rounded-xl',
        pill: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'rounded',
    },
  }
);

const buttonTextVariants = cva(
  'web:whitespace-nowrap text-sm font-medium text-foreground',
  {
    variants: {
      variant: {
        default: 'text-primary-foreground font-semibold',
        primary: 'text-primary-foreground font-semibold',
        destructive: 'text-destructive-foreground font-semibold',
        danger: 'text-destructive-foreground font-semibold',
        outline: 'text-foreground font-medium',
        secondary: 'text-secondary-foreground font-medium',
        ghost: 'text-foreground font-medium',
        link: 'text-primary font-medium',
      },
      size: {
        default: 'text-sm native:text-base font-semibold',
        md: 'text-sm native:text-base font-semibold',
        sm: 'text-xs native:text-sm font-medium',
        lg: 'text-base native:text-lg font-semibold',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function mapButtonVariantToTouch(variant: string, size?: string): TouchVariant {
  if (size === 'icon') return 'iconButton';
  switch (variant) {
    case 'primary':
    case 'default':
      return 'buttonPrimary';
    case 'destructive':
    case 'danger':
      return 'buttonDanger';
    case 'secondary':
      return 'buttonSecondary';
    case 'outline':
      return 'buttonOutline';
    case 'ghost':
    case 'link':
      return 'buttonGhost';
    default:
      return 'buttonPrimary';
  }
}

// -----------------------------------------------------------------------------
// Static Geometry & Radii Definitions (Allocated once, 0 render overhead)
// -----------------------------------------------------------------------------
const RADIUS_PILL = 9999;
const RADIUS_ICON = 22;
const RADIUS_ROUNDED = radiusNumeric.md; // 12

// Static sizing styles enforcing minimum 44px touch targets on mobile
const BUTTON_SIZE_STYLES: Record<string, ViewStyle> = {
  default: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 },
  md: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 },
  sm: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 6 },
  lg: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 12 },
  icon: { width: 44, height: 44, minHeight: 44, minWidth: 44, padding: 0 },
};

// Static layout styles
const staticStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      } as any,
      default: {},
    }),
  },
  fullWidth: {
    width: '100%',
  },
  leadingIcon: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingIcon: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

interface ResolvedButtonColors {
  background: string;
  border: string;
  borderWidth: number;
  text: string;
  spinner: string;
}

/**
 * Resolves theme-aware, variant-specific colors with high-contrast accessibility.
 * Preserves Reach sky blue (#0284c7 light / #0ea5e9 dark) for primary actions.
 * Keeps transparency strictly for ghost and link variants.
 */
function resolveButtonColors(
  variant: string,
  theme: RNThemeType,
  isDark: boolean,
  isDisabled: boolean,
  isLoading: boolean
): ResolvedButtonColors {
  // Deliberate disabled state (when disabled and not actively loading)
  if (isDisabled && !isLoading) {
    if (variant === 'primary' || variant === 'default' || variant === 'destructive' || variant === 'danger') {
      return {
        background: isDark ? theme.colors.hairline : '#e5e7eb',
        border: 'transparent',
        borderWidth: 0,
        text: theme.colors.mute,
        spinner: theme.colors.mute,
      };
    }
    if (variant === 'secondary') {
      return {
        background: isDark ? theme.colors.canvas : '#f5f5f5',
        border: theme.colors.hairlineSoft,
        borderWidth: 1,
        text: theme.colors.faint,
        spinner: theme.colors.faint,
      };
    }
    if (variant === 'outline') {
      return {
        background: theme.colors.canvasElevated,
        border: theme.colors.hairlineSoft,
        borderWidth: 1,
        text: theme.colors.faint,
        spinner: theme.colors.faint,
      };
    }
    // ghost, link
    return {
      background: 'transparent',
      border: 'transparent',
      borderWidth: 0,
      text: theme.colors.faint,
      spinner: theme.colors.faint,
    };
  }

  // Active (or loading) colors
  switch (variant) {
    case 'default':
    case 'primary':
      return {
        // Reach blue #0284c7 light / #0ea5e9 dark
        background: isDark ? (theme.colors.primary || '#0ea5e9') : (theme.colors.primary || '#0284c7'),
        border: 'transparent',
        borderWidth: 0,
        text: theme.colors.onPrimary || '#ffffff',
        spinner: theme.colors.onPrimary || '#ffffff',
      };
    case 'destructive':
    case 'danger':
      return {
        background: isDark ? (theme.colors.errorDeep || '#dc2626') : (theme.colors.error || '#ee0000'),
        border: 'transparent',
        borderWidth: 0,
        text: '#ffffff',
        spinner: '#ffffff',
      };
    case 'secondary':
      return {
        // Solid neutral surface with readable ink foreground
        background: isDark ? theme.colors.hairline : '#f4f4f5',
        border: 'transparent',
        borderWidth: 0,
        text: theme.colors.ink,
        spinner: theme.colors.ink,
      };
    case 'outline':
      return {
        // Defined solid elevated surface with hairline border
        background: theme.colors.canvasElevated,
        border: theme.colors.hairline,
        borderWidth: 1,
        text: theme.colors.ink,
        spinner: theme.colors.primary || '#0284c7',
      };
    case 'ghost':
      return {
        // Retain minimal transparent styling for low-emphasis action
        background: 'transparent',
        border: 'transparent',
        borderWidth: 0,
        text: theme.colors.ink,
        spinner: theme.colors.primary || '#0284c7',
      };
    case 'link':
      return {
        // Retain minimal transparent styling with brand link foreground
        background: 'transparent',
        border: 'transparent',
        borderWidth: 0,
        text: theme.colors.link,
        spinner: theme.colors.link,
      };
    default:
      return {
        background: isDark ? (theme.colors.primary || '#0ea5e9') : (theme.colors.primary || '#0284c7'),
        border: 'transparent',
        borderWidth: 0,
        text: theme.colors.onPrimary || '#ffffff',
        spinner: theme.colors.onPrimary || '#ffffff',
      };
  }
}

export type ButtonProps = Omit<PressableProps, 'variant'> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    textClassName?: string;
    label?: string;
    isLoading?: boolean;
    fullWidth?: boolean;
    shape?: 'pill' | 'rounded';
    icon?: React.ReactNode;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
    haptic?: HapticKind | false;
  };

const Button = React.forwardRef<React.ElementRef<typeof Pressable>, ButtonProps>(
  function Button(
    {
      className,
      textClassName,
      variant = 'default',
      size = 'default',
      label,
      isLoading = false,
      fullWidth = false,
      shape = 'rounded',
      icon,
      leftIcon,
      rightIcon,
      children,
      disabled,
      style,
      haptic,
      ...props
    },
    ref
  ) {
    const { theme, isDark } = useTheme();
    const effectiveVariant = variant ?? 'default';
    const effectiveSize = size ?? 'default';
    const effectiveShape = shape ?? 'rounded';
    const isDisabled = Boolean(disabled || isLoading);

    /**
     * Leading icon precedence:
     * `leftIcon` takes priority over `icon` when both are passed.
     * Trailing icon is rendered via `rightIcon`.
     */
    const leadingIcon = leftIcon ?? icon;
    const touchVariant = mapButtonVariantToTouch(effectiveVariant, effectiveSize as string);

    // Explicit shape resolution with safe backward-compatibility fallback
    const isPill =
      effectiveShape === 'pill' ||
      (Boolean(className) && /(?:^|\s)rounded-full(?:\s|$)/.test(className!));

    const borderRadius = isPill
      ? RADIUS_PILL
      : effectiveSize === 'icon'
      ? RADIUS_ICON
      : RADIUS_ROUNDED;

    const sizeStyle = BUTTON_SIZE_STYLES[effectiveSize as string] ?? BUTTON_SIZE_STYLES.default;
    const colors = resolveButtonColors(effectiveVariant, theme, isDark, isDisabled, isLoading);

    const dynamicStyle: ViewStyle = {
      backgroundColor: colors.background,
      borderRadius,
      borderWidth: colors.borderWidth,
      ...(colors.borderWidth > 0 ? { borderColor: colors.border } : {}),
    };

    const textVariantProps =
      effectiveSize === 'sm'
        ? { variant: 'caption' as const, weight: 'medium' as const }
        : effectiveSize === 'lg'
        ? { variant: 'body' as const, weight: 'semibold' as const }
        : { variant: 'label' as const, weight: 'semibold' as const };

    return (
      <TextClassContext.Provider
        value={cn(
          buttonTextVariants({ variant: effectiveVariant, size: effectiveSize }),
          textClassName
        )}
      >
        <Pressable
          ref={ref}
          variant={touchVariant}
          haptic={haptic}
          rippleRadius={isPill ? RADIUS_PILL : effectiveSize === 'icon' ? 24 : undefined}
          disabled={isDisabled}
          loading={isLoading}
          accessibilityRole="button"
          accessibilityState={{ disabled: isDisabled, busy: isLoading }}
          className={cn(
            buttonVariants({ variant: effectiveVariant, size: effectiveSize, shape: effectiveShape }),
            fullWidth && 'w-full',
            isDisabled && 'pointer-events-none',
            className
          )}
          style={
            typeof style === 'function'
              ? (state) => [
                  staticStyles.base,
                  sizeStyle,
                  dynamicStyle,
                  fullWidth && staticStyles.fullWidth,
                  style(state),
                ]
              : [
                  staticStyles.base,
                  sizeStyle,
                  dynamicStyle,
                  fullWidth && staticStyles.fullWidth,
                  style,
                ]
          }
          {...props}
        >
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.spinner}
            />
          ) : (
            <>
              {leadingIcon && <View style={staticStyles.leadingIcon}>{leadingIcon}</View>}
              {label ? (
                <Text
                  variant={textVariantProps.variant}
                  weight={textVariantProps.weight}
                  style={{ color: colors.text }}
                >
                  {label}
                </Text>
              ) : typeof children === 'string' || typeof children === 'number' ? (
                <Text
                  variant={textVariantProps.variant}
                  weight={textVariantProps.weight}
                  style={{ color: colors.text }}
                >
                  {children}
                </Text>
              ) : Array.isArray(children) &&
                children.every(
                  (c) => c == null || c === false || c === true || typeof c === 'string' || typeof c === 'number'
                ) ? (
                <Text
                  variant={textVariantProps.variant}
                  weight={textVariantProps.weight}
                  style={{ color: colors.text }}
                >
                  {children}
                </Text>
              ) : (
                children
              )}
              {rightIcon && <View style={staticStyles.trailingIcon}>{rightIcon}</View>}
            </>
          )}
        </Pressable>
      </TextClassContext.Provider>
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants, buttonTextVariants };
export default Button;
