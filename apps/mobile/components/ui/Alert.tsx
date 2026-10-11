/**
 * ReachInternational Mobile — React Native Reusables Alert Component
 * Official RNR Alert primitive with AlertTitle and AlertDescription.
 */

import { TextClassContext } from '@/components/ui/Text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { View, type ViewProps, Text as RNText } from 'react-native';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react-native';

const alertVariants = cva(
  'relative w-full rounded-xl border p-4 flex-row items-start gap-3',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground',
        destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
        error: 'border-destructive/30 bg-destructive/10 text-destructive',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        info: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type AlertProps = ViewProps &
  VariantProps<typeof alertVariants> & {
    className?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    message?: string;
  };

const Alert = React.forwardRef<React.ElementRef<typeof View>, AlertProps>(
  ({ className, variant, type, title, message, children, ...props }, ref) => {
    let effectiveVariant = variant ?? 'default';
    if (!variant && type) {
      if (type === 'error') effectiveVariant = 'destructive';
      else if (type === 'success') effectiveVariant = 'success';
      else if (type === 'warning') effectiveVariant = 'warning';
      else if (type === 'info') effectiveVariant = 'info';
    }

    const renderIcon = () => {
      if (effectiveVariant === 'destructive' || effectiveVariant === 'error') {
        return <AlertCircle size={20} className="text-destructive mt-0.5" color="#ef4444" />;
      }
      if (effectiveVariant === 'success') {
        return <CheckCircle2 size={20} className="text-emerald-600 mt-0.5" color="#10b981" />;
      }
      if (effectiveVariant === 'warning') {
        return <AlertTriangle size={20} className="text-amber-600 mt-0.5" color="#f5a623" />;
      }
      return <Info size={20} className="text-primary mt-0.5" color="#0284c7" />;
    };

    return (
      <View
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant: effectiveVariant }), className)}
        {...props}
      >
        {renderIcon()}
        <View className="flex-1 flex-col">
          {title && <AlertTitle>{title}</AlertTitle>}
          {message && <AlertDescription>{message}</AlertDescription>}
          {children}
        </View>
      </View>
    );
  }
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps & { className?: string }
>(({ className, ...props }, ref) => (
  <TextClassContext.Provider value="text-base font-semibold leading-none tracking-tight text-foreground mb-1">
    <View ref={ref} className={cn('flex flex-col', className)} {...props} />
  </TextClassContext.Provider>
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  React.ElementRef<typeof View>,
  ViewProps & { className?: string }
>(({ className, ...props }, ref) => (
  <TextClassContext.Provider value="text-sm leading-relaxed text-muted-foreground">
    <View ref={ref} className={cn('flex flex-col', className)} {...props} />
  </TextClassContext.Provider>
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
export default Alert;
