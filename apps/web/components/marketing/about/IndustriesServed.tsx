import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { aboutContent } from '@/lib/about/content';
import { primaryIndustries } from '@/lib/data/industries';
import { Reveal } from '@/components/motion/Reveal';

export function IndustriesServed() {
  const { industries } = aboutContent;
  if (!industries.enabled) return null;

  return (
    <section
      id="industries-served"
      aria-labelledby="industries-title"
      className="section-content-visibility py-16 md:py-24 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/40 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-600 dark:text-sky-400">
            Sector Expertise
          </span>
          <h2
            id="industries-title"
            className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            {industries.heading}
          </h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            {industries.subheading}
          </p>
        </div>

        {/* 6 Industry Cards with 80ms Row-wise Stagger */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {primaryIndustries.slice(0, 6).map((ind, idx) => (
            <Reveal key={ind.id} delay={(idx % 3) * 80}>
              <div className="group relative rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/70 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300 flex flex-col justify-between h-full">
                <div className="relative aspect-[16/9] w-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                  <Image
                    src={ind.image}
                    alt={ind.label}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute bottom-3.5 left-4 right-4">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-sky-300 font-semibold">
                      {ind.tag}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      {ind.label}
                    </h3>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {ind.desc}
                  </p>

                  <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                      {ind.stats}
                    </span>
                    <Link
                      href={ind.href || '/equipment'}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 py-1.5 min-h-[44px]"
                    >
                      <span>Explore</span>
                      <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
