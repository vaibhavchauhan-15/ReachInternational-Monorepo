'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { AnimatePresence, motion } from 'framer-motion'
import { ThemeToggle } from './ThemeToggle'
import { ReachLogo } from '@/components/branding/ReachLogo'
import { Button } from '@/components/marketing/ui/button'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Menu,
  X,
  Truck,
  Wrench,
  Lock,
  ChevronRight,
  ChevronDown,
} from 'lucide-react'
import { LiquidMetalButton } from '@/components/ui/liquid-metal-button'

// ============================================================================
// Navigation Link Definitions
// ============================================================================

const equipmentLinks = {
  access: [
    { href: '/equipment/awp/boom-lifts', label: 'Boom Lifts', desc: 'Articulated and telescopic heavy reach.' },
    { href: '/equipment/awp/scissor-lifts', label: 'Scissor Lifts', desc: 'Electric and rough-terrain slab lifts.' },
    { href: '/equipment/awp/vertical-mast-lifts', label: 'Vertical Mast Lifts', desc: 'Zero-tailswing indoor solutions.' },
    { href: '/equipment/awp', label: 'All AWP Platforms', desc: 'Tracked crawlers for sensitive floors.' },
  ],
  mhe: [
    { href: '/equipment/mhe/forklifts', label: 'Forklifts', desc: 'Diesel, LPG and electric counterbalanced.' },
    { href: '/equipment/mhe/reach-trucks', label: 'Reach Trucks', desc: 'Narrow-aisle high-density stacking.' },
    { href: '/equipment/awp/material-lifts', label: 'Material Lifts', desc: 'Compact portable crank lifts.' },
    { href: '/equipment/mhe', label: 'All MHE Fleet', desc: 'Modular mobile tower systems.' },
  ],
}

const serviceLinks = [
  {
    href: '/#quote-promo',
    label: 'Equipment Rental',
    desc: 'Flexible short & long term rental across India.',
    icon: Truck,
  },
  {
    href: '/#quote-promo',
    label: 'Equipment Sales',
    desc: 'New and certified pre-owned heavy machinery.',
    icon: Wrench,
  },
]

type ActiveMenu = 'equipment' | 'services' | null

// ============================================================================
// Main Navigation Component
// ============================================================================

export function Navigation() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null)

  // Mobile accordion states
  const [mobileEquipmentOpen, setMobileEquipmentOpen] = useState(false)
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false)

  const headerRef = useRef<HTMLElement>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastMouseEnterTimeRef = useRef<number>(0)
  const isClickToggleRef = useRef<boolean>(false)

  // Clear pending close timeout
  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  // Schedule menu close after short delay for seamless diagonal hover movement
  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null)
      isClickToggleRef.current = false
    }, 180)
  }, [cancelClose])

  // Open menu on hover
  const handleMouseEnter = useCallback((menu: ActiveMenu) => {
    cancelClose()
    lastMouseEnterTimeRef.current = Date.now()
    setActiveMenu(menu)
  }, [cancelClose])

  // Toggle menu on click/press (handles mouse click, touch tap, and deliberate toggling)
  const handleTriggerClick = useCallback((menu: ActiveMenu) => {
    cancelClose()
    const now = Date.now()
    const timeSinceHover = now - lastMouseEnterTimeRef.current

    setActiveMenu((prev) => {
      // If menu is closed, open it
      if (prev !== menu) {
        isClickToggleRef.current = true
        return menu
      }
      // If it was just opened by mouseenter within 400ms, keep it open (user clicked to open it)
      if (timeSinceHover < 400 && !isClickToggleRef.current) {
        isClickToggleRef.current = true
        return menu
      }
      // Otherwise toggle closed
      isClickToggleRef.current = false
      return null
    })
  }, [cancelClose])

  // Close menus when clicking outside
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setActiveMenu(null)
        isClickToggleRef.current = false
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenu(null)
        setMobileOpen(false)
        isClickToggleRef.current = false
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Close menus on route change
  useEffect(() => {
    setActiveMenu(null)
    setMobileOpen(false)
    isClickToggleRef.current = false
  }, [pathname])

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

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  return (
    <header
      ref={headerRef}
      className="fixed top-0 left-0 right-0 z-50 transition-colors backdrop-blur-xl bg-white/80 dark:bg-[#0a0a0a]/80 border-b border-black/[0.06] dark:border-white/[0.08] shadow-xs"
    >
      <div className="h-[72px] max-w-wide mx-auto px-4 md:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand Logo & Desktop/Laptop Navigation */}
        <div className="flex items-center gap-6 xl:gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setActiveMenu(null)}
          >
            <ReachLogo height={48} priority />
          </Link>

          {/* Desktop & Laptop Navigation Menu */}
          <nav aria-label="Primary navigation" className="hidden lg:flex items-center relative">
            <ul className="flex items-center gap-1 list-none m-0 p-0">
              {/* Home Link */}
              <li>
                <Link
                  href="/"
                  className={cn(
                    'inline-flex h-9 items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none',
                    pathname === '/' ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                  onClick={() => setActiveMenu(null)}
                >
                  Home
                </Link>
              </li>

              {/* Equipment Trigger */}
              <li
                className="relative"
                onMouseEnter={() => handleMouseEnter('equipment')}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  aria-expanded={activeMenu === 'equipment'}
                  aria-haspopup="true"
                  onClick={() => handleTriggerClick('equipment')}
                  className={cn(
                    'group inline-flex h-9 items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition-all select-none',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none',
                    'active:scale-[0.98]',
                    activeMenu === 'equipment'
                      ? 'bg-accent text-accent-foreground font-semibold shadow-xs'
                      : pathname.startsWith('/equipment')
                        ? 'text-foreground font-semibold'
                        : 'text-muted-foreground'
                  )}
                >
                  <span>Equipment</span>
                  <ChevronDown
                    className={cn(
                      'ms-1 size-3.5 transition-transform duration-200 text-muted-foreground group-hover:text-foreground',
                      activeMenu === 'equipment' && 'rotate-180 text-foreground'
                    )}
                    aria-hidden="true"
                  />
                </button>
              </li>

              {/* Services Trigger */}
              <li
                className="relative"
                onMouseEnter={() => handleMouseEnter('services')}
                onMouseLeave={scheduleClose}
              >
                <button
                  type="button"
                  aria-expanded={activeMenu === 'services'}
                  aria-haspopup="true"
                  onClick={() => handleTriggerClick('services')}
                  className={cn(
                    'group inline-flex h-9 items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition-all select-none',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none',
                    'active:scale-[0.98]',
                    activeMenu === 'services'
                      ? 'bg-accent text-accent-foreground font-semibold shadow-xs'
                      : pathname.startsWith('/services')
                        ? 'text-foreground font-semibold'
                        : 'text-muted-foreground'
                  )}
                >
                  <span>Services</span>
                  <ChevronDown
                    className={cn(
                      'ms-1 size-3.5 transition-transform duration-200 text-muted-foreground group-hover:text-foreground',
                      activeMenu === 'services' && 'rotate-180 text-foreground'
                    )}
                    aria-hidden="true"
                  />
                </button>
              </li>

              {/* About Link */}
              <li>
                <Link
                  href="/about/"
                  className={cn(
                    'inline-flex h-9 items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none',
                    pathname.startsWith('/about') ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                  onClick={() => setActiveMenu(null)}
                >
                  About
                </Link>
              </li>

              {/* Contact Link */}
              <li>
                <Link
                  href="/contact/"
                  className={cn(
                    'inline-flex h-9 items-center justify-center rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none',
                    pathname.startsWith('/contact') ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                  onClick={() => setActiveMenu(null)}
                >
                  Contact
                </Link>
              </li>
            </ul>

            {/* ============================================================== */}
            {/* Desktop & Laptop Dropdown Panels (RENDERED ONLY WHEN ACTIVE)    */}
            {/* ============================================================== */}
            <AnimatePresence>
              {activeMenu && (
                <motion.div
                  key="dropdown-panel"
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={cancelClose}
                  onMouseLeave={scheduleClose}
                  className="absolute top-[calc(100%+8px)] z-50 rounded-xl overflow-hidden pointer-events-auto bg-white dark:bg-[#171717] text-foreground border border-border shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
                  style={{
                    backgroundColor: 'var(--surface-elevated)',
                    // Positioning: Equipment starts near nav start; Services aligns gracefully
                    left: activeMenu === 'equipment' ? '0' : '84px',
                  }}
                >
                  {/* Invisible bridge to prevent pointer gap hover dropouts */}
                  <div className="absolute -top-3 left-0 right-0 h-3" />

                  {/* 1. EQUIPMENT MEGA-MENU */}
                  {activeMenu === 'equipment' && (
                    <div className="grid grid-cols-12 gap-5 p-4 w-[760px] xl:w-[840px] max-w-[calc(100vw-48px)]">
                      {/* Featured Visual Card */}
                      <div className="col-span-4 rounded-lg overflow-hidden border border-border bg-muted/30 p-3.5 flex flex-col justify-between relative group">
                        <div className="relative h-28 w-full rounded-md overflow-hidden mb-3">
                          <Image
                            src="/images/awp_boom_lift.jpg"
                            alt="Reach International equipment in operation"
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="260px"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          <span className="absolute bottom-2 left-2 text-[10px] font-semibold uppercase tracking-wider text-white bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs">
                            AWP & MHE Fleet
                          </span>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-foreground">Reaching All Heights</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            Certified boom lifts, scissor lifts, reach trucks & forklifts across India.
                          </p>
                        </div>
                        <Link
                          href="/#awp-section"
                          onClick={() => setActiveMenu(null)}
                          className="mt-3.5 flex items-center justify-between text-xs font-semibold text-primary hover:underline pt-2.5 border-t border-border"
                        >
                          <span>Browse all equipment</span>
                          <ChevronRight className="size-3.5" />
                        </Link>
                      </div>

                      {/* Access Equipment Column */}
                      <div className="col-span-4">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground px-2.5 py-1.5 mb-1.5 border-b border-border">
                          Access Equipment
                        </div>
                        <ul className="space-y-1">
                          {equipmentLinks.access.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setActiveMenu(null)}
                                className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground block transition-colors group"
                              >
                                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  {item.label}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-1">{item.desc}</div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Material Handling Column */}
                      <div className="col-span-4">
                        <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground px-2.5 py-1.5 mb-1.5 border-b border-border">
                          Material Handling
                        </div>
                        <ul className="space-y-1">
                          {equipmentLinks.mhe.map((item) => (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setActiveMenu(null)}
                                className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground block transition-colors group"
                              >
                                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  {item.label}
                                </div>
                                <div className="text-xs text-muted-foreground line-clamp-1">{item.desc}</div>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* 2. SERVICES DROPDOWN */}
                  {activeMenu === 'services' && (
                    <div className="w-[360px] p-3">
                      <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground px-2.5 py-1.5 mb-1.5 border-b border-border">
                        Our Services
                      </div>
                      <ul className="space-y-1.5">
                        {serviceLinks.map((service) => {
                          const Icon = service.icon
                          return (
                            <li key={service.href}>
                              <Link
                                href={service.href}
                                onClick={() => setActiveMenu(null)}
                                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors group"
                              >
                                <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0 mt-0.5">
                                  <Icon className="size-4" />
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                    {service.label}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                    {service.desc}
                                  </div>
                                </div>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        </div>

        {/* Right Actions: ThemeToggle + Staff Portal + Request a Quote (Liquid Metal CTA) + Mobile Hamburger */}
        <div className="flex items-center gap-2.5">
          <ThemeToggle />

          {/* Discreet Staff Portal link: Clean, low-friction UX that clients naturally ignore */}
          <Link
            href="/login"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary select-none"
            title="Staff & Employee Portal"
            aria-label="Staff and Employee Portal Login"
          >
            <Lock className="size-3 text-muted-foreground/70" />
            <span>Staff Portal</span>
          </Link>

          {/* Premium Liquid Metal CTA for Clients */}
          <div className="hidden sm:inline-flex items-center">
            <LiquidMetalButton
              href="/request-a-quote/"
              label="Request a Quote"
              icon={<ArrowRight className="size-3.5" />}
            />
          </div>

          {/* Mobile hamburger button */}
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full transition-all active:scale-95"
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

      {/* ============================================================== */}
      {/* Mobile Navigation Drawer (Optimized for Mobile & Touch)        */}
      {/* ============================================================== */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 z-[60] backdrop-blur-xs transition-opacity"
            style={{ backgroundColor: 'var(--surface-overlay)' }}
          />
          <Dialog.Content
            className="fixed inset-y-0 right-0 z-[70] w-full max-w-sm flex flex-col overflow-y-auto shadow-2xl focus:outline-none"
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
                  className="flex items-center justify-center w-10 h-10 rounded-full transition-colors active:scale-95"
                  style={{
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--surface-sunken)',
                  }}
                >
                  <X className="size-5" />
                </button>
              </Dialog.Close>
            </div>

            {/* Mobile Nav Accordion Links */}
            <nav aria-label="Mobile navigation" className="flex-1 p-4 space-y-2">
              {/* Home */}
              <Dialog.Close asChild>
                <Link
                  href="/"
                  className={cn(
                    'flex items-center min-h-[44px] px-3.5 rounded-xl text-sm font-semibold transition-colors',
                    pathname === '/' ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted active:bg-muted/70'
                  )}
                >
                  Home
                </Link>
              </Dialog.Close>

              {/* 1. Equipment Accordion */}
              <div className="rounded-xl border border-border/80 overflow-hidden bg-white dark:bg-[#171717]">
                <button
                  type="button"
                  onClick={() => setMobileEquipmentOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3.5 min-h-[48px] py-2.5 text-sm font-semibold text-foreground select-none transition-colors hover:bg-muted active:bg-muted/70"
                >
                  <div className="flex items-center gap-2">
                    <span>Equipment</span>
                    <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      8 Models
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'size-4 text-muted-foreground transition-transform duration-200',
                      mobileEquipmentOpen && 'rotate-180'
                    )}
                  />
                </button>

                <AnimatePresence>
                  {mobileEquipmentOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-border bg-muted/20"
                    >
                      <div className="p-3 space-y-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2 py-1">
                            Access Equipment
                          </p>
                          <div className="space-y-0.5">
                            {equipmentLinks.access.map((item) => (
                              <Dialog.Close asChild key={item.href}>
                                <Link
                                  href={item.href}
                                  className="block px-2.5 py-2.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors min-h-[44px] flex items-center"
                                >
                                  {item.label}
                                </Link>
                              </Dialog.Close>
                            ))}
                          </div>
                        </div>

                        <div className="border-t border-border/60 pt-2">
                          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2 py-1">
                            Material Handling
                          </p>
                          <div className="space-y-0.5">
                            {equipmentLinks.mhe.map((item) => (
                              <Dialog.Close asChild key={item.href}>
                                <Link
                                  href={item.href}
                                  className="block px-2.5 py-2.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors min-h-[44px] flex items-center"
                                >
                                  {item.label}
                                </Link>
                              </Dialog.Close>
                            ))}
                          </div>
                        </div>

                        <Dialog.Close asChild>
                          <Link
                            href="/#awp-section"
                            className="flex items-center justify-between px-2.5 py-2.5 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors border-t border-border min-h-[44px]"
                          >
                            <span>Browse all equipment</span>
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Dialog.Close>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 2. Services Accordion */}
              <div className="rounded-xl border border-border/80 overflow-hidden bg-white dark:bg-[#171717]">
                <button
                  type="button"
                  onClick={() => setMobileServicesOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3.5 min-h-[48px] py-2.5 text-sm font-semibold text-foreground select-none transition-colors hover:bg-muted active:bg-muted/70"
                >
                  <span>Services</span>
                  <ChevronDown
                    className={cn(
                      'size-4 text-muted-foreground transition-transform duration-200',
                      mobileServicesOpen && 'rotate-180'
                    )}
                  />
                </button>

                <AnimatePresence>
                  {mobileServicesOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-border bg-muted/20"
                    >
                      <div className="p-2 space-y-1">
                        {serviceLinks.map((service) => {
                          const Icon = service.icon
                          return (
                            <Dialog.Close asChild key={service.href}>
                              <Link
                                href={service.href}
                                className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg hover:bg-muted transition-colors min-h-[44px]"
                              >
                                <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                                  <Icon className="size-4" />
                                </div>
                                <div>
                                  <div className="text-xs font-semibold text-foreground">{service.label}</div>
                                  <div className="text-[11px] text-muted-foreground">{service.desc}</div>
                                </div>
                              </Link>
                            </Dialog.Close>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Direct Links: About Us & Contact */}
              <Dialog.Close asChild>
                <Link
                  href="/about/"
                  className={cn(
                    'flex items-center min-h-[44px] px-3.5 rounded-xl text-sm font-semibold transition-colors',
                    pathname.startsWith('/about') ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted active:bg-muted/70'
                  )}
                >
                  About Us
                </Link>
              </Dialog.Close>

              <Dialog.Close asChild>
                <Link
                  href="/contact/"
                  className={cn(
                    'flex items-center min-h-[44px] px-3.5 rounded-xl text-sm font-semibold transition-colors',
                    pathname.startsWith('/contact') ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted active:bg-muted/70'
                  )}
                >
                  Contact
                </Link>
              </Dialog.Close>
            </nav>

            {/* Mobile Drawer CTAs */}
            <div className="p-4 space-y-3 shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <Dialog.Close asChild>
                <Button
                  href="/request-a-quote/"
                  color="primary"
                  size="lg"
                  className="w-full rounded-xl shadow-xs min-h-[48px]"
                  iconTrailing={<ArrowRight className="size-4" />}
                >
                  Request a quote
                </Button>
              </Dialog.Close>

              <div className="pt-1 text-center">
                <Dialog.Close asChild>
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Staff and Employee Portal Login"
                  >
                    <Lock className="size-3.5 text-muted-foreground/70" />
                    <span>Staff & Employee Portal</span>
                  </Link>
                </Dialog.Close>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  )
}
