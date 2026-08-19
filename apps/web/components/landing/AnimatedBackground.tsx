"use client";

import { motion } from "framer-motion";

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Background Mesh Gradients */}
      <div className="absolute inset-0 mesh-gradient opacity-60 dark:opacity-40" />

      {/* Subtle Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(var(--color-ink) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Radial Center Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-[var(--color-link)]/10 via-[var(--color-violet)]/10 to-transparent blur-[120px] rounded-full" />

      {/* Floating Soft Orbs */}
      <motion.div
        animate={{
          x: [0, 20, 0],
          y: [0, -20, 0],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-20 -right-20 w-[450px] h-[450px] bg-[var(--color-cyan)]/10 blur-[100px] rounded-full"
      />

      <motion.div
        animate={{
          x: [0, -25, 0],
          y: [0, 25, 0],
          scale: [1, 1.08, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-1/3 -left-24 w-[500px] h-[500px] bg-[var(--color-violet)]/10 blur-[120px] rounded-full"
      />
    </div>
  );
}
