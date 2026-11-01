import React from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { aboutContent } from '@/lib/about/content';
import { Reveal } from '@/components/motion/Reveal';

const ScrubWords = dynamic(
  () => import('@/components/motion/ScrubWords').then((m) => m.ScrubWords)
);

const Parallax = dynamic(
  () => import('@/components/motion/Parallax').then((m) => m.Parallax)
);

export function WhoWeAre() {
  const { whoWeAre } = aboutContent;
  if (!whoWeAre.enabled) return null;

  return (
    <section
      id="who-we-are"
      aria-labelledby="who-we-are-title"
      className="py-16 md:py-24 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
            {/* Left Column: Narrative with ScrubWords */}
            <div className="lg:col-span-7">
              <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-600 dark:text-sky-400">
                Company Overview
              </span>
              <h2
                id="who-we-are-title"
                className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.2]"
              >
                {whoWeAre.heading}
              </h2>

              {/* Large statement paragraph with scrubbed word opacity (0.2 -> 1, scrub 0.6) on desktop */}
              <p className="mt-6 text-xl sm:text-2xl lg:text-[1.75rem] font-semibold text-neutral-800 dark:text-neutral-100 leading-snug tracking-tight">
                <ScrubWords
                  text={whoWeAre.leadStatement}
                  wordClassName="transition-colors duration-150"
                />
              </p>

              {/* Supporting context */}
              <p className="mt-6 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl">
                {whoWeAre.supportingParagraph}
              </p>

              {/* Key Trust Highlights */}
              <div className="mt-8 pt-6 border-t border-neutral-200/80 dark:border-neutral-800/80 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-mono uppercase text-neutral-500 dark:text-neutral-400">
                    Fleet Deployment
                  </p>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white mt-0.5">
                    Nationwide India Coverage
                  </p>
                </div>
                <div>
                  <p className="text-xs font-mono uppercase text-neutral-500 dark:text-neutral-400">
                    Maintenance Standard
                  </p>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white mt-0.5">
                    100% OEM PDI Certified
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Fleet Image with Parallax & Clip-path reveal */}
            <div className="lg:col-span-5">
              <Parallax range={8} clipReveal className="rounded-2xl shadow-sm">
                <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-100 dark:bg-neutral-900">
                  <Image
                    src={whoWeAre.image.src}
                    alt={whoWeAre.image.alt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 480px"
                    className="object-cover scale-105"
                  />
                </div>
              </Parallax>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
