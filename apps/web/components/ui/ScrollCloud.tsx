"use client";

import { useEffect, useState } from "react";

/**
 * ScrollCloud — company-standard mobile scroll cloud/dissolve effect.
 *
 * Renders an elegant, feather-light gradient dissolve directly beneath
 * any sticky header that smoothly appears as the user scrolls, softening
 * incoming cards and text as they pass under the header into the canvas background.
 *
 * Fully token-driven (`--color-canvas`) so it adapts seamlessly to both light & dark modes.
 * Adheres strictly to the Vercel Geist design system.
 *
 * Usage:
 *   <div className="sticky top-0 z-40 ...">
 *     <header> ... </header>
 *     <ScrollCloud height={24} intensity="subtle" />
 *   </div>
 */
export interface ScrollCloudProps {
  className?: string;
  /** Cloud height in px (default: 24) */
  height?: number;
  /** scrollY (px) after which the cloud fully appears (default: 10) */
  threshold?: number;
  /** Effect intensity: "subtle" (company standard) | "medium" | "hard" (default: "subtle") */
  intensity?: "subtle" | "medium" | "hard";
}

export function ScrollCloud({
  className = "",
  height = 24,
  threshold = 10,
  intensity = "subtle",
}: ScrollCloudProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const y =
        typeof window !== "undefined"
          ? window.scrollY || document.documentElement.scrollTop || 0
          : 0;
      setProgress(y >= threshold ? 1 : y <= 0 ? 0 : y / threshold);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [threshold]);

  // Clean token-driven gradient fade directly into the canvas background without dirty blur masks
  const gradientClass =
    intensity === "medium"
      ? "bg-gradient-to-b from-[var(--color-canvas)] via-[var(--color-canvas)]/60 to-transparent"
      : intensity === "hard"
      ? "bg-gradient-to-b from-[var(--color-canvas)] via-[var(--color-canvas)]/75 to-transparent"
      : "bg-gradient-to-b from-[var(--color-canvas)] via-[var(--color-canvas)]/40 to-transparent";

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute top-full left-0 right-0 transition-opacity duration-200 ease-out ${className}`}
      style={{ height, opacity: progress }}
    >
      <div className={`absolute inset-0 ${gradientClass}`} />
    </div>
  );
}