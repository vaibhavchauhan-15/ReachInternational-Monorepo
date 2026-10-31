'use client'

import { usePathname } from 'next/navigation'
import { Button } from '@/components/marketing/ui/button'
import { Phone, ArrowRight } from 'lucide-react'

/**
 * StickyActionBar — mobile-only persistent bottom bar with Call and Quote CTA.
 * Hidden on /contact/ and /request-a-quote/ to avoid covering those forms.
 * Respects safe-area insets.
 */
export function StickyActionBar() {
  const pathname = usePathname()
  const hidden = pathname === '/contact/' || pathname === '/request-a-quote/'

  if (hidden) return null

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex gap-2.5 px-4 py-3"
      style={{
        backgroundColor: 'var(--surface-base)',
        borderTop: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <Button
        href="tel:+919910221405"
        color="secondary"
        size="md"
        className="flex-1 rounded-xl h-11"
        iconLeading={Phone}
        aria-label="Call Reach International (+91 9910221405)"
      >
        Call us
      </Button>
      <Button
        href="/request-a-quote/"
        color="primary"
        size="md"
        className="flex-1 rounded-xl h-11"
        iconTrailing={ArrowRight}
      >
        Request a quote
      </Button>
    </div>
  )
}
