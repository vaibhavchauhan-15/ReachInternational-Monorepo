'use client'

import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock5,
  ScanSearch,
  Send,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type StatusType =
  | 'pending'
  | 'failed'
  | 'success'
  | 'in-progress'
  | 'in-review'
  | 'submitted'
  | 'expired'

interface StatusConfig {
  label: string
  icon: LucideIcon
  className: string
  spin?: boolean
}

const statusMap: Record<StatusType, StatusConfig> = {
  pending: {
    label: 'Pending',
    icon: TriangleAlert,
    className:
      'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-300/25',
  },
  failed: {
    label: 'Failed',
    icon: CircleX,
    className:
      'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-300/25',
  },
  success: {
    label: 'Success',
    icon: CircleCheck,
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-300/25',
  },
  'in-progress': {
    label: 'In Progress',
    icon: CircleDashed,
    className:
      'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-300/25',
    spin: true,
  },
  'in-review': {
    label: 'In Review',
    icon: ScanSearch,
    className:
      'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-300/25',
  },
  submitted: {
    label: 'Submitted',
    icon: Send,
    className:
      'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-300/25',
  },
  expired: {
    label: 'Expired',
    icon: Clock5,
    className:
      'bg-neutral-100 text-neutral-600 ring-neutral-500/20 dark:bg-neutral-400/10 dark:text-neutral-300 dark:ring-neutral-300/20',
  },
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType
  label?: string
  icon?: LucideIcon
}

export function StatusBadge({
  status,
  label,
  icon: CustomIcon,
  className,
  ...props
}: StatusBadgeProps) {
  const config = statusMap[status] || statusMap.pending
  const Icon = CustomIcon || config.icon
  const displayLabel = label || config.label

  return (
    <motion.span
      whileHover={{ scale: 1.04 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      className={cn(
        'inline-flex select-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold leading-none ring-1 ring-inset transition-colors cursor-default',
        config.className,
        className
      )}
      {...(props as unknown as HTMLMotionProps<'span'>)}
    >
      <Icon
        className={cn(
          'size-3.5 shrink-0',
          config.spin ? 'animate-spin [animation-duration:3s] motion-reduce:animate-none' : ''
        )}
        strokeWidth={2.25}
        aria-hidden="true"
      />
      {displayLabel}
    </motion.span>
  )
}
