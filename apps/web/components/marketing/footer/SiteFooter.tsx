import Link from 'next/link'
import { ReachLogo } from '@/components/branding/ReachLogo'

const footerSections = [
  {
    title: 'Equipment',
    links: [
      { href: '/equipment/awp/boom-lifts', label: 'Boom Lifts' },
      { href: '/equipment/awp/scissor-lifts', label: 'Scissor Lifts' },
      { href: '/equipment/mhe/forklifts', label: 'Forklifts' },
      { href: '/equipment/mhe/reach-trucks', label: 'Reach Trucks' },
      { href: '/equipment/awp/vertical-mast-lifts', label: 'Vertical Mast Lifts' },
    ],
  },
  {
    title: 'Services',
    links: [
      { href: '/#quote-promo', label: 'Rental' },
      { href: '/#quote-promo', label: 'Sales' },
      { href: '/#quote-promo', label: 'Support & Maintenance' },
    ],
  },
  {
    title: 'Industries',
    links: [
      { href: '/industries/construction/', label: 'Construction' },
      { href: '/industries/manufacturing/', label: 'Manufacturing' },
      { href: '/industries/warehousing-logistics/', label: 'Warehousing & Logistics' },
      { href: '/industries/infrastructure/', label: 'Infrastructure' },
    ],
  },
  {
    title: 'About',
    links: [
      { href: '/about/', label: 'Our Story' },
      { href: '/about/', label: 'Why Reach' },
      { href: '/contact/', label: 'Careers' },
      { href: '/contact/', label: 'Contact' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer
      className="relative overflow-hidden"
      style={{
        backgroundColor: '#09101D',
        color: '#FFFFFF',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Decorative subtle blue glow in corner */}
      <div
        className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: 'var(--brand-blue, #008CFC)' }}
      />

      <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8 py-16 relative z-10">
        {/* Top: Logo + tagline + nav columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 mb-14">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-4">
              <ReachLogo variant="dark" height={52} />
            </Link>
            <p className="text-body-sm mb-6 text-gray-400 max-w-[280px]">
              Reaching All Heights — reliable rental and sales solutions for aerial work platforms and material handling equipment across India.
            </p>
            <div className="text-body-sm text-gray-400">
              <p className="font-medium text-white mb-1">Equipment Enquiries &amp; Support</p>
              <Link
                href="/request-a-quote/"
                className="inline-flex items-center gap-1.5 transition-colors font-medium text-sm text-[#008CFC] hover:underline"
              >
                <span>Request a Custom Quote</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Nav columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-4 text-gray-200"
              >
                {section.title}
              </h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-body-sm text-gray-400 hover:text-white hover:translate-x-0.5 inline-block transition-all"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
        >
          <p className="text-caption text-gray-400">
            &copy; 2026 Reach International. All rights reserved.
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
            >
              <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="YouTube"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
            >
              <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21.58 7.19a2.76 2.76 0 0 0-1.95-1.96C17.9 4.75 12 4.75 12 4.75s-5.9 0-7.63.48a2.76 2.76 0 0 0-1.95 1.96C2 8.92 2 12 2 12s0 3.08.42 4.81a2.76 2.76 0 0 0 1.95 1.96c1.73.48 7.63.48 7.63.48s5.9 0 7.63-.48a2.76 2.76 0 0 0 1.95-1.96C22 15.08 22 12 22 12s0-3.08-.42-4.81zM9.75 15.02V8.98L15 12l-5.25 3.02z"/>
              </svg>
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
            >
              <svg className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
