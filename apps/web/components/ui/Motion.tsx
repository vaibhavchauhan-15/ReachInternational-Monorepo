"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ReactNode, useEffect, useState, useRef } from "react";

// Vercel / Linear standard easing curves
export const defaultTransitions = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1] as const,
};

export const fastTransition = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1] as const,
};

export const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

export const cardEntranceTransition = {
  duration: 0.4,
  ease: [0.16, 1, 0.3, 1] as const,
};

export function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
      transition={{ ...defaultTransitions, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlideUp({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      transition={{ ...defaultTransitions, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
      transition={{ ...defaultTransitions, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerChildren({
  children,
  className = "",
  staggerDelay = 0.04,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: reduceMotion ? 0 : staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: reduceMotion ? 0 : 6 },
        visible: {
          opacity: 1,
          y: 0,
          transition: defaultTransitions,
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedCounter({
  value,
  duration = 0.6,
  className = "",
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const displayValRef = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Respect reduced motion — jump straight to the value
    if (reduceMotion) {
      const handle = requestAnimationFrame(() => {
        setDisplayValue(value);
        displayValRef.current = value;
      });
      return () => cancelAnimationFrame(handle);
    }

    let startTimestamp: number | null = null;
    const startValue = displayValRef.current;
    const endValue = value;

    if (startValue === endValue) return;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(startValue + (endValue - startValue) * easedProgress);
      setDisplayValue(current);
      displayValRef.current = current;

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
        displayValRef.current = endValue;
      }
    };

    const animId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(animId);
  }, [value, duration, reduceMotion]);

  return <span className={`inline-block font-bold tracking-tight tabular-nums ${className}`}>{displayValue}</span>;
}

export function AnimatedBadge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      initial={{ scale: reduceMotion ? 1 : 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={fastTransition}
      className={className}
    >
      {children}
    </motion.span>
  );
}

export function AnimatedProgress({
  value,
  max = 100,
  className = "",
  barClassName = "bg-[var(--color-link)]",
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}) {
  const reduceMotion = useReducedMotion();
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`w-full bg-[var(--color-hairline)] rounded-full h-1.5 overflow-hidden ${className}`}>
      <motion.div
        className={`h-full ${barClassName}`}
        initial={{ width: reduceMotion ? `${percentage}%` : 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
      />
    </div>
  );
}

export { AnimatePresence };