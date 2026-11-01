'use client';

import React, { useEffect } from 'react';

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 1. Disable under reduced motion, touch devices, or < 1024px viewport
    const isTouch = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 1024;
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || isReducedMotion) return;

    let lenis: any = null;
    let tickerCallback: any = null;

    Promise.all([
      import('lenis'),
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]).then(([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({
        lerp: 0.1,
        autoRaf: false,
      });

      // Expose to window for modal dialog pause/resume
      (window as any).__lenis = lenis;

      lenis.on('scroll', () => {
        ScrollTrigger.update();
      });

      tickerCallback = (time: number) => {
        lenis?.raf(time * 1000);
      };

      gsap.ticker.add(tickerCallback);
      gsap.ticker.lagSmoothing(0);

      // Refresh ScrollTrigger after web fonts and images settle
      if (typeof document !== 'undefined' && 'fonts' in document) {
        document.fonts.ready.then(() => {
          ScrollTrigger.refresh();
        });
      }
      setTimeout(() => {
        ScrollTrigger.refresh();
      }, 1000);
    });

    return () => {
      if (tickerCallback) {
        import('gsap').then(({ gsap }) => gsap.ticker.remove(tickerCallback));
      }
      lenis?.destroy();
      if (typeof window !== 'undefined') {
        (window as any).__lenis = null;
      }
    };
  }, []);

  return <>{children}</>;
}

export default SmoothScrollProvider;

