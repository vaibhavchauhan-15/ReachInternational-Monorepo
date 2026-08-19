"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, animate } from "framer-motion";
import {
  AnimatedArrowRight,
  AnimatedPlayCircle,
} from "@/components/ui/animated-icons";
import { AvatarGroup } from "@/components/ui/Avatar";


const easeOutCubic = [0.16, 1, 0.3, 1] as const;

/* Staggered entrance for the content column. */
const container = {
  hidden: {},
  visible: { transition: { delayChildren: 0.1, staggerChildren: 0.09 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOutCubic },
  },
};

/* Count-up number that runs once when scrolled into view. */
function Counter({
  to,
  suffix = "",
  decimals = 0,
}: {
  to: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.4,
      ease: easeOutCubic,
      onUpdate: (v) => setValue(v),
    });
    return () => controls.stop();
  }, [inView, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

const STATS = [
  { value: 500, suffix: "+", decimals: 0, label: "Machines Managed" },
  { value: 99.9, suffix: "%", decimals: 1, label: "Tracking Accuracy" },
  { value: 3, suffix: "", decimals: 0, label: "Alert Channels" },
];

export function HeroSection() {

  return (
    <section className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      {/* ---- Ambient background decoration ---- */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--color-hairline) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse 90% 60% at 60% 0%, #000 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 60% at 60% 0%, #000 30%, transparent 75%)",
          }}
        />
        {/* Mesh orbs */}
        <div className="absolute -top-24 right-[6%] h-[34rem] w-[34rem] rounded-full blur-[120px] opacity-40 dark:opacity-30">
          <div
            className="h-full w-full rounded-full"
            style={{
              background:
                "conic-gradient(from 120deg, var(--color-violet), var(--color-link), var(--color-cyan), var(--color-pink), var(--color-violet))",
            }}
          />
        </div>
        <div
          className="absolute top-40 -left-24 h-[26rem] w-[26rem] rounded-full blur-[110px] opacity-25"
          style={{
            background:
              "radial-gradient(circle, var(--color-link) 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="visible"
          className="mx-auto max-w-4xl lg:max-w-5xl text-center"
        >
          {/* Headline */}
          <motion.h1
            variants={item}
            className="font-serif font-bold text-5xl sm:text-7xl md:text-8xl lg:text-[5.75rem] xl:text-[6.5rem] tracking-tight leading-[1.08] sm:leading-[1.04] pb-2 text-[var(--color-ink)]"
          >
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #2563eb 0%, #6366f1 35%, #8b5cf6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Never Miss
            </span>{" "}
            <span className="relative inline-block">
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #8b5cf6 0%, #c026d3 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Another
              </span>
              <svg
                viewBox="0 0 240 20"
                className="absolute -bottom-1 sm:-bottom-2 left-0 w-full h-3 sm:h-4 md:h-5 fill-none overflow-visible pointer-events-none"
                preserveAspectRatio="none"
              >
                <path
                  d="M 4 14 Q 120 23 236 8"
                  stroke="#8b5cf6"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #c026d3 0%, #ec4899 50%, #f43f5e 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Deadline.
            </span>
          </motion.h1>

          {/* Sub copy */}
          <motion.p
            variants={item}
            className="body-lg mx-auto mt-6 max-w-md text-[var(--color-body)]"
          >
            REACH INTERNATIONAL automates machine tracking, engineer dispatches, and
            multi-channel alerts — so your fleet stays serviced and your team
            stays ahead, without a single spreadsheet.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={item}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center"
          >
            <Link
              href="/login"
              className="btn-primary group relative w-full overflow-hidden sm:w-auto"
            >
              {/* shine sweep */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              Get Started
              <AnimatedArrowRight size={16} className="ml-1 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#equipment"
              className="btn-secondary group w-full sm:w-auto"
            >
              <AnimatedPlayCircle size={16} className="text-[var(--color-mute)] transition-colors group-hover:text-[var(--color-ink)]" />
              Explore Platform
            </a>
          </motion.div>

          {/* Social proof — user profiles */}
          <motion.div
            variants={item}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5"
          >
            <AvatarGroup
              size="md"
              max={4}
              totalCount={500}
              items={[
                { src: "/images/avatars/avatar-1.jpg", name: "Sarah Jenkins", role: "Service Manager", status: "online" },
                { src: "/images/avatars/avatar-2.jpg", name: "David Chen", role: "Field Engineer", status: "online" },
                { src: "/images/avatars/avatar-3.jpg", name: "Elena Rostova", role: "Operations Director", status: "away" },
                { src: "/images/avatars/avatar-4.jpg", name: "Marcus Vance", role: "Lead Technician", status: "online" },
              ]}
              hoverAnimation
              showTooltip
            />
            <p className="text-xs text-[var(--color-mute)] text-center sm:text-left">
              Trusted by service teams managing
              <span className="font-semibold text-[var(--color-body)]">
                {" "}
                500+ machines
              </span>{" "}
              in the field
            </p>
          </motion.div>


          {/* Stat row with counters */}
          <motion.div
            variants={item}
            className="mt-10 grid grid-cols-3 gap-4 border-t border-[var(--color-hairline)] pt-6"
          >
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="font-mono text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                  <Counter
                    to={s.value}
                    suffix={s.suffix}
                    decimals={s.decimals}
                  />
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-[var(--color-mute)]">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}