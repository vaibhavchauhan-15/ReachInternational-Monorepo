'use client';

import React, { ElementType, HTMLAttributes, ReactNode } from 'react';
import { useReveal } from './useReveal';
import { cn } from '@/lib/utils';

interface RevealProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number; // Delay in milliseconds
  y?: number; // Initial vertical translation in pixels
}

/**
 * CSS-only scroll reveal component powered by a shared IntersectionObserver.
 * Degrades safely to visible on no-JS and prefers-reduced-motion.
 */
export function Reveal({
  children,
  as: Component = 'div',
  className,
  delay = 0,
  y,
  style,
  ...rest
}: RevealProps) {
  const ref = useReveal<HTMLElement>();

  const customStyle: React.CSSProperties = {
    ...style,
    ...(delay > 0 ? { transitionDelay: `${delay}ms` } : {}),
    ...(y !== undefined ? ({ '--reveal-y': `${y}px` } as React.CSSProperties) : {}),
  };

  return (
    <Component
      ref={ref}
      className={cn('reveal', className)}
      style={customStyle}
      {...rest}
    >
      {children}
    </Component>
  );
}
