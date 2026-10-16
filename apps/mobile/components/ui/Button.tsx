/**
 * ReachInternational Mobile — React Native Reusables Button Component
 * Official RNR Button primitive powered by class-variance-authority, TextClassContext,
 * and canonical Pressable with Material Design 3 and iOS press feedback.
 */

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import {
  ActivityIndicator,
  Platform,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { Text, TextClassContext } from '@/components/ui/Text';
import { cn } from '@/lib/utils';
import { Pressable, type PressableProps } from './touch/Pressable';
import type { TouchVariant } from './touch/feedback';
import type { HapticKind } from '../../lib/haptics';
import { useTheme } from './ThemeProvider';
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
        ghost: '',
        link: 'web:underline-offset-4 web:hover:underline web:focus:underline',
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

const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<React.ElementRef<typeof Pressable>>> = React.forwardRef(
  (
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
    }: ButtonProps,
    ref
  ) => {
    const { theme, isDark } = useTheme();
    const effectiveVariant = variant ?? 'default';
    const effectiveSize = size ?? 'default';
    const effectiveShape = shape ?? 'rounded';
    const isDisabled = Boolean(disabled || isLoading);
    const actualLeftIcon = leftIcon || icon;
    const touchVariant = mapButtonVariantToTouch(effectiveVariant, effectiveSize as string);

    const isFilled =
      effectiveVariant === 'default' ||
      effectiveVariant === 'primary' ||
      effectiveVariant === 'destructive' ||
      effectiveVariant === 'danger';

    const resolvedTextColor = isFilled
      ? '#ffffff'
      : effectiveVariant === 'link'
      ? theme.colors.link
      : isDark
      ? '#f8fafc'
      : theme.colors.ink;

    const sizeStyles: ViewStyle = {
      default: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 },
      md: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 },
      sm: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 6 },
      lg: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 12 },
      icon: { width: 44, height: 44, padding: 0 },
    }[effectiveSize as string] || { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 };

    let variantStyle: ViewStyle;
    switch (effectiveVariant) {
      case 'default':
      case 'primary':
        variantStyle = {
          backgroundColor: isDark ? '#0ea5e9' : '#0284c7',
          borderWidth: 0,
        };
        break;
      case 'destructive':
      case 'danger':
        variantStyle = {
          backgroundColor: isDark ? '#dc2626' : '#ee0000',
          borderWidth: 0,
        };
        break;
      case 'outline':
        variantStyle = {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: theme.colors.hairline,
        };
        break;
      case 'secondary':
        variantStyle = {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(23, 23, 23, 0.05)',
          borderWidth: 0,
        };
        break;
      case 'ghost':
      case 'link':
      default:
        variantStyle = {
          backgroundColor: 'transparent',
          borderWidth: 0,
        };
        break;
    }

    const isPill = effectiveShape === 'pill' || className?.includes('rounded-full');
    const borderRadius = isPill ? 9999 : effectiveSize === 'icon' ? 22 : radiusNumeric.md;

    const baseBtnStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius,
      ...sizeStyles,
      ...variantStyle,
      ...(fullWidth ? { width: '100%' } : {}),
      ...Platform.select({
        web: {
          outlineStyle: 'none',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
        } as any,
        default: {},
      }),
    };

    return (
      <TextClassContext.Provider
        value={cn(
          buttonTextVariants({ variant: effectiveVariant, size: effectiveSize }),
          textClassName
        )}
      >
        <Pressable
          ref={ref as any}
          variant={touchVariant}
          haptic={haptic}
          rippleRadius={isPill ? 9999 : effectiveSize === 'icon' ? 24 : undefined}
          disabled={isDisabled}
          loading={isLoading}
          className={cn(
            buttonVariants({ variant: effectiveVariant, size: effectiveSize, shape: effectiveShape }),
            fullWidth && 'w-full',
            isDisabled && 'opacity-50 pointer-events-none',
            className
          )}
          style={
            typeof style === 'function'
              ? (state) => {
                  const resolved = style(state);
                  return [baseBtnStyle, resolved];
                }
              : [baseBtnStyle, style]
          }
          {...props}
        >
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color={
                effectiveVariant === 'outline' || effectiveVariant === 'ghost'
                  ? '#0284c7'
                  : '#ffffff'
              }
            />
          ) : (
            <>
              {actualLeftIcon && <View className="mr-2">{actualLeftIcon}</View>}
              {label ? (
                <Text
                  variant="label"
                  weight="semibold"
                  style={{ color: resolvedTextColor }}
                >
                  {label}
                </Text>
              ) : (
                children
              )}
              {rightIcon && <View className="ml-2">{rightIcon}</View>}
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
