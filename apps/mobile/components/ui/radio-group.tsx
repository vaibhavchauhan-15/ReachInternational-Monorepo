/**
 * ReachInternational Mobile — React Native Reusables RadioGroup Component
 * Official RNR RadioGroup primitive powered by @rn-primitives/radio-group.
 */

import { cn } from '@/lib/utils';
import * as RadioGroupPrimitive from '@rn-primitives/radio-group';
import * as React from 'react';
import { Platform } from 'react-native';

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentProps<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cn('gap-3', className)}
      {...props}
    />
  );
});

RadioGroup.displayName = 'RadioGroup';

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentProps<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'border-input dark:bg-input/20 aspect-square size-5 shrink-0 items-center justify-center rounded-full border shadow-sm shadow-black/5 min-h-[44px] min-w-[44px]',
        Platform.select({
          web: 'focus-visible:border-ring focus-visible:ring-ring/50 outline-none transition-all focus-visible:ring-[2px] disabled:cursor-not-allowed',
        }),
        props.disabled && 'opacity-50',
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="bg-primary size-2.5 rounded-full" />
    </RadioGroupPrimitive.Item>
  );
});

RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
