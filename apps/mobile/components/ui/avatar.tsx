/**
 * ReachInternational Mobile — React Native Reusables Avatar Component
 * Official RNR Avatar primitive powered by @rn-primitives/avatar.
 */

import { cn } from '@/lib/utils';
import * as AvatarPrimitive from '@rn-primitives/avatar';
import * as React from 'react';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentProps<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn('relative flex size-10 shrink-0 overflow-hidden rounded-full border border-border', className)}
      {...props}
    />
  );
});

Avatar.displayName = 'Avatar';

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentProps<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn('aspect-square size-full', className)}
      {...props}
    />
  );
});

AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentProps<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        'bg-muted flex size-full flex-row items-center justify-center rounded-full',
        className
      )}
      {...props}
    />
  );
});

AvatarFallback.displayName = 'AvatarFallback';

export { Avatar, AvatarFallback, AvatarImage };
