'use client';

import React, { useEffect, useRef } from 'react';

interface ParallaxProps {
  children: React.ReactNode;
  range?: number; // ±% range on desktop, e.g. 8 for ±8%
  clipReveal?: boolean;
  className?: string;
  innerClassName?: string;
}

export function Parallax({
  children,
  range = 8,
  clipReveal = false,
  className = '',
  innerClassName = '',
}: ParallaxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const target = targetRef.current;
    if (!container || !target) return;

    if (window.matchMedia('(max-width: 640px), (prefers-reduced-motion: reduce)').matches) {
      target.style.transform = 'none';
      return;
    }

    let mm: any = null;

    Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);

      mm = gsap.matchMedia();

      // Desktop: ±range% (default ±8%)
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          target,
          { yPercent: range },
          {
            yPercent: -range,
            ease: 'none',
            scrollTrigger: {
              trigger: container,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.8,
            },
          }
        );

        if (clipReveal) {
          gsap.fromTo(
            container,
            { clipPath: 'inset(8% 0% 8% 0% round 1rem)' },
            {
              clipPath: 'inset(0% 0% 0% 0% round 1rem)',
              duration: 1.1,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: container,
                start: 'top 85%',
                once: true,
              },
            }
          );
        }
      });

      // Tablet: ±(range / 2)% (default ±4%)
      mm.add('(min-width: 641px) and (max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          target,
          { yPercent: range / 2 },
          {
            yPercent: -(range / 2),
            ease: 'none',
            scrollTrigger: {
              trigger: container,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.8,
            },
          }
        );
      });
    });

    return () => {
      mm?.revert();
    };
  }, [range, clipReveal]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden relative ${className}`}
    >
      <div
        ref={targetRef}
        className={`w-full h-full ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
