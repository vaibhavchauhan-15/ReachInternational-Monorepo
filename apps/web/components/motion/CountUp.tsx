'use client';

import React, { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  suffix?: string;
  duration?: number; // duration in ms, default 1400ms (1.4s)
  className?: string;
}

/**
 * rAF-based numerical count-up component.
 * Triggers once when 40% of the element enters the viewport.
 * Respects prefers-reduced-motion by immediately displaying the target number.
 */
export function CountUp({
  value,
  suffix = '',
  duration = 1400,
  className = '',
}: CountUpProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const elRef = useRef<HTMLSpanElement | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    // Reduced motion bypass
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true;
          observer.unobserve(el);

          const startTime = performance.now();

          const updateCount = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Cubic ease-out: 1 - (1 - progress)^3
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            const currentCount = Math.round(easeOutProgress * value);

            setDisplayValue(currentCount);

            if (progress < 1) {
              requestAnimationFrame(updateCount);
            } else {
              setDisplayValue(value);
            }
          };

          requestAnimationFrame(updateCount);
        }
      },
      {
        threshold: 0.4, // Triggers when 40% visible per plan §4.3
      }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [value, duration]);

  return (
    <span ref={elRef} className={className}>
      {displayValue}
      {suffix}
    </span>
  );
}
