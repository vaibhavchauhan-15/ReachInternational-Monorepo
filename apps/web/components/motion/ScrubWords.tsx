'use client';

import React, { useEffect, useRef } from 'react';

interface ScrubWordsProps {
  text: string;
  className?: string;
  wordClassName?: string;
}

export function ScrubWords({
  text,
  className = '',
  wordClassName = '',
}: ScrubWordsProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const words = text.split(/\s+/).filter(Boolean);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const wordSpans = el.querySelectorAll<HTMLSpanElement>('.scrub-word');
    if (!wordSpans || wordSpans.length === 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      wordSpans.forEach((span) => {
        span.style.opacity = '1';
      });
      return;
    }

    let mm: any = null;

    Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);

      mm = gsap.matchMedia();

      // Desktop: scrubbed word opacity from 0.2 to 1.0 (scrub 0.6)
      mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          wordSpans,
          { opacity: 0.2 },
          {
            opacity: 1,
            stagger: 0.08,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top 80%',
              end: 'bottom 50%',
              scrub: 0.6,
            },
          }
        );
      });

      // Mobile & Tablet (<1024px): entrance reveal only (no scrub)
      mm.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          wordSpans,
          { opacity: 0.2 },
          {
            opacity: 1,
            duration: 0.6,
            stagger: 0.03,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              once: true,
            },
          }
        );
      });
    });

    return () => {
      mm?.revert();
    };
  }, []);

  return (
    <span
      ref={containerRef}
      className={className}
      aria-label={text}
      role="text"
    >
      {words.map((word, idx) => (
        <span
          key={idx}
          aria-hidden="true"
          className={`inline-block mr-[0.25em] scrub-word ${wordClassName}`}
          style={{ opacity: 0.2 }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
