"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedArrowRight } from "@/components/ui/animated-icons";

export function CtaSection() {
  return (
    <section className="relative py-24 md:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* The single decorative flourish — hero mesh gradient, faint */}
      <div className="absolute inset-0 mesh-gradient opacity-50 dark:opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-3xl mx-auto text-center"
      >
        <p className="eyebrow mb-4">Get started</p>
        <h2 className="display-xl text-[var(--color-ink)] mb-5">
          Modernize your machine service operations
        </h2>
        <p className="body-lg text-[var(--color-body)] max-w-xl mx-auto mb-8">
          Eliminate missed deadlines, empower field engineers, and prove reliability on demand.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/login" className="btn-primary w-full sm:w-auto">
            Get Started
            <AnimatedArrowRight size={16} className="ml-2" />
          </Link>
          <Link href="/login" className="btn-secondary w-full sm:w-auto">
            Sign in
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
