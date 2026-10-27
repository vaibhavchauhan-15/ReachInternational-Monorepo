import type { Metadata } from 'next'
import { Navigation } from '@/components/marketing/navigation/Navigation'
import { SiteFooter } from '@/components/marketing/footer/SiteFooter'
import { StickyActionBar } from '@/components/marketing/sticky-action-bar/StickyActionBar'

// JSON-LD: Organization + WebSite (site-wide marketing schema)
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Reach International',
  url: 'https://www.reachinternational.co.in',
  logo: 'https://www.reachinternational.co.in/images/reach-logo-dark.png',
  sameAs: [],
  description:
    'Reach International provides aerial work platforms, boom lifts, scissor lifts, forklifts and material handling equipment for rental and sale across India.',
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Reach International',
  url: 'https://www.reachinternational.co.in',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://www.reachinternational.co.in/equipment/?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <Navigation />
      <main id="main-content" tabIndex={-1} className="pt-[72px]">
        {children}
      </main>
      <SiteFooter />
      <StickyActionBar />
    </>
  )
}
