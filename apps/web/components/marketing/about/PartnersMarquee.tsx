import React from 'react';
import Image from 'next/image';
import { aboutContent } from '@/lib/about/content';
import { Reveal } from '@/components/motion/Reveal';

const oemBrands = [
  { name: 'JCB', light: '/images/brands/jcb.svg', dark: '/images/brands/jcb_dark.svg' },
  { name: 'Genie', light: '/images/brands/genie.svg', dark: '/images/brands/genie_dark.svg' },
  { name: 'JLG', light: '/images/brands/jlg.svg', dark: '/images/brands/jlg_dark.svg' },
  { name: 'BYD', light: '/images/brands/byd.svg', dark: '/images/brands/byd_dark.svg' },
  { name: 'Toyota', light: '/images/brands/toyota.svg', dark: '/images/brands/toyota_dark.svg' },
  { name: 'Hyundai', light: '/images/brands/hyundai.svg', dark: '/images/brands/hyundai_dark.svg' },
];

export function PartnersMarquee() {
  const { partners } = aboutContent;
  if (!partners.enabled) return null;

  return (
    <section
      id="partners-brands"
      aria-labelledby="partners-title"
      className="section-content-visibility py-16 md:py-24 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/40 overflow-hidden transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10 sm:mb-12">
        <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-600 dark:text-sky-400">
          Global OEM Standards
        </span>
        <h2
          id="partners-title"
          className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white"
        >
          {partners.heading}
        </h2>
        <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
          {partners.subheading}
        </p>

        {/* Screen Reader Accessible List (§8 / §4.10) */}
        <ul className="sr-only">
          {oemBrands.map((b) => (
            <li key={b.name}>{b.name} heavy access machinery and material handling equipment</li>
          ))}
        </ul>
      </div>

      <Reveal>
        {/* Continuous Infinite CSS Marquee Track */}
        <div className="relative w-full overflow-hidden mask-gradient-x py-2" aria-hidden="true">
          <div className="animate-marquee gap-6 sm:gap-8 px-4">
            {/* Set 1 */}
            {oemBrands.concat(oemBrands).map((brand, idx) => (
              <div
                key={`${brand.name}-${idx}`}
                className="h-20 w-44 sm:w-48 rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/70 p-4 flex items-center justify-center grayscale hover:grayscale-0 transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.04)] shrink-0"
              >
                <div className="relative w-full h-9 flex items-center justify-center">
                  <Image
                    src={brand.light}
                    alt=""
                    width={110}
                    height={36}
                    className="object-contain dark:hidden max-h-9 w-auto"
                  />
                  <Image
                    src={brand.dark}
                    alt=""
                    width={110}
                    height={36}
                    className="object-contain hidden dark:block max-h-9 w-auto"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
