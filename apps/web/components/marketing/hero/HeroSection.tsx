'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/marketing/ui/button'

export function HeroSection() {
  return (
    <section
      aria-label="Hero — The Right Equipment for Every Project"
      className="relative w-full -mt-[72px] pt-[72px] pb-16 sm:pb-20 lg:pt-0 lg:pb-0 lg:h-screen lg:min-h-[660px] lg:max-h-[920px] flex flex-col justify-start lg:justify-center overflow-hidden transition-colors"
      style={{
        backgroundColor: 'var(--surface-base)',
      }}
    >
      {/* ── Background Layer: Full-Bleed Machine Fleet Scene ── */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        {/* Desktop & Tablet Panoramic Image (16:9 Landscape) */}
        <div className="absolute inset-0 hidden sm:block select-none pointer-events-none">
          <Image
            src="/images/hero_fleet_desktop_v4.jpg"
            alt="Reach International heavy machinery fleet: JLG articulated boom lift, electric scissor lift and forklift on logistics apron"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[76%_bottom] md:object-[78%_bottom] lg:object-[82%_bottom] xl:object-[80%_bottom] select-none pointer-events-none"
          />
        </div>

        {/* Mobile Portrait Image (9:16 Vertical) */}
        <div className="absolute inset-0 block sm:hidden select-none pointer-events-none">
          <Image
            src="/images/hero_fleet_mobile_v4.jpg"
            alt="Reach International heavy machinery fleet: vertical view of JLG boom lift, scissor lift and forklift"
            fill
            priority
            sizes="100vw"
            className="object-cover object-bottom select-none pointer-events-none"
          />
        </div>

        {/* Desktop Light theme scrim: subtle horizontal translucent gradient for copy legibility */}
        <div
          className="absolute inset-0 hidden lg:block pointer-events-none transition-opacity duration-300 dark:opacity-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.90) 30%, rgba(255, 255, 255, 0.58) 50%, rgba(255, 255, 255, 0.15) 70%, transparent 88%)',
          }}
        />

        {/* Mobile & Tablet Light theme scrim: vertical fade for copy legibility */}
        <div
          className="absolute inset-0 lg:hidden pointer-events-none transition-opacity duration-300 dark:opacity-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 255, 255, 0.97) 0%, rgba(255, 255, 255, 0.93) 38%, rgba(255, 255, 255, 0.80) 58%, rgba(255, 255, 255, 0.35) 78%, transparent 100%)',
          }}
        />

        {/* Desktop Dark theme scrim: atmospheric evening contrast */}
        <div
          className="absolute inset-0 hidden lg:block pointer-events-none opacity-0 dark:opacity-100 transition-opacity duration-300"
          style={{
            background:
              'linear-gradient(90deg, rgba(10, 10, 10, 0.96) 0%, rgba(10, 10, 10, 0.90) 30%, rgba(10, 10, 10, 0.58) 50%, rgba(10, 10, 10, 0.18) 72%, transparent 88%)',
          }}
        />

        {/* Mobile & Tablet Dark theme scrim */}
        <div
          className="absolute inset-0 lg:hidden pointer-events-none opacity-0 dark:opacity-100 transition-opacity duration-300"
          style={{
            background:
              'linear-gradient(180deg, rgba(10, 10, 10, 0.97) 0%, rgba(10, 10, 10, 0.93) 38%, rgba(10, 10, 10, 0.78) 58%, rgba(10, 10, 10, 0.30) 80%, transparent 100%)',
          }}
        />

        {/* Overall subtle dark mode grade */}
        <div className="absolute inset-0 bg-black/25 opacity-0 dark:opacity-100 pointer-events-none transition-opacity duration-300" />
      </div>

      {/* ── Main Hero Content ── */}
      <div className="relative z-10 w-full max-w-wide mx-auto px-4 md:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-0">
        <div className="max-w-2xl lg:max-w-xl xl:max-w-2xl flex flex-col justify-start">
          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-extrabold tracking-[-0.035em] leading-[1.08] mb-4 sm:mb-5 text-slate-900 dark:text-white">
            The Right Equipment <br />
            <span className="text-[#0284c7] dark:text-[#38bdf8]">for Every Project.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base lg:text-lg leading-relaxed mb-6 sm:mb-8 text-slate-800 dark:text-slate-200 font-medium sm:font-normal">
            We provide reliable rental and sales solutions for aerial work platforms,
            material handling equipment, and access solutions — helping your projects
            move forward, safely and efficiently across India.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 sm:gap-4">
            <Button
              href="/request-a-quote/"
              color="primary"
              size="lg"
              className="rounded-full px-7 py-3.5 text-sm sm:text-base font-semibold shadow-lg shadow-[#0284c7]/25 hover:shadow-xl hover:shadow-[#0284c7]/35 transition-all group cursor-pointer"
              iconTrailing={<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}
            >
              Request a Quote
            </Button>

            <Link
              href="/equipment/"
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm sm:text-base font-semibold transition-all backdrop-blur-md bg-white/90 hover:bg-white text-slate-800 border border-slate-200/90 shadow-xs dark:bg-white/10 dark:hover:bg-white/15 dark:text-white dark:border-white/20 active:scale-95 group cursor-pointer"
            >
              <span>Explore Fleet</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
