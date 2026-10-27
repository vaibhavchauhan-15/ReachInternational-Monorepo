import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'border-border bg-secondary text-secondary-foreground hover:bg-muted',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border-border text-foreground hover:bg-accent hover:text-accent-foreground',
        success:
          'border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
        warning:
          'border-amber-200/60 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
        brand:
          'border-sky-200/60 bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px]',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof badgeVariants> {
  color?: 'default' | 'primary' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'brand'
}

function Badge({ className, variant, color, size, ...props }: BadgeProps) {
  const effectiveVariant =
    variant ||
    (color === 'primary' ? 'default' : (color as BadgeProps['variant'])) ||
    'default'

  return (
    <div
      className={cn(badgeVariants({ variant: effectiveVariant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
