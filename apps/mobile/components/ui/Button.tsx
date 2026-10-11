/**
 * ReachInternational Mobile — React Native Reusables Button Component
 * Official RNR Button primitive powered by class-variance-authority and TextClassContext.
 */

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { Text, TextClassContext } from '@/components/ui/Text';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'group flex flex-row items-center justify-center rounded-xl web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary web:hover:opacity-90 active:opacity-90',
        primary: 'bg-primary web:hover:opacity-90 active:opacity-90',
        destructive: 'bg-destructive web:hover:opacity-90 active:opacity-90',
        danger: 'bg-destructive web:hover:opacity-90 active:opacity-90',
        outline:
          'border border-input bg-background web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent',
        secondary: 'bg-secondary web:hover:opacity-80 active:opacity-80',
        ghost: 'web:hover:bg-accent web:hover:text-accent-foreground active:bg-accent',
        link: 'web:underline-offset-4 web:hover:underline web:focus:underline',
      },
      size: {
        default: 'h-11 px-4 py-2 native:h-12 native:px-5',
        md: 'h-11 px-4 py-2 native:h-12 native:px-5',
        sm: 'h-9 rounded-lg px-3 native:h-10 native:px-4',
        lg: 'h-12 rounded-xl px-8 native:h-14 native:px-6',
        icon: 'h-10 w-10 native:h-11 native:w-11 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva(
  'web:whitespace-nowrap text-sm font-medium text-foreground web:transition-colors',
  {
    variants: {
      variant: {
        default: 'text-primary-foreground font-semibold',
        primary: 'text-primary-foreground font-semibold',
        destructive: 'text-destructive-foreground font-semibold',
        danger: 'text-destructive-foreground font-semibold',
        outline: 'text-foreground group-active:text-accent-foreground font-medium',
        secondary: 'text-secondary-foreground group-active:text-secondary-foreground font-medium',
        ghost: 'text-foreground group-active:text-accent-foreground font-medium',
        link: 'text-primary group-active:underline font-medium',
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

export type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    className?: string;
    textClassName?: string;
    label?: string;
    isLoading?: boolean;
    fullWidth?: boolean;
    shape?: 'pill' | 'rounded' | string;
    icon?: React.ReactNode;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
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
      ...props
    }: ButtonProps,
    ref
  ) => {
    const effectiveVariant = variant ?? 'default';
    const effectiveSize = size ?? 'default';
    const isDisabled = Boolean(disabled || isLoading);

    const actualLeftIcon = leftIcon || icon;

    return (
      <TextClassContext.Provider
        value={cn(
          buttonTextVariants({ variant: effectiveVariant, size: effectiveSize }),
          textClassName
        )}
      >
        <Pressable
          ref={ref}
          disabled={isDisabled}
          className={cn(
            buttonVariants({ variant: effectiveVariant, size: effectiveSize }),
            fullWidth && 'w-full',
            isDisabled && 'opacity-50 pointer-events-none',
            className
          )}
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
              {label ? <Text>{label}</Text> : children}
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
