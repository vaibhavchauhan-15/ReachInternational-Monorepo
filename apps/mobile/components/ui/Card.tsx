/**
 * ReachInternational Mobile — React Native Reusables Card Component
 * Official RNR Card primitive with CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
 * powered by canonical Pressable with Material Design 3 and iOS press feedback.
 */

import { Text, TextClassContext } from '@/components/ui/Text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View, type ViewProps, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { radiusNumeric, spacingNumeric } from '@reachinternational/design-tokens';
import { useTheme } from './ThemeProvider';
import { Pressable } from './touch/Pressable';

export type CardProps = ViewProps & {
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined' | 'flat' | string;
  onPress?: () => void;
  interactive?: boolean;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
};

const CardPressContext = React.createContext<{ isPressed: boolean }>({ isPressed: false });

const Card: React.ForwardRefExoticComponent<CardProps & React.RefAttributes<View>> = React.forwardRef(
  ({ className, variant = 'default', onPress, interactive, style, children, ...props }: CardProps, ref) => {
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
      borderRadius: radiusNumeric.lg,
      padding: spacingNumeric.md,
      ...Platform.select({
        web: {
          outlineStyle: 'none',
          WebkitTapHighlightColor: 'transparent',
          transition: 'border-color 150ms ease, opacity 150ms ease, background-color 150ms ease',
        } as any,
        default: {},
      }),
    };

    const isInteractive = Boolean(onPress || interactive);

    if (isInteractive) {
      return (
        <Pressable
          ref={ref as any}
          variant="card"
          onPress={onPress}
          className={className}
          style={(state) => {
            const resolved = typeof style === 'function' ? style(state) : style;
            const resolvedList = Array.isArray(resolved) ? resolved : [resolved];
            return [
              defaultStyle,
              state.pressed && {
                borderColor: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(23, 23, 23, 0.22)',
              },
              ...resolvedList,
            ];
          }}
          {...(props as any)}
        >
          {(state) => (
            <CardPressContext.Provider value={{ isPressed: state.pressed }}>
              {typeof children === 'function' ? (children as any)(state) : children}
            </CardPressContext.Provider>
          )}
        </Pressable>
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
        style={[defaultStyle, style as StyleProp<ViewStyle>]}
        {...props}
      >
        {children}
      </View>
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
  React.ElementRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    variant="heading"
    className={cn('text-xl font-semibold leading-none tracking-tight text-card-foreground', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  React.ElementRef<typeof Text>,
  React.ComponentPropsWithoutRef<typeof Text>
>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    variant="caption"
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
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
