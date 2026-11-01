'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Phone } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

export function AboutStickyMobileCta() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const heroEl = document.getElementById('about-hero');
    if (!heroEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar only when hero is scrolled past
        setIsVisible(!entry.isIntersecting);
      },
      {
        threshold: 0.1,
      }
    );

    observer.observe(heroEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 block md:hidden bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-neutral-200/80 dark:border-neutral-800/80 p-3 shadow-lg transition-transform duration-300"
      style={{
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
      }}
      role="region"
      aria-label="Mobile quick action bar"
    >
      <div className="flex items-center gap-3">
        <Link
          href="/request-a-quote"
          onClick={() => trackEvent('about_cta_quote', { location: 'sticky_mobile_bar' })}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-white bg-sky-600 active:bg-sky-700 min-h-[44px] shadow-sm transition-colors"
        >
          <span>Request Quote</span>
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          href="/contact"
          onClick={() => trackEvent('about_cta_contact', { location: 'sticky_mobile_bar' })}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 active:bg-neutral-200 border border-neutral-300 dark:border-neutral-700 min-h-[44px] transition-colors"
        >
          <Phone className="size-3.5" />
          <span>Contact Us</span>
        </Link>
      </div>
    </div>
  );
}
