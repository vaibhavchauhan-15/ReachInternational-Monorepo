/**
 * ReachInternational Mobile — React Native Reusables Tabs Component
 * Official RNR Tabs primitive powered by @rn-primitives/tabs.
 */

import { TextClassContext } from '@/components/ui/Text';
import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@rn-primitives/tabs';
import * as React from 'react';
import { Platform } from 'react-native';

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentProps<typeof TabsPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.Root
      ref={ref}
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
});

Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentProps<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'bg-muted flex h-11 flex-row items-center justify-center rounded-xl p-1',
        Platform.select({ web: 'inline-flex w-fit', native: 'w-full' }),
        className
      )}
      {...props}
    />
  );
});

TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentProps<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const { value } = TabsPrimitive.useRootContext();
  const isSelected = value === props.value;

  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm font-medium',
        isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground'
      )}
    >
      <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
          'flex h-full flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 shadow-none min-h-[40px]',
          props.disabled && 'opacity-50',
          isSelected && 'bg-background shadow-sm border-border',
          className
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
});

TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentProps<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn('flex-1 pt-2', className)}
      {...props}
    />
  );
});

TabsContent.displayName = 'TabsContent';

export { Tabs, TabsContent, TabsList, TabsTrigger };
