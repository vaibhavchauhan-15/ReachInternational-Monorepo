'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { ThemeToggle } from './ThemeToggle'
import { ReachLogo } from '@/components/marketing/primitives/ReachLogo'
import { Button } from '@/components/marketing/ui/button'
import { NavigationMenu as NavigationMenuPrimitive } from '@base-ui-components/react/navigation-menu'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Menu,
  X,
  Truck,
  Wrench,
  Building2,
  Warehouse,
  Factory,
  HardHat,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'

// ============================================================================
// Base UI Navigation Menu Primitives (Inlined)
// ============================================================================

function NavigationMenu({ className, children, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Root>) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn('group/navigation-menu relative flex max-w-max flex-1 items-center justify-center', className)}
      {...props}
    >
      {children}
    </NavigationMenuPrimitive.Root>
  )
}

function NavigationMenuList({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)}
      {...props}
    />
  )
}

function NavigationMenuItem({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Item>) {
  return (
    <NavigationMenuPrimitive.Item data-slot="navigation-menu-item" className={cn('relative', className)} {...props} />
  )
}

const navigationMenuTriggerStyle = cva(
  'group inline-flex h-9 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[popup-open]:hover:bg-accent data-[popup-open]:text-accent-foreground data-[popup-open]:focus:bg-accent data-[popup-open]:bg-accent/50 focus-visible:ring-ring/50 outline-none transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1',
)

function NavigationMenuTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), 'group', className)}
      {...props}
    >
      {children}{' '}
      <ChevronDown
        className="relative top-[1px] ms-1 size-3 transition duration-300 group-data-[popup-open]:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  )
}

function NavigationMenuContent({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        'w-[calc(100vw_-_40px)] h-full p-2 sm:w-max xs:min-w-[400px] ',
        'transition-[opacity,transform,translate] duration-[var(--duration)] ease-[var(--easing)] ',
        'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 ',
        'data-[starting-style]:data-[activation-direction=left]:translate-x-[-50%] ',
        'data-[starting-style]:data-[activation-direction=right]:translate-x-[50%] ',
        'data-[ending-style]:data-[activation-direction=left]:translate-x-[50%] ',
        'data-[ending-style]:data-[activation-direction=right]:translate-x-[-50%]',
        className,
      )}
      {...props}
    />
  )
}

function NavigationMenuPortal({ ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Portal>) {
  return <NavigationMenuPrimitive.Portal data-slot="navigation-menu-portal" {...props} />
}

function NavigationMenuPositioner({
  className,
  children,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Positioner>) {
  return (
    <NavigationMenuPortal>
      <NavigationMenuPrimitive.Positioner
        data-slot="navigation-menu-positioner"
        sideOffset={10}
        collisionPadding={{ top: 5, bottom: 5, left: 20, right: 20 }}
        collisionAvoidance={{ side: 'none' }}
        className={cn(
          "box-border h-[var(--positioner-height)] w-[var(--positioner-width)] max-w-[var(--available-width)] transition-[top,left,right,bottom] duration-[var(--duration)] ease-[var(--easing)] before:absolute before:content-[''] data-[instant]:transition-none data-[side=bottom]:before:top-[-10px] data-[side=bottom]:before:right-0 data-[side=bottom]:before:left-0 data-[side=bottom]:before:h-2.5 data-[side=left]:before:top-0 data-[side=left]:before:right-[-10px] data-[side=left]:before:bottom-0 data-[side=left]:before:w-2.5 data-[side=right]:before:top-0 data-[side=right]:before:bottom-0 data-[side=right]:before:left-[-10px] data-[side=right]:before:w-2.5 data-[side=top]:before:right-0 data-[side=top]:before:bottom-[-10px] data-[side=top]:before:left-0 data-[side=top]:before:h-2.5",
          className,
        )}
        style={
          {
            '--duration': '0.35s',
            '--easing': 'cubic-bezier(0.22, 1, 0.36, 1)',
          } as React.CSSProperties
        }
        {...props}
      >
        {children}
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPortal>
  )
}

function NavigationMenuPopup({
  className,
  children,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Popup>) {
  return (
    <NavigationMenuPrimitive.Popup
      className={cn(
        'data-[ending-style]:easing-[ease] relative h-[var(--popup-height)] origin-[var(--transform-origin)] rounded-lg bg-popover shadow-lg outline-1 outline-border transition-[opacity,transform,width,height,scale,translate] duration-[var(--duration)] ease-[var(--easing)] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-90 data-[starting-style]:opacity-0 w-[var(--popup-width)] xs:w-[var(--popup-width)] dark:shadow-none dark:-outline-offset-1',
        className,
      )}
      {...props}
    >
      {children}
      <NavigationMenuViewport />
    </NavigationMenuPrimitive.Popup>
  )
}

function NavigationMenuViewport({
  className,
  ...props
}: React.ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return (
    <NavigationMenuPrimitive.Viewport className={cn('relative h-full w-full overflow-hidden', className)} {...props} />
  )
}

function NavigationMenuLink({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Link>) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "data-[active]:focus:bg-accent data-[active]:hover:bg-accent data-[active]:bg-accent/50 data-[active]:text-accent-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus-visible:ring-ring/50 [&_svg:not([class*='text-'])]:text-muted-foreground flex flex-col gap-1 rounded-sm p-2 text-sm transition-all outline-none focus-visible:ring-[3px] focus-visible:outline-1 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function NavigationMenuArrow({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Arrow>) {
  return (
    <NavigationMenuPrimitive.Arrow
      data-slot="navigation-menu-arrow"
      className={cn(
        'flex transition-[left] duration-[var(--duration)] ease-[var(--easing)] data-[side=bottom]:top-[-8px] data-[side=left]:right-[-13px] data-[side=left]:rotate-90 data-[side=right]:left-[-13px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-8px] data-[side=top]:rotate-180',
        className,
      )}
      {...props}
    >
      <ArrowSvg />
    </NavigationMenuPrimitive.Arrow>
  )
}

function ArrowSvg(props: React.ComponentProps<'svg'>) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" fill="none" {...props}>
      <path
        d="M9.66437 2.60207L4.80758 6.97318C4.07308 7.63423 3.11989 8 2.13172 8H0V10H20V8H18.5349C17.5468 8 16.5936 7.63423 15.8591 6.97318L11.0023 2.60207C10.622 2.2598 10.0447 2.25979 9.66437 2.60207Z"
        className="fill-popover"
      />
      <path
        d="M8.99542 1.85876C9.75604 1.17425 10.9106 1.17422 11.6713 1.85878L16.5281 6.22989C17.0789 6.72568 17.7938 7.00001 18.5349 7.00001L15.89 7L11.0023 2.60207C10.622 2.2598 10.0447 2.2598 9.66436 2.60207L4.77734 7L2.13171 7.00001C2.87284 7.00001 3.58774 6.72568 4.13861 6.22989L8.99542 1.85876Z"
        className="fill-border dark:fill-none"
      />
      <path
        d="M10.3333 3.34539L5.47654 7.71648C4.55842 8.54279 3.36693 9 2.13172 9H0V8H2.13172C3.11989 8 4.07308 7.63423 4.80758 6.97318L9.66437 2.60207C10.0447 2.25979 10.622 2.2598 11.0023 2.60207L15.8591 6.97318C16.5936 7.63423 17.5468 8 18.5349 8H20V9H18.5349C17.2998 9 16.1083 8.54278 15.1901 7.71648L10.3333 3.34539Z"
        className="dark:fill-border"
      />
    </svg>
  )
}

const equipmentLinks = {
  access: [
    { href: '/equipment/boom-lifts/', label: 'Boom Lifts', desc: 'Articulated and telescopic heavy reach.' },
    { href: '/equipment/scissor-lifts/', label: 'Scissor Lifts', desc: 'Electric and rough-terrain slab lifts.' },
    { href: '/equipment/vertical-mast-lifts/', label: 'Vertical Mast Lifts', desc: 'Zero-tailswing indoor solutions.' },
    { href: '/equipment/spider-lifts/', label: 'Spider Lifts', desc: 'Tracked crawlers for sensitive floors.' },
  ],
  mhe: [
    { href: '/equipment/forklifts/', label: 'Forklifts', desc: 'Diesel, LPG and electric counterbalanced.' },
    { href: '/equipment/reach-trucks/', label: 'Reach Trucks', desc: 'Narrow-aisle high-density stacking.' },
    { href: '/equipment/material-lifts/', label: 'Material Lifts', desc: 'Compact portable crank lifts.' },
    { href: '/equipment/scaffolding/', label: 'Scaffolding', desc: 'Modular mobile tower systems.' },
  ],
}

const serviceLinks = [
  {
    href: '/services/rental/',
    label: 'Equipment Rental',
    desc: 'Flexible short & long term rental across India.',
    icon: Truck,
  },
  {
    href: '/services/equipment-sales/',
    label: 'Equipment Sales',
    desc: 'New and certified pre-owned heavy machinery.',
    icon: Wrench,
  },
]

const industryLinks = [
  {
    href: '/industries/construction/',
    label: 'Construction',
    desc: 'Rough-terrain lifts for job sites.',
    icon: HardHat,
  },
  {
    href: '/industries/warehousing-logistics/',
    label: 'Warehousing & Logistics',
    desc: 'Narrow-aisle reach trucks and stackers.',
    icon: Warehouse,
  },
  {
    href: '/industries/manufacturing/',
    label: 'Manufacturing',
    desc: 'Safe indoor vertical access.',
    icon: Factory,
  },
  {
    href: '/industries/infrastructure/',
    label: 'Infrastructure',
    desc: 'High-reach access for major developments.',
    icon: Building2,
  },
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-colors"
      style={{
        backgroundColor: 'var(--surface-base)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="h-[72px] max-w-wide mx-auto px-4 md:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo & Navigation */}
        <div className="flex items-center gap-6 xl:gap-8">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <ReachLogo height={48} priority />
          </Link>

          {/* Desktop Navigation Menu via @/components/ui/navigation */}
          <nav aria-label="Primary navigation" className="hidden lg:flex items-center">
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                {/* Home Link */}
                <NavigationMenuItem>
                  <NavigationMenuLink
                    render={
                      <Link
                        href="/"
                        className={navigationMenuTriggerStyle({
                          className: pathname === '/' ? 'text-foreground font-semibold' : 'text-muted-foreground',
                        })}
                      />
                    }
                  >
                    Home
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* Equipment Mega Menu */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={pathname.startsWith('/equipment') ? 'text-foreground font-semibold' : ''}>
                    Equipment
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="grid grid-cols-12 gap-5 p-2 w-[780px] lg:w-[860px]">
                      {/* Featured Visual Card */}
                      <div className="col-span-4 rounded-lg overflow-hidden border border-border bg-muted/40 p-4 flex flex-col justify-between relative group">
                        <div className="relative h-28 w-full rounded-md overflow-hidden mb-3">
                          <Image
                            src="/images/awp_boom_lift.jpg"
                            alt="Reach International equipment in operation"
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="260px"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <span className="absolute bottom-2 left-2 text-[11px] font-semibold uppercase tracking-wider text-white bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs">
                            AWP & MHE Fleet
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">Reaching All Heights</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            Certified boom lifts, scissor lifts, reach trucks & forklifts across India.
                          </p>
                        </div>
                        <NavigationMenuLink
                          render={
                            <Link
                              href="/equipment/"
                              className="mt-4 flex items-center justify-between text-xs font-medium text-accent-foreground hover:underline pt-2 border-t border-border"
                            />
                          }
                        >
                          <span>Browse all equipment</span>
                          <ChevronRight className="size-3.5" />
                        </NavigationMenuLink>
                      </div>

                      {/* Access Equipment Column */}
                      <div className="col-span-4">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground px-2 py-1.5 mb-1 border-b border-border">
                          Access Equipment
                        </div>
                        <ul className="space-y-1">
                          {equipmentLinks.access.map((item) => (
                            <li key={item.href}>
                              <NavigationMenuLink
                                render={
                                  <Link
                                    href={item.href}
                                    className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground block transition-colors group"
                                  />
                                }
                              >
                                <div className="text-sm font-medium text-foreground group-hover:text-accent-foreground">
                                  {item.label}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-1">{item.desc}</div>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Material Handling Column */}
                      <div className="col-span-4">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground px-2 py-1.5 mb-1 border-b border-border">
                          Material Handling
                        </div>
                        <ul className="space-y-1">
                          {equipmentLinks.mhe.map((item) => (
                            <li key={item.href}>
                              <NavigationMenuLink
                                render={
                                  <Link
                                    href={item.href}
                                    className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground block transition-colors group"
                                  />
                                }
                              >
                                <div className="text-sm font-medium text-foreground group-hover:text-accent-foreground">
                                  {item.label}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-1">{item.desc}</div>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Services Dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={pathname.startsWith('/services') ? 'text-foreground font-semibold' : ''}>
                    Services
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[340px] gap-2 p-3">
                      {serviceLinks.map((service) => {
                        const Icon = service.icon
                        return (
                          <li key={service.href}>
                            <NavigationMenuLink
                              render={
                                <Link
                                  href={service.href}
                                  className="flex items-start gap-3 p-2.5 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors group"
                                />
                              }
                            >
                              <div className="p-2 rounded-md bg-muted text-foreground group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground transition-colors shrink-0">
                                <Icon className="size-4" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-foreground group-hover:text-accent-foreground">
                                  {service.label}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">{service.desc}</div>
                              </div>
                            </NavigationMenuLink>
                          </li>
                        )
                      })}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* Industries Dropdown */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className={pathname.startsWith('/industries') ? 'text-foreground font-semibold' : ''}>
                    Industries
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-[480px] p-3">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border px-1">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                          Industries We Serve
                        </span>
                        <NavigationMenuLink
                          render={
                            <Link href="/industries/" className="text-xs font-medium text-accent-foreground hover:underline" />
                          }
                        >
                          View all
                        </NavigationMenuLink>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {industryLinks.map((ind) => {
                          const Icon = ind.icon
                          return (
                            <NavigationMenuLink
                              key={ind.href}
                              render={
                                <Link
                                  href={ind.href}
                                  className="flex items-start gap-2.5 p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors group"
                                />
                              }
                            >
                              <div className="p-1.5 rounded-md bg-muted text-foreground group-hover:bg-accent-foreground/10 group-hover:text-accent-foreground shrink-0 mt-0.5">
                                <Icon className="size-3.5" />
                              </div>
                              <div>
                                <div className="text-xs font-medium text-foreground group-hover:text-accent-foreground">
                                  {ind.label}
                                </div>
                                <div className="text-[11px] text-muted-foreground line-clamp-1">{ind.desc}</div>
                              </div>
                            </NavigationMenuLink>
                          )
                        })}
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                {/* About Link */}
                <NavigationMenuItem>
                  <NavigationMenuLink
                    render={
                      <Link
                        href="/about/"
                        className={navigationMenuTriggerStyle({
                          className: pathname.startsWith('/about') ? 'text-foreground font-semibold' : 'text-muted-foreground',
                        })}
                      />
                    }
                  >
                    About
                  </NavigationMenuLink>
                </NavigationMenuItem>

                {/* Contact Link */}
                <NavigationMenuItem>
                  <NavigationMenuLink
                    render={
                      <Link
                        href="/contact/"
                        className={navigationMenuTriggerStyle({
                          className: pathname.startsWith('/contact') ? 'text-foreground font-semibold' : 'text-muted-foreground',
                        })}
                      />
                    }
                  >
                    Contact
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>

              {/* Popup Positioner and Viewport */}
              <NavigationMenuPositioner className="z-50">
                <NavigationMenuPopup>
                  <NavigationMenuArrow />
                </NavigationMenuPopup>
              </NavigationMenuPositioner>
            </NavigationMenu>
          </nav>
        </div>

        {/* Right actions: ThemeToggle + Sign In + CTA + Mobile Hamburger */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          <Button
            href="/login"
            variant="ghost"
            size="md"
            className="hidden md:inline-flex rounded-full px-4 text-xs font-semibold"
          >
            Sign In
          </Button>

          <Button
            href="/request-a-quote/"
            color="primary"
            size="md"
            className="hidden sm:inline-flex rounded-full px-5 shadow-xs"
            iconTrailing={<ArrowRight className="size-4" />}
          >
            Request a Quote
          </Button>

          {/* Mobile hamburger button */}
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full transition-colors"
            style={{
              color: 'var(--text-primary)',
              backgroundColor: 'var(--surface-sunken)',
            }}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {/* Mobile full-screen navigation drawer */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 z-[60]"
            style={{ backgroundColor: 'var(--surface-overlay)' }}
          />
          <Dialog.Content
            className="fixed inset-y-0 right-0 z-[70] w-full max-w-sm flex flex-col overflow-y-auto"
            style={{ backgroundColor: 'var(--surface-base)' }}
            onEscapeKeyDown={() => setMobileOpen(false)}
          >
            <VisuallyHidden.Root>
              <Dialog.Title>Navigation menu</Dialog.Title>
            </VisuallyHidden.Root>

            {/* Mobile nav header */}
            <div
              className="flex items-center justify-between px-4 h-[72px] shrink-0"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <Dialog.Close asChild>
                <Link href="/" className="flex items-center shrink-0">
                  <ReachLogo height={40} />
                </Link>
              </Dialog.Close>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  className="flex items-center justify-center w-10 h-10 rounded-md"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <X className="size-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Mobile nav links */}
            <nav aria-label="Mobile navigation" className="flex-1 p-4 space-y-1">
              <div className="space-y-1 mb-4">
                <p className="text-overline uppercase tracking-widest px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Access Equipment
                </p>
                {equipmentLinks.access.map((item) => (
                  <Dialog.Close asChild key={item.href}>
                    <Link
                      href={item.href}
                      className="block px-3 py-2 rounded-md text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {item.label}
                    </Link>
                  </Dialog.Close>
                ))}
              </div>

              <div className="space-y-1 mb-4" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <p className="text-overline uppercase tracking-widest px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Material Handling
                </p>
                {equipmentLinks.mhe.map((item) => (
                  <Dialog.Close asChild key={item.href}>
                    <Link
                      href={item.href}
                      className="block px-3 py-2 rounded-md text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {item.label}
                    </Link>
                  </Dialog.Close>
                ))}
              </div>

              <div className="space-y-1 mb-4" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <p className="text-overline uppercase tracking-widest px-3 py-2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Services
                </p>
                {serviceLinks.map((service) => (
                  <Dialog.Close asChild key={service.href}>
                    <Link
                      href={service.href}
                      className="block px-3 py-2 rounded-md text-sm font-medium"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {service.label}
                    </Link>
                  </Dialog.Close>
                ))}
              </div>

              <div className="space-y-1" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <Dialog.Close asChild>
                  <Link
                    href="/industries/"
                    className="block px-3 py-2 rounded-md text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Industries
                  </Link>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <Link
                    href="/about/"
                    className="block px-3 py-2 rounded-md text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    About Us
                  </Link>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <Link
                    href="/contact/"
                    className="block px-3 py-2 rounded-md text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Contact
                  </Link>
                </Dialog.Close>
              </div>
            </nav>

            {/* Mobile CTA */}
            <div className="p-4 space-y-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <Dialog.Close asChild>
                <Button
                  href="/request-a-quote/"
                  color="primary"
                  size="lg"
                  className="w-full rounded-xl"
                  iconTrailing={<ArrowRight className="size-4" />}
                >
                  Request a quote
                </Button>
              </Dialog.Close>
              <Dialog.Close asChild>
                <Button
                  href="/login"
                  variant="outline"
                  size="lg"
                  className="w-full rounded-xl"
                >
                  Sign In to Portal
                </Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  )
}
