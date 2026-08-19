"use client";

import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/Motion";

const WORDMARKS = ["NORTHRIDGE", "ATLAS MINING", "VELOCITY MFG", "IRONWORKS", "MERIDIAN", "CORE LOGISTICS"];

const STATS = [
  { value: 500, suffix: "+", label: "Machines managed", isDecimal: false },
  { value: 50, suffix: "+", label: "Service engineers", isDecimal: false },
  { value: 99.9, suffix: "%", label: "Reminder accuracy", isDecimal: true },
  { value: 24, suffix: "/7", label: "Automated monitoring", isDecimal: false },
];

export function TrustedSection() {
  return (
    <section
      id="trusted"
      className="py-16 border-y border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="eyebrow text-center mb-8">Trusted by industrial operators</p>

        {/* Greyscale wordmark strip */}
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mb-16">
          {WORDMARKS.map((name, idx) => (
            <motion.span
              key={name}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.06 }}
              className="font-mono text-sm font-medium tracking-wide text-[var(--color-mute)]"
            >
              {name}
            </motion.span>
          ))}
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 border-t border-[var(--color-hairline)] pt-12">
          {STATS.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.08 }}
              className="text-center"
            >
              <div className="display-xl text-[var(--color-ink)] mb-2 flex items-baseline justify-center tabular-nums">
                {stat.isDecimal ? <span>99.9</span> : <AnimatedCounter value={stat.value} duration={1.4} />}
                <span>{stat.suffix}</span>
              </div>
              <p className="body-md text-[var(--color-mute)]">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
