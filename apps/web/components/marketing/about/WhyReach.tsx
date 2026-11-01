import React from 'react';
import { Cpu, CheckCircle2, Layers, Clock } from 'lucide-react';
import { aboutContent } from '@/lib/about/content';
import { Reveal } from '@/components/motion/Reveal';

const iconMap: Record<string, React.ElementType> = {
  Cpu,
  CheckCircle2,
  Layers,
  Clock,
};

export function WhyReach() {
  const { whyReach } = aboutContent;
  if (!whyReach.enabled) return null;

  return (
    <section
      id="why-reach"
      aria-labelledby="why-reach-title"
      className="section-content-visibility py-16 md:py-24 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          {/* Left Column: Sticky Heading & Pitch on Desktop (≥1024px) */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 h-fit">
            <Reveal delay={0}>
              <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-600 dark:text-sky-400">
                Operational Edge
              </span>
              <h2
                id="why-reach-title"
                className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white leading-[1.2]"
              >
                {whyReach.heading}
              </h2>
              <p className="mt-4 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {whyReach.subheading}
              </p>

              <div className="mt-8 p-6 rounded-xl border border-sky-200/60 dark:border-sky-800/50 bg-sky-50/50 dark:bg-sky-950/30">
                <p className="text-xs font-mono uppercase text-sky-800 dark:text-sky-300 font-semibold">
                  Zero Downtime Target
                </p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  Every machine undergoes rigorous multi-point functional inspection prior to worksite delivery.
                </p>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Scrolling Differentiators with 80ms Stagger */}
          <div className="lg:col-span-7 space-y-6">
            {whyReach.items.map((item, idx) => {
              const IconComponent = iconMap[item.icon] || CheckCircle2;
              return (
                <Reveal key={idx} delay={idx * 80}>
                  <div className="p-6 sm:p-8 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/60 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex items-start gap-5 sm:gap-6">
                    <div className="size-12 rounded-xl bg-sky-50 dark:bg-sky-950/70 border border-sky-200/80 dark:border-sky-800/80 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
                      <IconComponent className="size-6" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {item.proof}
                      </p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
