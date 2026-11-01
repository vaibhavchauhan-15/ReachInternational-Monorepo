'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Truck, Wrench, Package, ShieldCheck, Award } from 'lucide-react';
import { Service } from '@/lib/about/content';
import { trackEvent } from '@/lib/analytics';

const iconMap: Record<string, React.ElementType> = {
  Truck,
  Wrench,
  Package,
  ShieldCheck,
  Award,
};

interface ServicesStackMotionProps {
  heading: string;
  subheading: string;
  items: Service[];
}

export function ServicesStackMotion({
  heading,
  subheading,
  items,
}: ServicesStackMotionProps) {
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    let mm: any = null;

    Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);

      mm = gsap.matchMedia();

      // ── Desktop (≥1024px): Sticky Stacking Cards with scale 0.94 + slight dim (scrub 0.6) ──
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        const cards = container.querySelectorAll<HTMLElement>('.service-stack-card');

        cards.forEach((card, index) => {
          if (index < cards.length - 1) {
            const nextCard = cards[index + 1];

            gsap.to(card, {
              scale: 0.94,
              opacity: 0.75,
              ease: 'none',
              scrollTrigger: {
                trigger: nextCard,
                start: 'top 350px',
                end: 'top 150px',
                scrub: 0.6,
              },
            });
          }
        });
      });

      // ── Mobile/Tablet (<1024px): Enter reveals ──
      mm.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => {
        const cards = container.querySelectorAll<HTMLElement>('.service-stack-card');
        cards.forEach((card) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 24 },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                once: true,
              },
            }
          );
        });
      });
    });

    return () => {
      mm?.revert();
    };
  }, []);


  return (
    <section
      ref={containerRef}
      id="services"
      aria-labelledby="services-title"
      className="py-16 md:py-24 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12 sm:mb-16">
          <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-600 dark:text-sky-400">
            Commercial Offerings
          </span>
          <h2
            id="services-title"
            className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            {heading}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-neutral-600 dark:text-neutral-400">
            {subheading}
          </p>
        </div>

        {/* ── Stacking Cards Container ── */}
        <div className="space-y-6 lg:space-y-8 relative">
          {items.map((svc, idx) => {
            const IconComponent = iconMap[svc.icon] || Truck;
            return (
              <div
                key={svc.slug}
                className="service-stack-card group relative p-6 sm:p-8 lg:p-10 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors lg:sticky"
                style={{
                  top: `calc(100px + ${idx * 28}px)`,
                  transformOrigin: 'top center',
                }}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start sm:items-center gap-5 sm:gap-6">
                    <div className="size-14 rounded-xl bg-sky-50 dark:bg-sky-950/70 border border-sky-200/80 dark:border-sky-800/80 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                      <IconComponent className="size-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                          0{idx + 1}
                        </span>
                        <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
                          {svc.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
                        {svc.text}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 pt-2 md:pt-0">
                    <Link
                      href={svc.href}
                      onClick={() =>
                        trackEvent('service_card_click', {
                          service_name: svc.title,
                          service_slug: svc.slug,
                        })
                      }
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200/60 dark:border-sky-800/60 transition-colors min-h-[44px]"
                    >
                      <span>Explore category</span>
                      <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
