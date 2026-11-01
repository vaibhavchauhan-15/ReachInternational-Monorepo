import React from 'react';
import { ShieldCheck, CheckCircle2, FileCheck2 } from 'lucide-react';
import { aboutContent } from '@/lib/about/content';
import { Reveal } from '@/components/motion/Reveal';

export function SafetyCerts() {
  const { safety } = aboutContent;
  if (!safety.enabled) return null;

  return (
    <section
      id="safety-certifications"
      aria-labelledby="safety-title"
      className="section-content-visibility py-16 md:py-24 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Left Column: Safety Narrative & Commitments */}
          <div className="lg:col-span-6">
            <Reveal delay={0}>
              <span className="text-xs font-mono font-medium tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                Safety First Standard
              </span>
              <h2
                id="safety-title"
                className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.2]"
              >
                {safety.heading}
              </h2>
              <p className="mt-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {safety.subheading}
              </p>

              <div className="mt-8 space-y-4">
                {safety.commitments.map((comm, idx) => (
                  <Reveal key={idx} delay={idx * 60}>
                    <div className="flex items-start gap-3">
                      <div className="size-5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="size-4" />
                      </div>
                      <span className="text-sm sm:text-base text-neutral-800 dark:text-neutral-200 font-medium">
                        {comm}
                      </span>
                    </div>
                  </Reveal>
                ))}
              </div>
            </Reveal>
          </div>

          {/* Right Column: Standards & Badges with 80ms Stagger */}
          <div className="lg:col-span-6 grid grid-cols-1 gap-6">
            {safety.standards.map((std, idx) => (
              <Reveal key={idx} delay={idx * 80}>
                <div className="p-6 sm:p-8 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-3 text-sky-600 dark:text-sky-400 mb-3">
                    <div className="size-10 rounded-xl bg-sky-50 dark:bg-sky-950/70 border border-sky-200/80 dark:border-sky-800/80 flex items-center justify-center">
                      <FileCheck2 className="size-5" />
                    </div>
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {std.name}
                    </h3>
                  </div>
                  <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {std.description}
                  </p>
                </div>
              </Reveal>
            ))}

            <Reveal delay={safety.standards.length * 80}>
              <div className="p-6 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center gap-4">
                <ShieldCheck className="size-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-mono uppercase text-emerald-800 dark:text-emerald-300 font-semibold">
                    100% Certified Handover
                  </p>
                  <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 mt-0.5">
                    Third-party fitness and structural load-testing certificates provided with every machine deployment.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
