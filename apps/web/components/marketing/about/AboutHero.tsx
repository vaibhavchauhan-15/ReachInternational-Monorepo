import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChevronRight, ArrowDown } from 'lucide-react';
import { aboutContent } from '@/lib/about/content';
import { Reveal } from '@/components/motion/Reveal';

const AboutHeroScroll = dynamic(
  () => import('./AboutHeroScroll').then((m) => m.AboutHeroScroll)
);

export function AboutHero() {
  const { hero } = aboutContent;
  if (!hero.enabled) return null;

  return (
    <section
      id="about-hero"
      aria-labelledby="about-hero-title"
      className="relative w-full overflow-hidden border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-950 transition-colors"
    >
      <AboutHeroScroll>
        {/* ── Background Fleet Panoramic Layer for Desktop (≥1024px) ── */}
        <div className="hero-bg-image absolute inset-0 z-0 hidden lg:block pointer-events-none select-none">
          <picture className="absolute inset-0 w-full h-full">
            <source media="(min-width: 1024px)" srcSet="/images/hero_fleet_desktop_v4.jpg" />
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
              alt="Reach International aerial work platform machinery fleet on staging apron"
              className="w-full h-full object-cover object-[78%_center]"
              loading="lazy"
            />
          </picture>

          {/* Desktop Light theme scrim: guaranteed ≥4.5:1 text contrast */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300 dark:opacity-0"
            style={{
              background:
                'linear-gradient(90deg, rgba(250, 250, 250, 0.98) 0%, rgba(250, 250, 250, 0.92) 36%, rgba(250, 250, 250, 0.65) 58%, rgba(250, 250, 250, 0.20) 78%, transparent 100%)',
            }}
            aria-hidden="true"
          />

          {/* Desktop Dark theme scrim: atmospheric deep black contrast */}
          <div
            className="absolute inset-0 pointer-events-none opacity-0 dark:opacity-100 transition-opacity duration-300"
            style={{
              background:
                'linear-gradient(90deg, rgba(10, 10, 10, 0.98) 0%, rgba(10, 10, 10, 0.92) 36%, rgba(10, 10, 10, 0.65) 58%, rgba(10, 10, 10, 0.20) 78%, transparent 100%)',
            }}
            aria-hidden="true"
          />
        </div>

        <div className="hero-text-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 pt-4 pb-12 sm:pb-16 lg:py-24 min-h-[calc(100svh-72px)] flex flex-col justify-between">
          <div>
            {/* Breadcrumb Navigation */}
            <nav aria-label="Breadcrumb" className="mb-4">
              <ol className="flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-neutral-400">
                <li>
                  <Link
                    href="/"
                    className="hover:text-neutral-900 dark:hover:text-white transition-colors py-1 inline-flex items-center min-h-[44px]"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">
                  <ChevronRight className="size-3.5 text-neutral-400 dark:text-neutral-600" />
                </li>
                <li className="text-neutral-900 dark:text-white font-medium py-1 inline-flex items-center min-h-[44px]" aria-current="page">
                  About Us
                </li>
              </ol>
            </nav>

            <Reveal>
              {/* Technical Eyebrow */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wide uppercase bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80 mb-5">
                <span className="size-1.5 rounded-full bg-sky-500 animate-pulse" aria-hidden="true" />
                {hero.eyebrow}
              </div>

              {/* Headline with CSS Line-Mask Reveal on Load (700ms, 80ms stagger per plan §4.1) */}
              <h1
                id="about-hero-title"
                className="text-[clamp(2.15rem,4.2vw+1rem,4.5rem)] font-bold tracking-tight text-neutral-900 dark:text-white max-w-3xl leading-[1.1] text-balance"
              >
                <span className="line-mask block">
                  <span className="line-mask-inner" style={{ animationDelay: '0ms' }}>
                    Reaching All Heights —
                  </span>
                </span>
                <span className="line-mask block">
                  <span className="line-mask-inner" style={{ animationDelay: '80ms' }}>
                    for every project that works at height
                  </span>
                </span>
              </h1>

              {/* 1-Line Sub-Statement */}
              <p className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-neutral-600 dark:text-neutral-300 max-w-2xl leading-relaxed">
                {hero.subStatement}
              </p>

              {/* Action Bar */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/#quote-promo"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold text-white bg-sky-700 hover:bg-sky-600 shadow-sm transition-all min-h-[44px] min-w-[140px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                >
                  Request a Quote
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full text-sm font-semibold text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-900/80 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all min-h-[44px] min-w-[120px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
                >
                  Contact Us
                </Link>
              </div>
            </Reveal>
          </div>

          {/* ── Mobile Art-Directed Image (Stacked 4:5 Crop, <1024px) ── */}
          <div className="mt-8 block lg:hidden">
            <div className="relative w-full aspect-[4/5] sm:aspect-[16/9] rounded-xl overflow-hidden border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100 dark:bg-neutral-900 shadow-sm">
              <picture className="absolute inset-0 w-full h-full">
                <source media="(max-width: 1023px)" srcSet="/images/hero_boom_lift.jpg" />
                <img
                  src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E"
                  alt="Reach International telescopic boom lift working at height"
                  fetchPriority="high"
                  className="w-full h-full object-cover object-center"
                />
              </picture>
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Scroll Cue */}
          <div className="pt-8 sm:pt-12 flex items-center gap-2 text-xs font-mono text-neutral-500 dark:text-neutral-400">
            <span className="size-2 rounded-full bg-sky-500 animate-ping inline-block" aria-hidden="true" />
            <span>Scroll to explore our fleet &amp; story</span>
            <ArrowDown className="size-3.5 animate-bounce ml-1 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          </div>
        </div>
      </AboutHeroScroll>
    </section>
  );
}
