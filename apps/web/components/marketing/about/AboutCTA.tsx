'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Phone } from 'lucide-react';
import { aboutContent } from '@/lib/about/content';
import { Reveal } from '@/components/motion/Reveal';
import { AboutStickyMobileCta } from './AboutStickyMobileCta';
import { trackEvent } from '@/lib/analytics';

export function AboutCTA() {
  const { cta } = aboutContent;
  if (!cta.enabled) return null;

  const quoteHref = cta.primaryCta.href === '/#quote-promo' ? '/request-a-quote' : cta.primaryCta.href;

  return (
    <>
      <section
        id="about-cta"
        aria-labelledby="cta-title"
        className="section-content-visibility py-20 md:py-32 bg-neutral-900 text-white relative overflow-hidden"
      >
        {/* Subtle Background Glow Accent with pure transform/opacity shift */}
        <div
          className="cta-glow-animate absolute top-0 right-1/4 w-[600px] h-[360px] rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: '#0284c7' }}
          aria-hidden="true"
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <Reveal delay={0}>
            <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-400">
              Work With Us
            </span>
            <h2
              id="cta-title"
              className="mt-3 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12] text-balance"
            >
              {cta.heading}
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <p className="mt-5 text-base sm:text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto leading-relaxed">
              {cta.subheading}
            </p>
          </Reveal>

          <Reveal delay={160}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={quoteHref}
                onClick={() => trackEvent('about_cta_quote', { location: 'about_bottom_cta' })}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-md hover:shadow-lg transition-all min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              >
                <span>{cta.primaryCta.label}</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={cta.secondaryCta.href}
                onClick={() => trackEvent('about_cta_contact', { location: 'about_bottom_cta' })}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold text-white border border-neutral-700 hover:bg-neutral-800 transition-all min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
              >
                <Phone className="size-4" />
                <span>{cta.secondaryCta.label}</span>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8">
              <Link
                href={cta.careersLink.href}
                className="text-xs sm:text-sm text-neutral-400 hover:text-white transition-colors underline-offset-4 hover:underline py-2 inline-flex items-center min-h-[44px]"
              >
                {cta.careersLink.label}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Sticky Mobile CTA Bar (applies after scrolling past hero) */}
      <AboutStickyMobileCta />
    </>
  );
}
