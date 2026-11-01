'use client';

import React, { useEffect, useRef } from 'react';

export function AboutHeroScroll({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Only load GSAP scroll parallax on desktop fine-pointer with motion preferred
    const isDesktop = window.innerWidth >= 1024 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!isDesktop) return;

    let mm: any = null;

    Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);

      const root = rootRef.current;
      if (!root) return;

      const bgImg = root.querySelector<HTMLElement>('.hero-bg-image');
      const content = root.querySelector<HTMLElement>('.hero-text-content');

      mm = gsap.matchMedia();

      // Desktop: image scale 1.08 -> 1, text lifts yPercent: -12
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        if (bgImg) {
          gsap.fromTo(
            bgImg,
            { scale: 1.08, transformOrigin: 'center center' },
            {
              scale: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: root,
                start: 'top top',
                end: 'bottom top',
                scrub: 0.6,
              },
            }
          );
        }

        if (content) {
          gsap.to(content, {
            yPercent: -12,
            ease: 'none',
            scrollTrigger: {
              trigger: root,
              start: 'top top',
              end: 'bottom top',
              scrub: 0.6,
            },
          });
        }
      });
    });

    return () => {
      mm?.revert();
    };
  }, []);

  return (
    <div ref={rootRef} className="relative w-full overflow-hidden">
      {children}
    </div>
  );
}
