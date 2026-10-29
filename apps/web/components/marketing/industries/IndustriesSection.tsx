'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Data Structures
// ============================================================================

export interface PrimaryIndustry {
  id: string;
  href: string;
  label: string;
  eyebrow: string;
  tag: string;
  desc: string;
  image: string;
  stats: string;
  equipment: string[];
  brands: string[];
}

export interface OtherIndustry {
  id: string;
  label: string;
  tag: string;
  desc: string;
  equipment: string;
  specs: string;
  href: string;
}

// ── Primary 6 Hero Industries (With Dedicated Photography) ───────────────────
export const primaryIndustries: PrimaryIndustry[] = [
  {
    id: 'construction',
    href: '/industries/construction/',
    label: 'Construction & High-Rise',
    eyebrow: 'CIVIL & ARCHITECTURE',
    tag: 'Commercial & Residential',
    desc: 'High-elevation articulated boom lifts and rough-terrain scissors for structural glazing, steel erection, facade engineering, and landmark towers.',
    image: '/images/industry_construction_card.jpg',
    stats: 'Up to 48m • 4WD Gradeability',
    equipment: ['Articulated Booms', 'Telescopic Booms', 'RT Scissor Lifts'],
    brands: ['JCB', 'JLG', 'Genie'],
  },
  {
    id: 'manufacturing',
    href: '/industries/manufacturing/',
    label: 'Manufacturing & Plants',
    eyebrow: 'PRECISION ENGINEERING',
    tag: 'Automotive & Heavy Industry',
    desc: 'Zero-emission electric lifts and compact reach solutions tailored for automotive assembly lines, robotic cell installations, and heavy plant retrofits.',
    image: '/images/industry_manufacturing_card.jpg',
    stats: 'Zero Emissions • Non-Marking',
    equipment: ['Electric Scissors', 'Narrow Booms', 'Electric Forklifts'],
    brands: ['Toyota', 'JCB', 'BYD'],
  },
  {
    id: 'aviation',
    href: '/industries/aviation/',
    label: 'Aviation & Aerospace',
    eyebrow: 'AIRFIELD & HANGARS',
    tag: 'Commercial & Defense Hangars',
    desc: 'Precision telescopic platforms with protective bumper kits for fuselage inspection, tailplane maintenance, jet engine overhauls, and avionics servicing.',
    image: '/images/industry_aviation_card.jpg',
    stats: 'Precision Control • Zero Jolt',
    equipment: ['Telescopic Booms', 'Vertical Masts', 'Spider Lifts'],
    brands: ['JLG', 'Genie', 'Reach'],
  },
  {
    id: 'warehousing-logistics',
    href: '/industries/warehousing-logistics/',
    label: 'Warehousing & Logistics',
    eyebrow: 'SUPPLY CHAIN & FULFILLMENT',
    tag: 'High-Velocity Logistics',
    desc: 'High-lift reach trucks, order pickers, and electric counterbalance forklifts optimized for dense vertical racking bays and continuous 24/7 turnaround.',
    image: '/images/industry_warehousing_card.jpg',
    stats: 'Up to 12.5m • AC Drive Tech',
    equipment: ['Reach Trucks', 'Electric Forklifts', 'Order Pickers'],
    brands: ['Toyota', 'BYD', 'Hyundai'],
  },
  {
    id: 'infrastructure',
    href: '/industries/infrastructure/',
    label: 'Infrastructure & Metro Rail',
    eyebrow: 'TRANSIT & MEGA-CIVILS',
    tag: 'National Transit Corridors',
    desc: 'Certified heavy all-terrain lifts for metro viaduct inspection, bridge pier casting, flyover erection, and international airport terminal expansion.',
    image: '/images/industry_infrastructure_card.jpg',
    stats: 'Heavy Basket • All-Terrain',
    equipment: ['Articulated 4x4 Booms', 'Telehandlers', 'Diesel Scissors'],
    brands: ['JCB', 'JLG', 'Hyundai'],
  },
  {
    id: 'oil-gas',
    href: '/industries/oil-gas/',
    label: 'Oil, Gas & Petrochemicals',
    eyebrow: 'HAZARDOUS PROCESS & ENERGY',
    tag: 'Refineries & Offshore Terminals',
    desc: 'Spark-arrestor equipped, Chalwyn-valve protected lifts engineered for scheduled refinery turnarounds, chemical storage maintenance, and offshore yard works.',
    image: '/images/industry_oil_gas_card.jpg',
    stats: 'Zone-Certified • Spark Arrested',
    equipment: ['Specialized Booms', 'RT Scissor Lifts', 'Flameproof Fleet'],
    brands: ['JLG', 'Genie', 'JCB'],
  },
];

// ── Other Specialized Sectors (Under "Other" Section) ───────────────────────
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

type IndustryFilter = 'all' | 'primary' | 'other';

// ============================================================================
// Main Industries Section Component
// ============================================================================

export function IndustriesSection() {
  const [activeFilter, setActiveFilter] = useState<IndustryFilter>('all');

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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wider uppercase mb-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0284c7] animate-pulse" />
            <span>SECTOR SPECIALIZATIONS</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50">
            Industries We Power Across India
          </h2>

          <p className="text-base sm:text-lg mt-3 md:mt-4 leading-relaxed text-neutral-600 dark:text-neutral-400 max-w-2xl">
            Engineered aerial access platforms and material handling fleets tailored to stringent sectoral safety norms, extreme elevations, and zero-downtime turnarounds.
          </p>

          {/* ── Interactive Category Filter Pills ─────────────────────────── */}
          <div className="mt-8 flex items-center justify-center p-1.5 rounded-full bg-neutral-100/90 dark:bg-neutral-900/90 border border-neutral-200 dark:border-neutral-800 backdrop-blur-md shadow-2xs max-w-full overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={cn(
                'px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap min-h-[38px] flex items-center gap-1.5',
                activeFilter === 'all'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-xs border border-neutral-200/80 dark:border-neutral-700'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
              )}
            >
              <span>All Industries</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-neutral-200/70 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                14
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('primary')}
              className={cn(
                'px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap min-h-[38px] flex items-center gap-1.5',
                activeFilter === 'primary'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-xs border border-neutral-200/80 dark:border-neutral-700'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
              )}
            >
              <span>Core Sectors</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-neutral-200/70 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                6
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('other')}
              className={cn(
                'px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap min-h-[38px] flex items-center gap-1.5',
                activeFilter === 'other'
                  ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-xs border border-neutral-200/80 dark:border-neutral-700'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
              )}
            >
              <span>Other Specialized Sectors</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-neutral-200/70 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                8
              </span>
            </button>
          </div>
        </div>

        {/* ── 1. PRIMARY HERO CARDS GRID ──────────────────────────────────── */}
        {(activeFilter === 'all' || activeFilter === 'primary') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7 mb-14 md:mb-18">
            {primaryIndustries.map((ind, idx) => (
              <Link
                key={ind.id}
                href={ind.href}
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
        )}

        {/* ── 2. "OTHER" SPECIALIZED SECTORS SECTION ─────────────────────── */}
        {(activeFilter === 'all' || activeFilter === 'other') && (
          <div className="mt-6 pt-10 border-t border-neutral-200/80 dark:border-neutral-800">
            {/* Header for "Other" Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-medium uppercase tracking-wider text-[#0284c7] dark:text-[#38bdf8] mb-1.5">
                  <span>// SPECIALIZED APPLICATIONS</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50">
                  Other Specialized Sectors We Power
                </h3>
                <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mt-1 max-w-2xl">
                  Specialized non-standard aerial platforms and cleanroom-certified lifting machinery configured for niche industrial operations.
                </p>
              </div>

              <Link
                href="/contact/?subject=Specialized+Sector+Fleet+Inquiry"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-neutral-950 dark:bg-white text-white dark:text-neutral-950 hover:bg-[#0284c7] dark:hover:bg-[#38bdf8] dark:hover:text-black transition-colors duration-200 shadow-xs self-start md:self-auto min-h-[44px]"
              >
                <span>Request Custom Sector Fleet</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>

            {/* Bento Grid: 1 Hero Visual Card + 8 Clean Other Sector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {/* Highlight Bento Card (Clean Tech & Emerging Energy Visual) */}
              <div className="md:col-span-2 lg:col-span-2 rounded-2xl md:rounded-3xl p-5 md:p-6 bg-gradient-to-br from-neutral-900 to-neutral-950 text-white border border-neutral-800 relative overflow-hidden flex flex-col justify-between shadow-lg">
                <Image
                  src="/images/industry_other_sectors_card.jpg"
                  alt="Specialized industrial sectors and renewable clean energy applications"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover opacity-35 hover:opacity-40 transition-opacity duration-500 -z-0"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent -z-0 pointer-events-none" />

                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-white/10 backdrop-blur-md border border-white/15 text-white/90 mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>EMERGING & SPECIALIZED</span>
                  </div>
                  <h4 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
                    Custom Access Engineering For Any Vertical
                  </h4>
                  <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-lg">
                    Whether you operate a hyperscale cleanroom, require non-conductive insulated platforms for high-voltage lines, or demand spark-free lithium machinery for explosive vapor zones — Reach International deploys application-engineered fleets nationwide.
                  </p>
                </div>

                <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-neutral-400 font-medium">Pan-India Support</span>
                    <span className="text-sm font-bold text-white">24/7 Field Engineers & EHS Certified</span>
                  </div>

                  <Link
                    href="/contact/?subject=Custom+Engineering+Access"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white transition-colors"
                  >
                    <span>Consult Application Engineer</span>
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </div>

              {/* 8 Clean "Other" Industry Cards */}
              {otherIndustries.map((sec) => (
                <div
                  key={sec.id}
                  className="rounded-2xl p-4 sm:p-5 flex flex-col justify-between bg-white dark:bg-[#121212] border border-neutral-200/90 dark:border-neutral-800/90 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-2xs hover:shadow-md transition-all duration-300 hover:-translate-y-1 group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/60">
                        {sec.tag}
                      </span>
                    </div>

                    <h4 className="text-base font-bold tracking-tight text-neutral-950 dark:text-white group-hover:text-[#0284c7] dark:group-hover:text-[#38bdf8] transition-colors">
                      {sec.label}
                    </h4>

                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed mt-2 line-clamp-3">
                      {sec.desc}
                    </p>
                  </div>

                  <div className="pt-3.5 mt-3.5 border-t border-neutral-100 dark:border-neutral-800/80">
                    <div className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      <span className="text-neutral-400 dark:text-neutral-500">Fleet: </span>
                      {sec.equipment}
                    </div>

                    <Link
                      href={`/contact/?industry=${sec.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284c7] dark:text-[#38bdf8] hover:underline"
                    >
                      <span>Inquire sector quote</span>
                      <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
