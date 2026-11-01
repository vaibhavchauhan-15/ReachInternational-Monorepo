'use client';

import { useEffect, useRef } from 'react';

/**
 * Shared singleton IntersectionObserver for zero-cost scroll reveals.
 * Configuration per plan §5.6: rootMargin "0px 0px -10% 0px", unobserve after first hit.
 */
let sharedObserver: IntersectionObserver | null = null;
const observedElements = new WeakSet<Element>();

function getSharedObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined') return null;

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            sharedObserver?.unobserve(entry.target);
            observedElements.delete(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.1,
      }
    );
  }

  return sharedObserver;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect user's reduced motion preference directly
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-in');
      return;
    }

    const observer = getSharedObserver();
    if (observer && !observedElements.has(el)) {
      observedElements.add(el);
      observer.observe(el);
    }

    return () => {
      if (el && observer) {
        observer.unobserve(el);
        observedElements.delete(el);
      }
    };
  }, []);

  return ref;
}
