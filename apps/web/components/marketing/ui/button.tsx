'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Button as CanonicalButton,
  type ButtonVariant,
  type ButtonSize,
} from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export type MarketingButtonVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'link'

export type MarketingButtonSize =
  | 'default'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'icon'

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  asChild?: boolean
  loading?: boolean
  isLoading?: boolean
  href?: string
  target?: string
  rel?: string
  color?: MarketingButtonVariant
  variant?: MarketingButtonVariant
  size?: MarketingButtonSize
  iconLeading?: React.ComponentType<{ className?: string }> | React.ReactNode
  iconTrailing?: React.ComponentType<{ className?: string }> | React.ReactNode
}

/**
 * Marketing Button Composition
 * Composes over canonical Web Button (@/components/ui/Button) with marketing
 * spring physics (scale on hover/tap) and backward-compatible marketing props.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      color,
      size = 'default',
      loading,
      isLoading,
      href,
      iconLeading: IconLeading,
      iconTrailing: IconTrailing,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isBusy = Boolean(loading || isLoading)
    const rawVariant = variant || color || 'default'

    // Map marketing variants to canonical button variants
    const canonicalVariant: ButtonVariant =
      rawVariant === 'default' || rawVariant === 'primary'
        ? 'primary'
        : rawVariant === 'secondary'
          ? 'secondary'
          : rawVariant === 'outline'
            ? 'outline'
            : rawVariant === 'ghost'
              ? 'ghost'
              : rawVariant === 'destructive'
                ? 'destructive'
                : rawVariant === 'link'
                  ? 'link'
                  : 'primary'

    // Map marketing sizes to canonical button sizes
    const canonicalSize: ButtonSize =
      size === 'icon'
        ? 'icon'
        : size === 'xs' || size === 'sm'
          ? 'sm'
          : size === 'lg' || size === 'xl'
            ? 'lg'
            : 'md'

    const renderIcon = (icon: typeof IconLeading) => {
      if (!icon) return undefined
      if (React.isValidElement(icon)) return icon
      if (typeof icon === 'function') {
        const IconComp = icon as React.ComponentType<{ className?: string }>
        return <IconComp className="shrink-0 size-4" />
      }
      return undefined
    }

    const leadingIconNode = renderIcon(IconLeading)
    const trailingIconNode = renderIcon(IconTrailing)

    const isHiddenSm =
      className?.includes('hidden sm:inline-flex') ||
      (className?.includes('hidden') && className?.includes('sm:inline-flex'))
    const isWFull = className?.includes('w-full')

    return (
      <motion.div
        whileHover={{ scale: disabled || isBusy ? 1 : 1.02 }}
        whileTap={{ scale: disabled || isBusy ? 1 : 0.96 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        className={cn(
          'inline-flex',
          isHiddenSm && 'hidden sm:inline-flex',
          isWFull && 'w-full flex'
        )}
      >
        {href ? (
          <CanonicalButton
            href={href}
            variant={canonicalVariant}
            size={canonicalSize}
            loading={isBusy}
            disabled={disabled}
            icon={leadingIconNode}
            trailingIcon={trailingIconNode}
            className={className}
            {...(props as any)}
          >
            {children}
          </CanonicalButton>
        ) : (
          <CanonicalButton
            ref={ref}
            variant={canonicalVariant}
            size={canonicalSize}
            loading={isBusy}
            disabled={disabled}
            icon={leadingIconNode}
            trailingIcon={trailingIconNode}
            className={className}
            {...(props as any)}
          >
            {children}
          </CanonicalButton>
        )}
      </motion.div>
    )
  }
)
Button.displayName = 'Button'

export { Button }
