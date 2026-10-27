'use client'

import * as React from 'react'
import Link from 'next/link'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] shadow-xs hover:bg-[var(--action-primary-hover)] active:scale-95 transition-all',
        primary:
          'bg-[var(--action-primary-bg)] text-[var(--action-primary-fg)] shadow-xs hover:bg-[var(--action-primary-hover)] active:scale-95 transition-all',
        secondary:
          'bg-[var(--surface-sunken)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-xs hover:bg-[var(--surface-tint)] hover:text-[var(--text-link)] hover:border-[var(--border-strong)] active:scale-95 transition-all',
        outline:
          'border border-[var(--border-strong)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] active:scale-95 transition-all',
        ghost:
          'text-[var(--text-primary)] hover:bg-[var(--surface-sunken)] active:scale-95 transition-all',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:scale-95 transition-all',
        link:
          'text-[var(--text-link)] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-10 px-4 py-2',
        xs: 'h-8 px-2.5 py-1 text-xs rounded-md [&_svg]:size-3.5',
        sm: 'h-9 px-3 py-1.5 text-xs rounded-md [&_svg]:size-4',
        md: 'h-10 px-4 py-2 text-sm rounded-lg [&_svg]:size-4',
        lg: 'h-11 px-6 py-2.5 text-base rounded-xl [&_svg]:size-5',
        xl: 'h-12 px-7 py-3 text-base rounded-xl [&_svg]:size-5',
        icon: 'h-10 w-10 min-h-[40px] min-w-[40px] p-0 rounded-lg [&_svg]:size-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  isLoading?: boolean
  href?: string
  target?: string
  rel?: string
  color?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
  iconLeading?: React.ComponentType<{ className?: string }> | React.ReactNode
  iconTrailing?: React.ComponentType<{ className?: string }> | React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      color,
      size = 'default',
      asChild = false,
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
    const effectiveVariant = variant || (color as ButtonProps['variant']) || 'default'

    const renderIcon = (icon: typeof IconLeading) => {
      if (!icon) return null
      if (React.isValidElement(icon)) return icon
      if (typeof icon === 'function') {
        const IconComp = icon as React.ComponentType<{ className?: string }>
        return <IconComp className="shrink-0" />
      }
      return null
    }

    const content = (
      <>
        {isBusy ? (
          <Loader2 className="animate-spin shrink-0 size-4" />
        ) : (
          renderIcon(IconLeading)
        )}
        {children}
        {!isBusy && renderIcon(IconTrailing)}
      </>
    )

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ref,
        className: cn(buttonVariants({ variant: effectiveVariant, size, className }), (children.props as any).className),
        ...props,
      })
    }

    if (href) {
      const isHiddenSm = className?.includes('hidden sm:inline-flex') || (className?.includes('hidden') && className?.includes('sm:inline-flex'))
      const isWFull = className?.includes('w-full')
      const isPrimary = effectiveVariant === 'primary' || effectiveVariant === 'default'
      const { style: anchorStyle, ...restProps } = props as React.AnchorHTMLAttributes<HTMLAnchorElement>

      return (
        <motion.div
          whileHover={{ scale: disabled || isBusy ? 1 : 1.02 }}
          whileTap={{ scale: disabled || isBusy ? 1 : 0.96 }}
          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
          className={cn('inline-flex', isHiddenSm && 'hidden sm:inline-flex', isWFull && 'w-full flex')}
        >
          <Link
            href={href}
            className={cn(buttonVariants({ variant: effectiveVariant, size, className }))}
            style={{
              ...(isPrimary
                ? {
                    backgroundColor: 'var(--action-primary-bg)',
                    color: 'var(--action-primary-fg)',
                  }
                : {}),
              ...anchorStyle,
            }}
            aria-disabled={disabled || isBusy}
            {...restProps}
          >
            {content}
          </Link>
        </motion.div>
      )
    }

    const isPrimary = effectiveVariant === 'primary' || effectiveVariant === 'default'
    return (
      <motion.button
        ref={ref}
        type={props.type || 'button'}
        whileHover={{ scale: disabled || isBusy ? 1 : 1.02 }}
        whileTap={{ scale: disabled || isBusy ? 1 : 0.96 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        className={cn(buttonVariants({ variant: effectiveVariant, size, className }))}
        style={{
          ...(isPrimary
            ? {
                backgroundColor: 'var(--action-primary-bg)',
                color: 'var(--action-primary-fg)',
              }
            : {}),
          ...props.style,
        }}
        disabled={disabled || isBusy}
        {...(props as unknown as HTMLMotionProps<'button'>)}
      >
        {content}
      </motion.button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
