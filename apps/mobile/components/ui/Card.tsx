/**
 * ReachInternational Mobile — React Native Reusables Card Component
 * Official RNR Card primitive with CardHeader, CardTitle, CardDescription, CardContent, CardFooter.
 */

import { TextClassContext } from '@/components/ui/Text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View, type ViewProps, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from './ThemeProvider';

export type CardProps = ViewProps & {
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined' | 'flat' | string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const CardPressContext = React.createContext<{ isPressed: boolean }>({ isPressed: false });

const Card: React.ForwardRefExoticComponent<CardProps & React.RefAttributes<View>> = React.forwardRef(
  ({ className, variant = 'default', onPress, style, ...props }: CardProps, ref) => {
    const { theme, isDark } = useTheme();

    const variantClass =
      variant === 'elevated'
        ? 'shadow-xs'
        : variant === 'outlined'
        ? 'border'
        : variant === 'flat'
        ? 'border-0'
        : '';

    const defaultStyle: ViewStyle = {
      backgroundColor:
        variant === 'flat'
          ? isDark
            ? 'rgba(255, 255, 255, 0.04)'
            : 'rgba(0, 0, 0, 0.04)'
          : theme.colors.canvasElevated,
      borderColor: theme.colors.hairline,
      borderWidth: variant === 'flat' ? 0 : 1,
    };

    if (onPress) {
      return (
        <Pressable
          ref={ref as any}
          onPress={onPress}
          className={cn(
            'rounded-xl p-4 shadow-xs',
            variantClass,
            className
          )}
          style={[defaultStyle, style]}
          {...(props as any)}
        />
      );
    }
    return (
      <View
        ref={ref}
        className={cn(
          'rounded-xl p-4 shadow-xs',
          variantClass,
          className
        )}
        style={[defaultStyle, style]}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps & { className?: string }
>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex flex-col space-y-1.5 pb-3', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps & { className?: string }
>(({ className, ...props }, ref) => (
  <TextClassContext.Provider value="text-xl font-semibold leading-none tracking-tight text-card-foreground">
    <View ref={ref} className={cn('flex flex-col', className)} {...props} />
  </TextClassContext.Provider>
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps & { className?: string }
>(({ className, ...props }, ref) => (
  <TextClassContext.Provider value="text-sm text-muted-foreground">
    <View ref={ref} className={cn('flex flex-col', className)} {...props} />
  </TextClassContext.Provider>
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps & { className?: string }
>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps & { className?: string }
>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex flex-row items-center pt-3', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardPressContext };
export default Card;
