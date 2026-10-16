/**
 * ReachInternational Mobile — React Native Reusables Checkbox Component
 * Official RNR Checkbox primitive powered by @rn-primitives/checkbox and Lucide Check.
 */

import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import * as React from 'react';
import { Platform } from 'react-native';
import { Check } from 'lucide-react-native';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'checked' | 'onCheckedChange'> {
  checked?: boolean;
  value?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: (checked: boolean) => void;
  onValueChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(
  (
    {
      className,
      checked,
      value,
      onCheckedChange,
      onChange,
      onValueChange,
      ...props
    },
    ref
  ) => {
    const isChecked = checked ?? value ?? false;

    const handleCheckedChange = (val: boolean) => {
      onCheckedChange?.(val);
      onChange?.(val);
      onValueChange?.(val);
    };

    return (
      <CheckboxPrimitive.Root
        ref={ref}
        checked={isChecked}
        onCheckedChange={handleCheckedChange}
        className={cn(
          'web:peer h-5 w-5 shrink-0 rounded border border-primary web:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground items-center justify-center',
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className={cn('items-center justify-center h-full w-full')}>
          <Check size={14} strokeWidth={3.5} className="text-primary-foreground" color="#ffffff" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  }
);

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
export default Checkbox;
