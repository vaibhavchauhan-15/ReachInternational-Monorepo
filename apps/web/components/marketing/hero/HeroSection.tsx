'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ShieldCheck,
  Clock,
  MapPin,
  Headphones,
  ArrowRight,
  ChevronRight,
  Forklift,
} from 'lucide-react'
import { Button } from '@/components/marketing/ui/button'

/**
 * Custom boom lift silhouette icon matching the industrial equipment silhouette.
 */
function BoomLiftIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="5" cy="18" r="2" />
      <circle cx="15" cy="18" r="2" />
      <line x1="7" y1="18" x2="13" y2="18" />
      <path d="M4 16h13v-3H8l-4 3z" />
      <polyline points="9 13 14 8 20 8" />
      <rect x="18" y="4" width="4" height="4" rx="0.5" />
      <line x1="18" y1="6" x2="22" y2="6" />
    </svg>
  )
}

/**
 * 4 Key value propositions shown beneath the CTA buttons.
 */
const trustPillars = [
  {
    icon: ShieldCheck,
    title: 'Safe & Reliable',
    subtitle: 'Well-maintained fleet',
  },
  {
    icon: Clock,
    title: 'On-Time Delivery',
    subtitle: 'When you need it',
  },
  {
    icon: MapPin,
    title: 'Pan India',
    subtitle: 'Wide service network',
  },
  {
    icon: Headphones,
    title: 'Expert Support',
    subtitle: 'Always with you',
  },
]

export function HeroSection() {
  return (
    <section
      aria-label="Hero — The Right Equipment for Every Project"
      className="relative w-full min-h-[600px] md:min-h-[640px] lg:min-h-[680px] xl:min-h-[720px] pt-24 pb-12 md:pt-28 md:pb-14 lg:pt-30 lg:pb-16 flex flex-col justify-center overflow-hidden transition-colors"
      style={{
        backgroundColor: 'var(--surface-base)',
      }}
    >
      {/* ── Background Layer: Perfectly Framed JCB Boom Lift Scene ── */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        {/* Full-bleed desktop panoramic machine visual with grounded wheels and ground clearance */}
        <div className="absolute inset-0 hidden lg:block select-none pointer-events-none">
          <Image
            src="/images/hero_jcb_boom_lift_v3.jpg"
            alt="JCB industrial articulated boom lift working at infrastructure project site"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[75%_55%] xl:object-[73%_55%] 2xl:object-[70%_55%] select-none pointer-events-none"
          />
        </div>

        {/* Desktop Light theme scrim: smooth horizontal fade leaving the machine completely unobscured */}
        <div
          className="absolute inset-0 hidden lg:block pointer-events-none transition-opacity duration-300 dark:opacity-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 0.92) 36%, rgba(255, 255, 255, 0.65) 52%, rgba(255, 255, 255, 0.15) 68%, rgba(255, 255, 255, 0) 82%)',
          }}
        />

        {/* Desktop Dark theme scrim: atmospheric evening contrast */}
        <div
          className="absolute inset-0 hidden lg:block pointer-events-none opacity-0 dark:opacity-100 transition-opacity duration-300"
          style={{
            background:
              'linear-gradient(90deg, rgba(15, 18, 21, 0.98) 0%, rgba(15, 18, 21, 0.92) 38%, rgba(15, 18, 21, 0.65) 55%, rgba(15, 18, 21, 0.20) 72%, rgba(15, 18, 21, 0) 85%)',
          }}
        />

        {/* Overall subtle dark mode grade */}
        <div className="absolute inset-0 bg-black/35 opacity-0 dark:opacity-100 pointer-events-none transition-opacity duration-300" />
      </div>

      {/* ── Branded Angular Polygon Accent (Bottom Left) ── */}
      <div
        className="absolute bottom-0 left-0 w-36 h-36 sm:w-52 sm:h-52 lg:w-72 lg:h-72 pointer-events-none z-10 select-none overflow-hidden"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full opacity-90 dark:opacity-80 transition-opacity"
          preserveAspectRatio="none"
        >
          <polygon points="0,200 200,200 0,60" fill="url(#hero-blue-facet-1)" />
          <polygon points="0,200 130,200 0,110" fill="url(#hero-blue-facet-2)" />
          <defs>
            <linearGradient id="hero-blue-facet-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#008CFC" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0066CC" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="hero-blue-facet-2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#008CFC" stopOpacity="1" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* ── Main Hero Content (Copy, Actions, Trust Pillars, Right Column Cards) ── */}
      <div className="relative z-10 w-full max-w-wide mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Copy, Actions & Trust Pillars */}
          <div className="lg:col-span-7 flex flex-col justify-center max-w-2xl lg:max-w-none">
            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-slate-900 dark:text-white">
              The Right Equipment <br />
              <span className="text-[#008CFC]">for Every Project.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl text-slate-700 dark:text-slate-300 font-normal">
              We provide reliable rental and sales solutions for aerial work platforms,
              material handling equipment, and access solutions — helping your projects
              move forward, safely and efficiently across India.
            </p>

            {/* Pill Action Buttons */}
            <div className="flex flex-wrap items-center gap-4">
              <Button
                href="/request-a-quote/"
                color="primary"
                size="lg"
                className="rounded-full px-7 py-3 text-base font-semibold shadow-md shadow-[#008CFC]/25 hover:shadow-lg transition-all group"
                iconTrailing={<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
              >
                Request a Quote
              </Button>

              <Link
                href="/equipment/"
                className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-base font-semibold transition-all backdrop-blur-md bg-white/90 hover:bg-white text-slate-800 border border-slate-200/90 shadow-xs dark:bg-white/10 dark:hover:bg-white/15 dark:text-white dark:border-white/20 active:scale-95 group"
              >
                <span>Explore Equipment</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* ── 4 Key Trust Pillars (placed directly below CTA buttons per feedback) ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-6 sm:pt-8 mt-8 sm:mt-10 border-t border-slate-300/60 dark:border-white/15">
              {trustPillars.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/60 text-[#008CFC] border border-blue-100 dark:border-blue-800/40">
                      <Icon className="size-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {item.title}
                      </span>
                      <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-tight mt-1">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Mobile/Tablet Dedicated Visual Showcase ── */}
            <div className="lg:hidden mt-8 w-full">
              <div className="relative w-full aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-slate-200/90 dark:border-white/10 bg-slate-100 dark:bg-[#14181f]">
                <Image
                  src="/images/hero_jcb_boom_lift_v3.jpg"
                  alt="JCB industrial articulated boom lift working at infrastructure project site"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-[70%_center]"
                />
                
                {/* Subtle gradient wash over bottom of mobile card */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />

                {/* Floating AWP & MHE Badges on Mobile Card */}
                <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:bottom-4 sm:right-auto flex flex-wrap sm:flex-nowrap gap-2">
                  <Link
                    href="/equipment/aerial-work-platforms/"
                    aria-label="Explore Aerial Work Platforms (AWP)"
                    className="inline-flex items-center gap-2 p-2 px-3 rounded-xl bg-white/95 dark:bg-[#1a1e24]/90 backdrop-blur-md border border-white/70 dark:border-white/10 shadow-lg text-slate-900 dark:text-white flex-1 sm:flex-initial"
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/70 border border-blue-100 dark:border-blue-900/50 text-[#008CFC]">
                      <BoomLiftIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0 pr-1">
                      <h4 className="text-xs font-bold leading-tight truncate">
                        AWP
                      </h4>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                        Aerial Platforms
                      </p>
                    </div>
                    <ChevronRight className="size-3.5 text-[#008CFC] dark:text-blue-400 shrink-0 ml-auto" />
                  </Link>

                  <Link
                    href="/equipment/material-handling/"
                    aria-label="Explore Material Handling Equipment (MHE)"
                    className="inline-flex items-center gap-2 p-2 px-3 rounded-xl bg-white/95 dark:bg-[#1a1e24]/90 backdrop-blur-md border border-white/70 dark:border-white/10 shadow-lg text-slate-900 dark:text-white flex-1 sm:flex-initial"
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/70 border border-blue-100 dark:border-blue-900/50 text-[#008CFC]">
                      <Forklift className="size-3.5" />
                    </div>
                    <div className="min-w-0 pr-1">
                      <h4 className="text-xs font-bold leading-tight truncate">
                        MHE
                      </h4>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                        Material Handling
                      </p>
                    </div>
                    <ChevronRight className="size-3.5 text-[#008CFC] dark:text-blue-400 shrink-0 ml-auto" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (Desktop): Floating AWP & MHE Category Cards */}
          <div className="hidden lg:flex lg:col-span-5 flex-col items-end justify-center gap-3.5">
            <Link
              href="/equipment/aerial-work-platforms/"
              aria-label="Explore Aerial Work Platforms (AWP)"
              className="group flex items-center gap-3.5 p-3 px-5 rounded-full bg-white/95 dark:bg-[#1a1e24]/90 backdrop-blur-md border border-white/70 dark:border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer min-w-[270px]"
            >
              {/* Icon Container */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/70 border border-blue-100 dark:border-blue-900/50 text-[#008CFC]">
                <BoomLiftIcon className="size-5" />
              </div>

              {/* Title & Description */}
              <div className="flex-1 pr-2">
                <h4 className="text-sm font-bold leading-tight text-slate-900 dark:text-white group-hover:text-[#008CFC] transition-colors">
                  AWP
                </h4>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                  Aerial Work Platforms
                </p>
              </div>

              {/* Circle Action Button */}
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-50 dark:bg-white/10 text-[#008CFC] dark:text-blue-400 group-hover:bg-[#008CFC] group-hover:text-white transition-colors">
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/equipment/material-handling/"
              aria-label="Explore Material Handling Equipment (MHE)"
              className="group flex items-center gap-3.5 p-3 px-5 rounded-full bg-white/95 dark:bg-[#1a1e24]/90 backdrop-blur-md border border-white/70 dark:border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer min-w-[270px]"
            >
              {/* Icon Container */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-blue-50 dark:bg-blue-950/70 border border-blue-100 dark:border-blue-900/50 text-[#008CFC]">
                <Forklift className="size-5" />
              </div>

              {/* Title & Description */}
              <div className="flex-1 pr-2">
                <h4 className="text-sm font-bold leading-tight text-slate-900 dark:text-white group-hover:text-[#008CFC] transition-colors">
                  MHE
                </h4>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                  Material Handling Equipment
                </p>
              </div>

              {/* Circle Action Button */}
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-50 dark:bg-white/10 text-[#008CFC] dark:text-blue-400 group-hover:bg-[#008CFC] group-hover:text-white transition-colors">
                <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

