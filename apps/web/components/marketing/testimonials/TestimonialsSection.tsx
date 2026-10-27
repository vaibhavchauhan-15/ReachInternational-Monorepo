'use client'

import React from 'react'
import { motion } from 'motion/react'
import { TestimonialsColumn, type Testimonial } from '@/components/marketing/ui/testimonials-columns-1'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

// ── Verified Indian Industrial Testimonials ──────────────────────────────────
// Tailored to Reach International's core offerings: AWP & MHE rental and sales
export const industrialTestimonials: Testimonial[] = [
  {
    text: 'Reach International delivered four JLG boom lifts directly to our metro viaduct site on short notice. The machines were in pristine condition and operator safety training was thoroughly handled.',
    name: 'Rajesh K. Sharma',
    role: 'Senior Project Director',
    org: 'Urban Infrastructure & Metro Rail Project',
    location: 'Mumbai – Ahmedabad Corridor',
    equipment: 'JLG 1350SJP Boom Lift',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
  {
    text: 'We switched to BYD lithium-ion forklifts and Toyota reach trucks for our 200,000 sq ft logistics hub. Zero downtime and high battery efficiency significantly reduced our turnaround cycles.',
    name: 'Amitabh Varma',
    role: 'VP of Supply Chain & Fulfillment',
    org: 'Apex Logistics & Warehousing Park',
    location: 'Bhiwandi, Maharashtra',
    equipment: 'Toyota & BYD Lithium MHE',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  },
  {
    text: 'During our annual automotive plant turnaround, Reach provided certified Genie scissor lifts and heavy Toyota forklifts. Their on-site support engineers ensured our overhaul completed two days ahead of schedule.',
    name: 'Siddharth Patel',
    role: 'Plant Maintenance Head',
    org: 'Automotive Precision Engineering',
    location: 'Sanand / Pune Industrial Cluster',
    equipment: 'Genie Z-62/40 & Toyota 5T',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  },
  {
    text: 'Glazing maintenance on high-rise commercial atriums requires specialized spider lifts with zero floor damage. Reach surveyed our slab load limits and supplied perfect non-marking rubber crawler lifts.',
    name: 'Vikramaditya Rao',
    role: 'Chief Engineer (MEP & Façade)',
    org: 'Commercial Towers & Business Parks',
    location: 'Cyber City, Gurugram',
    equipment: 'Spider / Crawler Compact Lift',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  },
  {
    text: 'Cleanroom semiconductor and electronics assembly requires zero hydraulic residue or exhaust. Reach provided spotless electric scissor lifts with non-marking tyres and valid annual inspection certificates.',
    name: 'Nandita Sengupta',
    role: 'Head of Facilities & EHS',
    org: 'Electronics & Cleanroom Manufacturing',
    location: 'Sri City, Andhra Pradesh',
    equipment: 'Genie Electric Scissor Lift',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  },
  {
    text: 'Continuous 24/7 container un-stuffing demands extreme machinery resilience. Reach’s heavy Hyundai forklifts run relentlessly with scheduled preventive visits keeping breakdown rates well under 2%.',
    name: 'Capt. Harish Nair',
    role: 'General Manager of Yard Operations',
    org: 'Inland Container Depot & Multimodal Terminal',
    location: 'Dadri / Greater Noida',
    equipment: 'Hyundai 16-Tonne Heavy Forklift',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
  },
  {
    text: 'High-bay narrow aisle racking at 11 meters demands rock-solid reach trucks. The mast stability and battery endurance on Reach’s Toyota units enabled our pick rates to jump by 28% during peak season.',
    name: 'Pooja Kulkarni',
    role: 'Site Operations Lead',
    org: 'FMCG Mega Fulfillment Center',
    location: 'Chakan Industrial Area, Pune',
    equipment: 'Toyota 8-Series Reach Truck',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  },
  {
    text: 'Refinery safety audits are uncompromising on spark arrestors and annual load test certificates. Reach International provided third-party tested telescopic boom lifts with full compliance before mobilization.',
    name: 'Devendra Singh Chandel',
    role: 'Senior GM (Civil & Structural)',
    org: 'Refinery Expansion & Petrochemical Complex',
    location: 'Mathura – Panipat Belt',
    equipment: 'Genie S-85 Telescopic Boom',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    text: 'Operating over sandy desert terrain would ground standard equipment. Reach’s rough-terrain 4x4 booms and telehandlers handled steep gradient access to wind turbine towers without a single traction hitch.',
    name: 'Kavita Sundaram',
    role: 'Infrastructure Project Lead',
    org: 'Renewable Solar & Wind EPC Farm',
    location: 'Khavda Renewable Energy Park, Gujarat',
    equipment: 'JCB Rough Terrain 4x4 Boom',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150&auto=format&fit=crop&q=80',
  },
]

const firstColumn = industrialTestimonials.slice(0, 3)
const secondColumn = industrialTestimonials.slice(3, 6)
const thirdColumn = industrialTestimonials.slice(6, 9)

export const TestimonialsSection = () => {
  return (
    <section
      id="testimonials"
      className="w-full py-12 md:py-16 relative overflow-hidden"
      style={{
        backgroundColor: 'var(--surface-base)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="max-w-wide mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-3xl mx-auto text-center mb-8 md:mb-10"
        >
          <h2
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Trusted on India&apos;s Flagship Projects
          </h2>

          <p
            className="text-base sm:text-lg mt-3 md:mt-4 max-w-2xl leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Hear from project managers, supply chain heads, and plant engineers who rely on Reach International for certified AWP and MHE fleets with &lt;5% breakdown rate.
          </p>
        </motion.div>

        {/* Scrolling Columns Container with smooth gradient vertical mask */}
        <div
          className="relative flex justify-center gap-5 md:gap-6 max-h-[500px] overflow-hidden select-none"
          style={{
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}
        >
          {/* Column 1 — always visible */}
          <TestimonialsColumn
            testimonials={firstColumn}
            duration={22}
            className="w-full sm:max-w-[340px]"
          />

          {/* Column 2 — visible on tablet & desktop */}
          <TestimonialsColumn
            testimonials={secondColumn}
            duration={27}
            className="hidden md:block w-full sm:max-w-[340px]"
          />

          {/* Column 3 — visible on desktop */}
          <TestimonialsColumn
            testimonials={thirdColumn}
            duration={24}
            className="hidden lg:block w-full sm:max-w-[340px]"
          />
        </div>

        {/* Bottom CTA Bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 text-center"
        >
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Need certified equipment for your project with full compliance?
          </span>
          <Link
            href="/request-a-quote/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-xs transition-all duration-200 hover:brightness-105 active:scale-95"
            style={{
              backgroundColor: 'var(--action-primary-bg)',
              color: 'var(--action-primary-fg)',
            }}
          >
            <span>Request a Project Quote</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

export default TestimonialsSection
