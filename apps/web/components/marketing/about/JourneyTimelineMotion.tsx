'use client';

import React, { useEffect, useRef } from 'react';
import { Milestone } from '@/lib/about/content';

interface JourneyTimelineMotionProps {
  milestones: Milestone[];
  heading: string;
  subheading: string;
}

export function JourneyTimelineMotion({
  milestones,
  heading,
  subheading,
}: JourneyTimelineMotionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const progressLineRef = useRef<HTMLDivElement | null>(null);
  const verticalProgressRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const progressLine = progressLineRef.current;
    const verticalProgress = verticalProgressRef.current;

    if (!section) return;

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

      // ── Desktop (≥1024px): Pinned Horizontal Scrub ──
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        if (!track) return;

        const scrollDistance = () => track.scrollWidth - track.clientWidth + 100;

        // Pinned horizontal translation
        gsap.to(track, {
          x: () => -scrollDistance(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            pin: true,
            start: 'top 72px',
            end: () => `+=${scrollDistance() + 200}`,
            scrub: 0.8,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });

        // Horizontal progress line fill
        if (progressLine) {
          gsap.fromTo(
            progressLine,
            { scaleX: 0, transformOrigin: 'left center' },
            {
              scaleX: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: section,
                start: 'top 72px',
                end: () => `+=${scrollDistance() + 200}`,
                scrub: 0.8,
                invalidateOnRefresh: true,
              },
            }
          );
        }
      });

      // ── Mobile/Tablet (<1024px): Vertical Timeline with Vertical Progress Line (NO PINNING) ──
      mm.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => {
        if (verticalProgress) {
          gsap.fromTo(
            verticalProgress,
            { scaleY: 0, transformOrigin: 'top center' },
            {
              scaleY: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: section,
                start: 'top 80%',
                end: 'bottom 80%',
                scrub: 0.6,
              },
            }
          );
        }

        // Enter reveal for vertical items
        const items = section.querySelectorAll<HTMLElement>('.vertical-timeline-item');
        items.forEach((item) => {
          gsap.fromTo(
            item,
            { opacity: 0, y: 20 },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: item,
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
      ref={sectionRef}
      id="our-journey"
      aria-labelledby="journey-title"
      className="py-16 lg:py-20 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-950/40 transition-colors overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 sm:mb-12">
        <div className="max-w-3xl">
          <span className="text-xs font-mono font-medium tracking-wider uppercase text-sky-600 dark:text-sky-400">
            Our Trajectory
          </span>
          <h2
            id="journey-title"
            className="mt-2 text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white"
          >
            {heading}
          </h2>
          <p className="mt-3 text-base text-neutral-600 dark:text-neutral-400">
            {subheading}
          </p>
        </div>

        {/* Desktop Horizontal Progress Track Bar */}
        <div className="hidden lg:block relative w-full h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden mt-6">
          <div
            ref={progressLineRef}
            className="absolute top-0 left-0 bottom-0 w-full bg-sky-500 rounded-full"
            style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
          />
        </div>
      </div>

      {/* ── Desktop Pinned Horizontal Container (≥1024px) ── */}
      <div className="hidden lg:block w-full overflow-hidden">
        <div
          ref={trackRef}
          className="flex items-stretch gap-8 px-8 sm:px-12 w-max min-w-full pb-4"
        >
          {milestones.map((item, idx) => (
            <div
              key={idx}
              className="w-[360px] xl:w-[400px] shrink-0 p-8 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 font-mono text-sm font-bold rounded-lg bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80">
                    {item.year}
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    Phase {idx + 1}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mobile/Tablet Vertical Timeline (<1024px) ── */}
      <div className="block lg:hidden px-4 sm:px-6">
        <div className="relative pl-6 sm:pl-8 max-w-2xl mx-auto">
          {/* Vertical Progress Track */}
          <div
            className="absolute left-[11px] sm:left-[15px] top-3 bottom-3 w-0.5 bg-neutral-200 dark:bg-neutral-800"
            aria-hidden="true"
          >
            <div
              ref={verticalProgressRef}
              className="absolute top-0 left-0 w-full h-full bg-sky-500"
              style={{ transform: 'scaleY(0)', transformOrigin: 'top center' }}
            />
          </div>

          <div className="space-y-8 sm:space-y-10">
            {milestones.map((item, idx) => (
              <div
                key={idx}
                className="vertical-timeline-item relative flex items-start gap-4 sm:gap-6"
              >
                {/* Milestone Node Dot */}
                <div
                  className="absolute -left-[19px] sm:-left-[23px] top-1.5 size-4 rounded-full border-2 border-sky-600 dark:text-sky-400 bg-white dark:bg-neutral-950 ring-4 ring-neutral-50 dark:ring-neutral-950"
                  aria-hidden="true"
                />

                <div className="p-6 rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-neutral-900/70 shadow-sm flex-1">
                  <span className="inline-block px-2.5 py-0.5 font-mono text-xs font-bold rounded-md bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60 mb-2">
                    {item.year}
                  </span>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
