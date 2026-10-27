'use client'

import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AccordionVariant = 'default' | 'card' | 'filled' | 'ghost'
export type AccordionIndicator = 'chevron' | 'plus' | 'none'

const AccordionStyleContext = React.createContext<{
  variant: AccordionVariant
  indicator: AccordionIndicator
}>({ variant: 'default', indicator: 'chevron' })

const rootStyles: Record<AccordionVariant, string> = {
  default: 'divide-y divide-border',
  card: 'space-y-3',
  filled: 'space-y-2',
  ghost: 'space-y-1',
}

const itemStyles: Record<AccordionVariant, string> = {
  default: '',
  card: 'overflow-hidden rounded-2xl border border-border bg-card text-card-foreground transition-all duration-200 shadow-xs hover:border-border/80 data-[state=open]:border-primary/40',
  filled:
    'overflow-hidden rounded-xl bg-muted/60 transition-colors data-[state=open]:bg-muted',
  ghost: '',
}

const triggerStyles: Record<AccordionVariant, string> = {
  default:
    'gap-4 py-4 text-base font-semibold hover:text-foreground [&[data-state=open]]:text-foreground cursor-pointer',
  card: 'gap-4 px-6 py-4.5 text-base font-bold hover:text-foreground text-foreground cursor-pointer',
  filled: 'gap-4 px-4 py-3.5 text-base font-semibold hover:text-foreground cursor-pointer',
  ghost: 'gap-3 rounded-lg py-3 text-base font-semibold hover:text-foreground cursor-pointer',
}

const contentStyles: Record<AccordionVariant, string> = {
  default: 'pb-5 pr-8 text-muted-foreground',
  card: 'px-6 pb-6 pt-1 pr-10 text-muted-foreground',
  filled: 'px-4 pb-4 pr-10 text-muted-foreground',
  ghost: 'pb-4 pr-8 text-muted-foreground',
}

const PlusIndicator = () => (
  <span
    aria-hidden="true"
    className="relative size-4 shrink-0 transition-transform duration-300 ease-out group-data-[state=open]:rotate-180"
  >
    <span className="absolute left-0 top-1/2 h-[1.5px] w-4 -translate-y-1/2 rounded-full bg-current" />
    <span className="absolute left-1/2 top-0 h-4 w-[1.5px] -translate-x-1/2 rounded-full bg-current transition-transform duration-300 ease-out group-data-[state=open]:scale-y-0" />
  </span>
)

const Accordion = ({
  className,
  variant = 'default',
  indicator = 'chevron',
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root> & {
  variant?: AccordionVariant
  indicator?: AccordionIndicator
}) => (
  <AccordionStyleContext.Provider value={{ variant, indicator }}>
    <AccordionPrimitive.Root
      className={cn(rootStyles[variant], className)}
      {...props}
    />
  </AccordionStyleContext.Provider>
)
Accordion.displayName = 'Accordion'

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => {
  const { variant } = React.useContext(AccordionStyleContext)
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(itemStyles[variant], className)}
      {...props}
    />
  )
})
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const { variant, indicator } = React.useContext(AccordionStyleContext)
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'group flex flex-1 items-center justify-between text-left font-medium outline-hidden transition-colors',
          triggerStyles[variant],
          className
        )}
        {...props}
      >
        {children}
        {indicator === 'chevron' && (
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out group-data-[state=open]:rotate-180"
            strokeWidth={2}
          />
        )}
        {indicator === 'plus' && <PlusIndicator />}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
})
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { variant } = React.useContext(AccordionStyleContext)
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className="overflow-hidden text-sm leading-relaxed text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn(contentStyles[variant], className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
})
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
