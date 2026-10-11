/**
 * ReachInternational Mobile — React Native Reusables Switch Component
 * Official RNR Switch primitive powered by @rn-primitives/switch.
 */

import * as SwitchPrimitives from '@rn-primitives/switch';
import * as React from 'react';
import { Platform } from 'react-native';
import { cn } from '@/lib/utils';

export interface SwitchProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>, 'checked' | 'onCheckedChange'> {
  checked?: boolean;
  value?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onValueChange?: (value: boolean) => void;
  trackColor?: { false?: string; true?: string };
  thumbColor?: string;
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, checked, value, onCheckedChange, onValueChange, ...props }, ref) => {
  const isChecked = checked ?? value ?? false;

  const handleCheckedChange = (val: boolean) => {
    onCheckedChange?.(val);
    onValueChange?.(val);
  };

  return (
    <SwitchPrimitives.Root
      className={cn(
        'peer flex-row h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input p-0.5',
        className
      )}
      checked={isChecked}
      onCheckedChange={handleCheckedChange}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block h-5 w-5 rounded-full bg-background shadow-md ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
export default Switch;
