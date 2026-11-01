import React from 'react';
import { Award, Compass, Shield } from 'lucide-react';
import { aboutContent } from '@/lib/about/content';
import { Reveal } from '@/components/motion/Reveal';

export function MissionVisionValues() {
  const { mvv } = aboutContent;
  if (!mvv.enabled) return null;

  return (
    <section
      id="mission-vision-values"
      aria-labelledby="mvv-title"
      className="section-content-visibility py-16 md:py-24 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/40 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-600 dark:text-sky-400">
            Core Tenets
          </span>
          <h2
            id="mvv-title"
            className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            Mission, Vision &amp; Operating Values
          </h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            Guiding every equipment dispatch, preventative service inspection, and site safety audit.
          </p>
        </div>

        {/* 1. Mission & Vision Dual Cards with 80ms Stagger */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-8 sm:mb-10">
          <Reveal delay={0}>
            <div className="h-full p-8 sm:p-10 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
              <div className="size-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 border border-sky-200/80 dark:border-sky-800/80 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-6">
                <Award className="size-6" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
                {mvv.mission.title}
              </h3>
              <p className="mt-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {mvv.mission.text}
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="h-full p-8 sm:p-10 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all">
              <div className="size-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 border border-sky-200/80 dark:border-sky-800/80 flex items-center justify-center text-sky-600 dark:text-sky-400 mb-6">
                <Compass className="size-6" />
              </div>
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
                {mvv.vision.title}
              </h3>
              <p className="mt-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {mvv.vision.text}
              </p>
            </div>
          </Reveal>
        </div>

        {/* 2. Core Values 4-Item Grid with Stagger */}
        <Reveal delay={120}>
          <div className="p-8 sm:p-10 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-3 mb-8">
              <div className="size-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Shield className="size-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {mvv.values.title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                  {mvv.values.text}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {mvv.values.items.map((val, idx) => (
                <Reveal key={idx} delay={idx * 80}>
                  <div className="h-full p-5 rounded-xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/60 dark:bg-neutral-900/40 border-l-4 border-l-sky-500">
                    <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                      {val.title}
                    </h4>
                    <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {val.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
