"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

const easeOutCubic = [0.16, 1, 0.3, 1] as const;

/** Scroll-reveal wrapper. Quiet automatically under prefers-reduced-motion (globals.css zeroes durations). */
export function Reveal({
  children,
  className = "",
  delay = 0,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: easeOutCubic }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Standard landing section shell: centered max-width container, section vertical rhythm,
 * optional eyebrow + heading + one-line intro. Every landing section composes this so
 * spacing and header treatment stay identical across the page.
 */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  className = "",
  headerClassName = "",
  align = "center",
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "center" | "left";
}) {
  const alignCls = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <section
      id={id}
      className={`relative py-20 md:py-28 px-4 sm:px-6 lg:px-8 ${className}`}
    >
      <div className="max-w-7xl mx-auto">
        {(eyebrow || title || intro) && (
          <Reveal className={`max-w-2xl ${alignCls} mb-12 md:mb-16 ${headerClassName}`}>
            {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
            {title && (
              <h2 className="heading-lg text-[var(--color-ink)] mb-4">{title}</h2>
            )}
            {intro && (
              <p className="body-lg text-[var(--color-body)]">{intro}</p>
            )}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}
