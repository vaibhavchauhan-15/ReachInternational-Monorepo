'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { InfiniteSlider } from '@/components/ui/infinite-slider';
import { cn } from '@/lib/utils';

export interface OemBrand {
  name: string;
  category: string;
  logoSrc: string;
  darkLogoSrc?: string;
  badgeAccent?: string;
}

export const partnerBrands: OemBrand[] = [
  {
    name: 'JCB',
    category: 'Aerial & Earthmoving Access',
    logoSrc: '/images/brands/jcb_v3.svg',
    darkLogoSrc: '/images/brands/jcb_dark_v3.svg',
    badgeAccent: '#FCAF26',
  },
  {
    name: 'Toyota',
    category: 'Material Handling Equipment',
    logoSrc: '/images/brands/toyota_v3.svg',
    darkLogoSrc: '/images/brands/toyota_dark_v3.svg',
    badgeAccent: '#EB0A1E',
  },
  {
    name: 'Hyundai',
    category: 'Heavy Material Handling',
    logoSrc: '/images/brands/hyundai_v3.svg',
    darkLogoSrc: '/images/brands/hyundai_dark_v3.svg',
    badgeAccent: '#003984',
  },
  {
    name: 'JLG',
    category: 'Aerial Work Platforms',
    logoSrc: '/images/brands/jlg_v3.svg',
    darkLogoSrc: '/images/brands/jlg_dark_v3.svg',
    badgeAccent: '#F35C17',
  },
  {
    name: 'Genie',
    category: 'Self-Propelled Access',
    logoSrc: '/images/brands/genie_v3.png',
    darkLogoSrc: '/images/brands/genie_dark_v3.png',
    badgeAccent: '#0060A9',
  },
  {
    name: 'BYD',
    category: 'Lithium-Ion Electric MHE',
    logoSrc: '/images/brands/byd_v3.svg',
    darkLogoSrc: '/images/brands/byd_dark_v3.svg',
    badgeAccent: '#E60012',
  },
];

// Column 1: normal order [JCB, Toyota, Hyundai, JLG, Genie, BYD]
const column1Brands = partnerBrands;

// Column 2: opposite position (reversed order) [BYD, Genie, JLG, Hyundai, Toyota, JCB]
const column2Brands = [...partnerBrands].reverse();

export function OemPartnerLogoCard({ brand }: { brand: OemBrand }) {
  return (
    <div
      className={cn(
        'group/brand relative flex items-center justify-center select-none cursor-default',
        'w-[145px] sm:w-[190px] md:w-[240px] lg:w-[290px]',
        'h-[95px] sm:h-[115px] md:h-[135px] lg:h-[150px]',
        'p-4 sm:p-5 md:p-6 lg:p-7 rounded-2xl md:rounded-3xl',
        'border border-[var(--border-subtle)] bg-[var(--surface-base)] dark:bg-[var(--surface-raised)]',
        'shadow-2xs transition-all duration-300',
        'hover:shadow-xl hover:border-[var(--brand-blue)]/60 hover:-translate-y-0.5'
      )}
      aria-label={`${brand.name} Authorized OEM Equipment Partner`}
    >
      {/* Subtle brand glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl md:rounded-3xl opacity-0 group-hover/brand:opacity-100 transition-opacity duration-300 blur-md"
        style={{
          background: `radial-gradient(circle at center, ${brand.badgeAccent || 'var(--brand-blue)'}18, transparent 72%)`,
        }}
        aria-hidden="true"
      />

      {/* Light Theme Logo */}
      <Image
        src={brand.logoSrc}
        alt={`${brand.name} OEM Partner`}
        width={190}
        height={65}
        className={cn(
          'brand-logo-on-light h-9 sm:h-11 md:h-13 lg:h-16 w-auto max-w-[85%] object-contain select-none pointer-events-none transition-transform duration-300 group-hover/brand:scale-105',
          brand.darkLogoSrc ? 'dark:hidden' : ''
        )}
        draggable={false}
      />

      {/* Dark Theme Logo */}
      {brand.darkLogoSrc && (
        <Image
          src={brand.darkLogoSrc}
          alt={`${brand.name} OEM Partner`}
          width={190}
          height={65}
          className="brand-logo-on-dark h-9 sm:h-11 md:h-13 lg:h-16 w-auto max-w-[85%] object-contain select-none pointer-events-none transition-transform duration-300 group-hover/brand:scale-105 hidden dark:block"
          draggable={false}
        />
      )}
    </div>
  );
}

export function BrandsSection() {
  return (
    <section
      id="brands-section"
      className="w-full py-12 md:py-16 overflow-hidden relative"
      style={{
        backgroundColor: 'var(--surface-sunken)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Section Header */}
      <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8 mb-8 md:mb-10 text-center">
        <h2
          className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          World-Class Brands We Supply &amp; Support
        </h2>
        <p
          className="text-base md:text-lg mt-3 max-w-2xl mx-auto"
          style={{ color: 'var(--text-secondary)' }}
        >
          Certified aerial access platforms and material handling machinery from global manufacturing leaders, available for immediate deployment across India.
        </p>
      </div>

      {/* Vertical Dual-Column Infinite Slider Showcase */}
      <div className="relative mx-auto max-w-4xl px-4">
        <div className="relative flex justify-center items-center gap-3 sm:gap-5 md:gap-7 lg:gap-8 h-[380px] sm:h-[440px] md:h-[500px] lg:h-[520px] overflow-hidden rounded-3xl p-2 sm:p-4">
          {/* Top Subtle Fade Gradient Mask */}
          <div
            className="pointer-events-none absolute top-0 left-0 right-0 h-16 sm:h-20 md:h-28 z-20"
            style={{
              background:
                'linear-gradient(to bottom, var(--surface-sunken) 0%, transparent 100%)',
            }}
            aria-hidden="true"
          />

          {/* Bottom Subtle Fade Gradient Mask */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 sm:h-20 md:h-28 z-20"
            style={{
              background:
                'linear-gradient(to top, var(--surface-sunken) 0%, transparent 100%)',
            }}
            aria-hidden="true"
          />

          {/* Column 1: Vertical Scrolling (Normal Direction) */}
          <InfiniteSlider
            direction="vertical"
            gap={16}
            duration={26}
            durationOnHover={65}
            className="h-full py-1"
          >
            {column1Brands.map((brand, idx) => (
              <OemPartnerLogoCard
                key={`col1-${brand.name}-${idx}`}
                brand={brand}
              />
            ))}
          </InfiniteSlider>

          {/* Column 2: Vertical Scrolling (Opposite Position & Reverse Direction) */}
          <InfiniteSlider
            direction="vertical"
            reverse
            gap={16}
            duration={26}
            durationOnHover={65}
            className="h-full py-1"
          >
            {column2Brands.map((brand, idx) => (
              <OemPartnerLogoCard
                key={`col2-${brand.name}-${idx}`}
                brand={brand}
              />
            ))}
          </InfiniteSlider>
        </div>

        {/* Bottom Trust Indicators & Quick Fleet Link */}
        <div className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            100% Certified OEM Machinery
          </span>
          <span className="hidden sm:inline-block text-[var(--border-subtle)]">
            •
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Immediate Pan-India Dispatch
          </span>
          <span className="hidden sm:inline-block text-[var(--border-subtle)]">
            •
          </span>
          <Link
            href="/#awp-section"
            className="inline-flex items-center gap-1 font-semibold text-[var(--brand-blue,#008CFC)] hover:underline group"
          >
            <span>Explore Certified Fleet</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default BrandsSection;
