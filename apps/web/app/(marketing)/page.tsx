import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { buildFaqJsonLd } from '@/lib/seo/jsonld'
import { Button } from '@/components/marketing/ui/button'
import { BrandsSection } from '@/components/marketing/brands/BrandsSection'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/Accordion'
import { ArrowRight, Check, CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react'
import { LiquidMetalButton } from '@/components/ui'
import { HeroSection } from '@/components/marketing/hero/HeroSection'
import { ClientsSection } from '@/components/marketing/client-logos/ClientsSection'
import { IndustriesSection } from '@/components/marketing/industries/IndustriesSection'
import { TestimonialsSection } from '@/components/marketing/testimonials/TestimonialsSection'

export const metadata: Metadata = {
  title: 'Reach International — Aerial Work Platforms & Material Handling Equipment',
  description:
    'Certified aerial work platforms, boom lifts, scissor lifts and material handling equipment for rental and sale across India. Authorized machinery from JCB, Toyota, Hyundai, JLG, Genie and BYD. Reaching All Heights.',
  alternates: { canonical: 'https://www.reachinternational.co.in/' },
}

// ── AWP Categories ─────────────────────────────────────────────────────────────
const awpEquipment = [
  {
    href: '/equipment/boom-lifts/',
    label: 'Boom Lifts',
    reach: '15m – 48m Reach',
    desc: 'Articulated and telescopic heavy booms for up-and-over access in construction & plant maintenance.',
    image: '/images/awp_boom_lift.jpg',
    brands: ['JLG', 'JCB', 'Genie'],
  },
  {
    href: '/equipment/scissor-lifts/',
    label: 'Scissor Lifts',
    reach: '6m – 18m Elevation',
    desc: 'Electric slab and rough-terrain scissor lifts with large platform work decks for indoor and outdoor tasks.',
    image: '/images/awp_scissor_lift.jpg',
    brands: ['Genie', 'JCB', 'JLG'],
  },
  {
    href: '/equipment/vertical-mast-lifts/',
    label: 'Vertical Mast Lifts',
    reach: '8m – 12m Height',
    desc: 'Compact zero-tailswing personnel lifts ideal for narrow warehouse aisles and facility maintenance.',
    image: '/images/awp_scissor_lift.jpg',
    brands: ['JLG', 'Genie'],
  },
  {
    href: '/equipment/spider-lifts/',
    label: 'Spider Lifts',
    reach: '14m – 32m Reach',
    desc: 'Tracked crawler chassis designed for delicate marble floors, heritage buildings, and steep grade access.',
    image: '/images/awp_boom_lift.jpg',
    brands: ['JLG', 'Genie'],
  },
]

// ── MHE Categories ─────────────────────────────────────────────────────────────
const mheEquipment = [
  {
    href: '/equipment/forklifts/',
    label: 'Forklifts',
    spec: '1.5 – 16 Ton Payload',
    desc: 'Diesel, LPG, and zero-emission electric counterbalanced forklifts for factories and container yards.',
    image: '/images/mhe_forklift.jpg',
    brands: ['Toyota', 'Hyundai', 'BYD'],
  },
  {
    href: '/equipment/reach-trucks/',
    label: 'Reach Trucks',
    spec: 'Up to 12.5m Stacking',
    desc: 'High-performance narrow-aisle reach trucks designed for high-density warehouse storage racks.',
    image: '/images/mhe_reach_truck.jpg',
    brands: ['Toyota', 'Hyundai'],
  },
  {
    href: '/equipment/material-lifts/',
    label: 'Material Lifts',
    spec: 'Portable HVAC Telescopic',
    desc: 'Rapid mechanical crank and hydraulic hoists for HVAC, steel ducting, and electrical assembly.',
    image: '/images/mhe_forklift.jpg',
    brands: ['Hyundai', 'Toyota'],
  },
  {
    href: '/equipment/scaffolding/',
    label: 'Modular Scaffolding',
    spec: 'Heavy Duty Modular Systems',
    desc: 'Rapid-assembly certified aluminum and steel access towers for industrial plant overhauls.',
    image: '/images/awp_boom_lift.jpg',
    brands: ['Reach Access'],
  },
]

// ── FAQs ───────────────────────────────────────────────────────────────────────
const faqs = [
  {
    q: 'What types of aerial work platforms do you supply?',
    a: 'We provide articulated boom lifts (15m–48m), electric and rough-terrain scissor lifts (6m–18m), vertical mast personnel lifts (8m–12m), tracked spider lifts (14m–32m), and modular scaffolding towers. All machinery is sourced from certified OEMs including Genie, JLG, and JCB.',
  },
  {
    q: 'What material handling equipment is available for rent and sale?',
    a: 'Our material handling fleet consists of counterbalanced diesel, LPG, and electric forklifts (1.5T–16T), narrow-aisle high-bay reach trucks (up to 12.5m lift height), and industrial material lifts from world-class manufacturers including Toyota, Hyundai, and BYD (Lithium-ion).',
  },
  {
    q: 'What is your response time for equipment breakdowns?',
    a: 'We maintain a strict service standard keeping equipment breakdown rates below 5%. Our verified operational policy targets on-site technician response or resolution in under 2 hours, supported by mobile service vans and certified engineers across India.',
  },
  {
    q: 'What is the difference between AWP and MHE machinery?',
    a: 'AWP (Aerial Work Platforms) includes equipment designed to elevate personnel and tools safely to height (boom lifts, scissor lifts, spider lifts, vertical masts). MHE (Material Handling Equipment) includes machinery built to lift, move, and stack heavy industrial goods (counterbalanced forklifts, reach trucks, and pallet equipment).',
  },
  {
    q: 'Do you offer both short-term rental and outright equipment purchase?',
    a: 'Yes. We provide flexible rental agreements ranging from daily/monthly project leases to multi-year contracts, as well as direct equipment sales with verified maintenance histories and documentation.',
  },
  {
    q: 'Where across India do you deliver machinery?',
    a: 'We provide pan-India delivery and support, deploying equipment to major industrial corridors, metro infrastructure projects, manufacturing clusters, and logistics parks across India.',
  },
  {
    q: 'How do I get a tailored quote for my project?',
    a: 'Submit your requirements via our Request a Quote form or reach out via our contact page. Our equipment specialists will assess your working height, payload, and site conditions to provide transparent terms.',
  },
]

export default function HomePage() {
  const faqJsonLd = buildFaqJsonLd(faqs)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── 1. HERO SECTION ────────────────────────────────────────────────────── */}
      <HeroSection />

      {/* ── 2. AERIAL WORK PLATFORMS (AWP) ────────────────────────────────────── */}
      <section
        id="awp-section"
        className="w-full py-12 md:py-16"
        style={{
          backgroundColor: 'var(--surface-sunken)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Aerial Work Platforms (AWP)
              </h2>
              <p className="text-base mt-2 max-w-xl" style={{ color: 'var(--text-secondary)' }}>
                High-reach access platforms engineered for worker safety and elevated job-site productivity.
              </p>
            </div>
            <Link
              href="/equipment/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
              style={{ color: 'var(--text-link)' }}
            >
              <span>View All Equipment</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {awpEquipment.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-md cursor-pointer block"
                style={{
                  backgroundColor: 'var(--surface-base)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Image */}
                <div className="relative w-full aspect-[4/3] overflow-hidden" style={{ backgroundColor: 'var(--surface-sunken)' }}>
                  <Image
                    src={item.image}
                    alt={item.label}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  <div
                    className="absolute top-3 left-3 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-xs"
                    style={{
                      backgroundColor: 'var(--surface-raised)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {item.reach}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3
                        className="text-lg font-bold transition-colors group-hover:text-[#008CFC]"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.label}
                      </h3>
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" style={{ color: 'var(--brand-blue, #008CFC)' }} />
                    </div>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
                      {item.desc}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Brands:</span>
                    <div className="flex items-center gap-1.5">
                      {item.brands.map((b) => (
                        <span
                          key={b}
                          className="px-2 py-0.5 rounded font-semibold text-[10px]"
                          style={{
                            backgroundColor: 'var(--surface-sunken)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. MATERIAL HANDLING EQUIPMENT (MHE) ───────────────────────────────── */}
      <section
        id="mhe-section"
        className="w-full py-12 md:py-16"
        style={{
          backgroundColor: 'var(--surface-base)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Material Handling Equipment (MHE)
              </h2>
              <p className="text-base mt-2 max-w-xl" style={{ color: 'var(--text-secondary)' }}>
                Heavy-duty forklifts and reach trucks engineered for warehouse and plant logistics.
              </p>
            </div>
            <Link
              href="/equipment/"
              className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
              style={{ color: 'var(--text-link)' }}
            >
              <span>Explore MHE Inventory</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {mheEquipment.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-md cursor-pointer block"
                style={{
                  backgroundColor: 'var(--surface-base)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* Image */}
                <div className="relative w-full aspect-[4/3] overflow-hidden" style={{ backgroundColor: 'var(--surface-sunken)' }}>
                  <Image
                    src={item.image}
                    alt={item.label}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                  <div
                    className="absolute top-3 left-3 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-xs"
                    style={{
                      backgroundColor: 'var(--surface-raised)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {item.spec}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3
                        className="text-lg font-bold transition-colors group-hover:text-[#008CFC]"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {item.label}
                      </h3>
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" style={{ color: 'var(--brand-blue, #008CFC)' }} />
                    </div>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
                      {item.desc}
                    </p>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Brands:</span>
                    <div className="flex items-center gap-1.5">
                      {item.brands.map((b) => (
                        <span
                          key={b}
                          className="px-2 py-0.5 rounded font-semibold text-[10px]"
                          style={{
                            backgroundColor: 'var(--surface-sunken)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. AUTHORIZED OEM EQUIPMENT PARTNERS ───────────────────────────────── */}
      <BrandsSection />

      {/* ── 5. ENTERPRISE CLIENTS ────────────────────────────────────────────── */}
      <ClientsSection />

      {/* ── 6. INDUSTRIES WE SERVE ───────────────────────────────────────────── */}
      <IndustriesSection />

      {/* ── 7. MOBILIZATION / QUOTE PROMO ────────────────────────────────────── */}
      <section
        id="quote-promo"
        className="w-full py-12 md:py-16"
        style={{
          backgroundColor: 'var(--surface-sunken)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            {/* Card 1: Equipment Rental Options */}
            <div
              className="lg:col-span-7 rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden shadow-xs border"
              style={{
                backgroundColor: 'var(--surface-base)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div>
                <h3 className="text-2xl md:text-3xl font-extrabold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Tailored Equipment Rental Options
                </h3>
                <p className="text-sm md:text-base leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
                  Whether you need single-day maintenance access or multi-year industrial plant deployment, Reach International offers flexible rental contracts with certified operator options, preventive maintenance, and under 5% breakdown SLAs across all Indian states.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--surface-sunken)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-blue, #008CFC)' }}>Short-Term</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Daily &bull; Weekly &bull; Monthly</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Shutdowns &amp; turnarounds</p>
                  </div>
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--surface-sunken)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-blue, #008CFC)' }}>Long-Term</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Annual &bull; Multi-Year</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Warehouse &amp; factory leases</p>
                  </div>
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--surface-sunken)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-blue, #008CFC)' }}>Direct Purchase</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Capital Sales</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Certified OEM machines</p>
                  </div>
                </div>
              </div>

              <div>
                <Button
                  href="/equipment/"
                  color="primary"
                  size="md"
                  className="rounded-full px-7 shadow-xs group"
                  iconTrailing={<ArrowRight className="size-4" />}
                >
                  Explore Options
                </Button>
              </div>
            </div>

            {/* Card 2: Need a Quote? */}
            <div
              className="lg:col-span-5 rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden shadow-xs border"
              style={{
                backgroundColor: 'var(--surface-base)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div>
                <h3 className="text-2xl font-extrabold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Need a Quote?
                </h3>
                <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Get a customized quote for your equipment requirements with guaranteed under 2 hours response SLA across India.
                </p>

                <div className="space-y-2.5 mb-6 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--action-primary-bg)' }} />
                    <span>Free technical site evaluation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--action-primary-bg)' }} />
                    <span>Certified operators available on request</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--action-primary-bg)' }} />
                    <span>Direct phone hotlines: +91 9910221405 / +91 9958199513</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  href="/request-a-quote/"
                  color="secondary"
                  size="md"
                  className="rounded-full px-6 shadow-xs group"
                  iconTrailing={<ArrowRight className="size-4" />}
                >
                  Request a Quote
                </Button>
                <a
                  href="tel:+919910221405"
                  className="inline-flex items-center justify-center px-5 h-10 rounded-full text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: 'var(--surface-sunken)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  Call +91 9910221405
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. WHY REACH (Value Bar) ─────────────────────────────────────────── */}
      <section
        id="why-reach"
        className="w-full py-10 md:py-12"
        style={{
          backgroundColor: 'var(--surface-base)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* 1. Safety First */}
            <div className="flex items-start gap-3.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--surface-tint)',
                  color: 'var(--brand-blue, #008CFC)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Safety First</h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Our top priority is a safe work environment with certified machines.
                </p>
              </div>
            </div>

            {/* 2. Expert Support */}
            <div className="flex items-start gap-3.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--surface-tint)',
                  color: 'var(--brand-blue, #008CFC)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Expert Support</h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Dedicated team for all your operational and on-site support needs.
                </p>
              </div>
            </div>

            {/* 3. Reliable Equipment */}
            <div className="flex items-start gap-3.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--surface-tint)',
                  color: 'var(--brand-blue, #008CFC)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Reliable Equipment</h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Well-maintained and ready when you are, from leading global OEMs.
                </p>
              </div>
            </div>

            {/* 4. Sustainable Future */}
            <div className="flex items-start gap-3.5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--surface-tint)',
                  color: 'var(--brand-blue, #008CFC)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Sustainable Future</h4>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Greener electric and lithium-ion solutions for zero-emission projects.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. TESTIMONIALS ────────────────────────────────────────────────────── */}
      <TestimonialsSection />

      {/* ── 10. FAQ SECTION ────────────────────────────────────────────────────── */}
      <section
        id="faq"
        className="w-full py-12 md:py-16"
        style={{
          backgroundColor: 'var(--surface-sunken)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Frequently Asked Questions
              </h2>
            </div>

            <Accordion type="single" collapsible variant="card">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger>{faq.q}</AccordionTrigger>
                  <AccordionContent>{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── 11. INVERSE QUOTE CTA ─────────────────────────────────────────────── */}
      <section
        className="w-full py-14 md:py-16 relative overflow-hidden"
        style={{
          backgroundColor: '#09101D',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
          style={{ backgroundColor: 'var(--brand-blue, #008CFC)' }}
        />

        <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4 text-white tracking-tight">
            Ready to find the right equipment for your project?
          </h2>

          <p className="text-base md:text-lg mb-8 mx-auto text-gray-300 max-w-xl leading-relaxed">
            Connect with our heavy machinery specialists. We will recommend the exact machine, working height, payload, and commercial model for your timeline.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              href="/request-a-quote/"
              color="primary"
              size="lg"
              className="rounded-full px-8 shadow-lg group"
              iconTrailing={<ArrowRight className="size-4" />}
            >
              Request a Quote
            </Button>

            <Button
              href="/contact/"
              variant="outline"
              size="lg"
              className="rounded-full px-8 shadow-xs group text-white border-white/20 hover:bg-white/10 hover:border-white/40"
              iconTrailing={<ArrowRight className="size-4" />}
            >
              Contact Us
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
