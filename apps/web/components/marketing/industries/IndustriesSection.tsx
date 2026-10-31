'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { primaryIndustries, type PrimaryIndustry } from '@/lib/data/industries';
export { primaryIndustries, type PrimaryIndustry };

export interface OtherIndustry {
  id: string;
  label: string;
  tag: string;
  desc: string;
  equipment: string;
  specs: string;
  href?: string;
}

// ── Other Specialized Sectors (Reference Data) ──────────────────────────────
export const otherIndustries: OtherIndustry[] = [
  {
    id: 'renewable-energy',
    label: 'Renewable Energy & Wind/Solar',
    tag: 'Clean Tech & Utilities',
    desc: 'High-reach access for wind turbine blade inspection, utility-scale solar inverter servicing, and transmission substation maintenance.',
    equipment: 'Telescopic Booms • Rough-Terrain 4WD',
    specs: 'High wind tolerance • Remote terrain access',
    href: '/industries/renewable-energy/',
  },
  {
    id: 'data-centers',
    label: 'Data Centers & Tech Campuses',
    tag: 'Mission-Critical Facilities',
    desc: 'Ultra-clean indoor vertical lifts for high-density server rack containment, cleanroom overhead ducting, and cable grid installation.',
    equipment: 'Compact Electric Scissors • Vertical Masts',
    specs: 'Zero emissions • Low point floor loading',
    href: '/industries/data-centers/',
  },
  {
    id: 'marine-ports',
    label: 'Marine, Ports & Shipyards',
    tag: 'Maritime Engineering',
    desc: 'Heavy-duty corrosion-resistant platforms for drydock vessel hull maintenance, container quay crane servicing, and port logistics.',
    equipment: 'Heavy Rough-Terrain Booms • Diesel Scissors',
    specs: 'Marine environment prep • Salt mist proofing',
    href: '/industries/marine-ports/',
  },
  {
    id: 'telecom-power',
    label: 'Telecommunications & Power',
    tag: 'Grid Infrastructure',
    desc: 'Insulated boom lifts and compact crawler platforms for cellular 5G tower antenna mounting and high-voltage transmission lines.',
    equipment: 'Insulated Boom Lifts • Spider Lifts',
    specs: 'Dielectric insulation • Compact stabilizer footprint',
    href: '/industries/telecom-power/',
  },
  {
    id: 'facilities-real-estate',
    label: 'Facilities Management & Atriums',
    tag: 'Commercial Assets',
    desc: 'Ultra-compact spider lifts with non-marking rubber crawlers for fragile indoor flooring, high atrium glazing, and chandelier maintenance.',
    equipment: 'Tracked Spider Lifts • Push-Around Masts',
    specs: 'Non-marking crawlers • Narrow doorway passage',
    href: '/industries/facilities-real-estate/',
  },
  {
    id: 'entertainment-events',
    label: 'Entertainment, Arenas & Media',
    tag: 'Public Venues & Broadcast',
    desc: 'Quiet electric booms and scissor lifts for concert arena acoustic rigging, stadium lighting trusses, and high-angle broadcast setups.',
    equipment: 'Electric Articulated Booms • Scissor Lifts',
    specs: 'Whisper-quiet electric drive • Black-out livery',
    href: '/industries/entertainment-events/',
  },
  {
    id: 'pharmaceutical-cleanrooms',
    label: 'Pharmaceutical & Cleanrooms',
    tag: 'GMP Certified Facilities',
    desc: 'Medical-grade electric access machinery designed for sterile manufacturing cleanrooms with zero oil mist and certified wipe-down finishes.',
    equipment: 'Cleanroom Electric Scissors • Vertical Masts',
    specs: 'Zero emissions • Biodegradable hydraulic oil',
    href: '/industries/pharmaceutical-cleanrooms/',
  },
  {
    id: 'mining-heavy-processing',
    label: 'Mining & Heavy Civils',
    tag: 'Extractive & Processing',
    desc: 'Extreme-duty 4x4 rough terrain booms for overland conveyors, crusher stations, aggregate plants, and cement kiln overhauls.',
    equipment: 'Heavy 4WD Articulated Booms • Telehandlers',
    specs: 'Severe dust sealed pins • Heavy payload baskets',
    href: '/industries/mining-heavy-processing/',
  },
];

// ============================================================================
// Main Industries Section Component
// ============================================================================

export function IndustriesSection() {
  return (
    <section
      id="industries"
      className="w-full py-16 md:py-24 relative overflow-hidden bg-[var(--surface-base,#ffffff)] dark:bg-[#0a0a0a] transition-colors duration-300"
      style={{
        borderBottom: '1px solid var(--border-subtle, #ebebeb)',
      }}
    >
      {/* Background ambient lighting accents */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[#0284c7]/8 via-[#0284c7]/3 to-transparent rounded-full blur-3xl pointer-events-none -z-10 dark:from-[#0284c7]/12 dark:via-transparent"
        aria-hidden="true"
      />

      <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8">
        {/* ── Section Header ────────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-10 md:mb-14">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50">
            Industries We Power Across India
          </h2>

          <p className="text-base sm:text-lg mt-3 md:mt-4 leading-relaxed text-neutral-600 dark:text-neutral-400 max-w-2xl">
            Aerial access platforms and material handling fleets tailored for sectoral safety and zero-downtime operations.
          </p>
        </div>

        {/* ── Primary Hero Cards Grid ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
          {primaryIndustries.map((ind, idx) => (
            <Link
              key={ind.id}
              href={ind.href || '#'}
              className={cn(
                'group rounded-2xl md:rounded-3xl p-2 sm:p-2.5 flex flex-col justify-between transition-all duration-500',
                'bg-white dark:bg-[#121212]',
                'border border-neutral-200/90 dark:border-neutral-800/90',
                'hover:border-neutral-300 dark:hover:border-neutral-700',
                'shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]',
                'hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)]',
                'hover:-translate-y-1.5 active:scale-[0.99] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#0284c7]'
              )}
            >
              {/* Visual Stage (Image Container) */}
              <div className="relative aspect-[16/10] w-full rounded-xl md:rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 ring-1 ring-black/5 dark:ring-white/10">
                <Image
                  src={ind.image}
                  alt={`${ind.label} industrial operations with Reach International access equipment`}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  priority={idx < 3}
                  className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-106 dark:brightness-[0.90] dark:contrast-[1.04] dark:group-hover:brightness-100"
                />

                {/* Gradient Scrim for Top & Bottom Contrast */}
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none"
                  aria-hidden="true"
                />

                {/* Top Eyebrow Tag & Spec Pill */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none z-10">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider backdrop-blur-md bg-white/95 text-neutral-900 dark:bg-black/85 dark:text-neutral-100 shadow-2xs border border-black/5 dark:border-white/10">
                    {ind.eyebrow}
                  </span>
                  <span className="hidden xs:inline-flex items-center px-2 py-0.8 rounded-full text-[10px] font-medium backdrop-blur-md bg-black/65 text-white/90 border border-white/15">
                    {ind.stats}
                  </span>
                </div>

                {/* Bottom Sector Tag on Image */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                  <span className="text-xs font-semibold text-white drop-shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                    {ind.tag}
                  </span>
                </div>
              </div>

              {/* Content Stage */}
              <div className="p-4 sm:p-5 flex flex-col justify-between flex-1">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white group-hover:text-[#0284c7] dark:group-hover:text-[#38bdf8] transition-colors duration-200">
                    {ind.label}
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-3 leading-relaxed mt-2.5">
                    {ind.desc}
                  </p>

                  {/* Equipment Match Chips */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {ind.equipment.map((eq) => (
                      <span
                        key={eq}
                        className="px-2 py-0.8 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 border border-neutral-200/70 dark:border-neutral-700/60"
                      >
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action Row */}
                <div className="pt-4 mt-5 border-t border-neutral-100 dark:border-neutral-800/90 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="font-medium text-neutral-400 dark:text-neutral-500">Fleet:</span>
                    <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                      {ind.brands.join(' • ')}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#0284c7] dark:text-[#38bdf8]">
                    <span className="hidden sm:inline">Explore solutions</span>
                    <div className="w-7 h-7 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-200 group-hover:bg-[#0284c7] group-hover:text-white transition-all duration-300 group-hover:translate-x-0.5">
                      <ArrowRight className="size-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default IndustriesSection;
