'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';

// Split Lenis and GSAP ticker out of critical first-load bundle per plan §5
const SmoothScroll = dynamic(
  () => import('@/components/motion/SmoothScrollProvider').then((mod) => mod.SmoothScrollProvider),
  { ssr: false }
);

export function AboutScrollWrapper({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only load smooth scroll on desktop fine pointer
    if (window.innerWidth >= 1024 && !window.matchMedia('(pointer: coarse)').matches) {
      setMounted(true);
    }
  }, []);

  return (
    <>
      {children}
      {mounted && <SmoothScroll>{null}</SmoothScroll>}
    </>
  );
}
