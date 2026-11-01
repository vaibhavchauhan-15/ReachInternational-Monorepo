import React from 'react';
import { aboutContent, isPlaceholder } from '@/lib/about/content';
import { Reveal } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';

export function NumbersStrip() {
  const { numbers } = aboutContent;
  if (!numbers.enabled) return null;

  // Filter out any unconfirmed placeholder stats
  const validStats = numbers.stats.filter(
    (s) => !isPlaceholder(s.label) && s.value > 0
  );

  if (validStats.length === 0) return null;

  return (
    <section
      id="company-stats"
      aria-labelledby="numbers-title"
      className="py-16 bg-neutral-100/60 dark:bg-neutral-900/60 border-y border-neutral-200/80 dark:border-neutral-800/80 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 id="numbers-title" className="sr-only">
          {numbers.heading}
        </h2>
        <Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {validStats.map((stat, idx) => (
              <div key={idx} className="p-4">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-mono tracking-tight text-neutral-900 dark:text-white">
                  <CountUp value={stat.value} duration={1400} />
                  {stat.suffix && <span className="text-sky-600 dark:text-sky-400">{stat.suffix}</span>}
                </div>
                <p className="mt-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 font-medium">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
