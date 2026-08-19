"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  AnimatedArrowRight,
  AnimatedBell,
  AnimatedCamera,
  AnimatedCheckCircle,
  AnimatedChevronLeft,
  AnimatedClock,
  AnimatedGauge,
  AnimatedMapPin,
  AnimatedPlus,
  AnimatedWrench,
  AnimatedPhone,
  AnimatedRotateCw,
  AnimatedSend,
} from "@/components/ui/animated-icons";
import { CheckCircle2, ArrowRight, Signal, Wifi, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Section } from "./_shared/Section";


const CHECKLIST = [
  { id: 1, icon: AnimatedRotateCw, title: "Inspect hydraulic lines", meta: "Pressure + leak check", time: "8 min", done: true },
  { id: 2, icon: AnimatedRotateCw, title: "Replace air filter", meta: "Part #AF-2209", time: "5 min", done: true },
  { id: 3, icon: AnimatedWrench, title: "Replace coolant", meta: "Drain + refill 4L", time: "12 min", done: true },
  { id: 4, icon: AnimatedGauge, title: "Calibrate spindle", meta: "Runout tolerance 0.01mm", time: "15 min", done: false },
];

export function EngineerMobileSection() {
  const reduce = useReducedMotion();
  const [items, setItems] = useState(CHECKLIST);
  const [islandExpanded, setIslandExpanded] = useState(false);

  const toggleItem = (id: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
    );
  };

  const doneCount = items.filter((c) => c.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const R = 26;
  const CIRC = 2 * Math.PI * R;

  return (
    <Section id="mobile">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left Column: Descriptive Copy */}
        <div className="max-w-xl">
          <h2 className="heading-lg text-[var(--color-ink)] mb-4 tracking-tight">
            Built for engineers on the factory floor
          </h2>
          
          <p className="body-lg text-[var(--color-body)] mb-8 leading-relaxed">
            Log maintenance tasks, capture high-res photo proof, run offline diagnostics, and sign off work orders on both Android and iOS devices.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {[
              { title: "Guided Checklists", desc: "Step-by-step procedures with tolerance thresholds" },
              { title: "Visual Proofing", desc: "Timestamped & geo-tagged photo evidence per job" },
              { title: "GPS Check-Ins", desc: "Instant location confirmation at factory bay" },
              { title: "Offline Syncing", desc: "Full operation in zero-connectivity plant areas" },
            ].map((f) => (
              <div key={f.title} className="p-3.5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]/60">
                <div className="flex items-center gap-2 font-semibold text-[14px] text-[var(--color-ink)] mb-1">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-success)] shrink-0" />
                  {f.title}
                </div>
                <p className="text-[12px] text-[var(--color-mute)] leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link href="/login" className="btn-primary px-6 py-3 text-[14px]">
              Launch Engineer Portal
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>

        {/* Right Column: Real Smartphone Frame (19.5:9 Aspect Ratio) */}
        <div className="flex justify-center items-center py-4">
          <div className="relative group">
            {/* Float Motion Container */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, -10, 0] }}
                transition={reduce ? undefined : { duration: 7, repeat: Infinity, ease: "easeInOut" }}
                className="relative w-[340px] sm:w-[375px] h-[720px] sm:h-[760px]"
              >
                {/* Physical Smartphone Side Buttons */}
                {/* Left Side: Action Button */}
                <div className="absolute -left-[3px] top-[105px] w-[3px] h-[24px] bg-[#2d323e] rounded-l-md z-10 shadow-sm" />
                {/* Left Side: Volume Up */}
                <div className="absolute -left-[3px] top-[148px] w-[3px] h-[48px] bg-[#2d323e] rounded-l-md z-10 shadow-sm" />
                {/* Left Side: Volume Down */}
                <div className="absolute -left-[3px] top-[208px] w-[3px] h-[48px] bg-[#2d323e] rounded-l-md z-10 shadow-sm" />
                {/* Right Side: Power Button */}
                <div className="absolute -right-[3px] top-[165px] w-[3px] h-[68px] bg-[#2d323e] rounded-r-md z-10 shadow-sm" />

                {/* Ultra-Realistic iPhone Pro Titanium Frame */}
                <div className="w-full h-full rounded-[52px] p-[10px] bg-gradient-to-b from-[#2a2e39] via-[#1a1d24] to-[#121419] border border-[#3f4554] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.25)] relative overflow-hidden">
                  
                  {/* Subtle Inner Bezel Chamfer Reflection */}
                  <div className="absolute inset-0 rounded-[52px] border border-white/10 pointer-events-none" />

                  {/* Super Retina OLED Display Canvas */}
                  <div className="relative w-full h-full rounded-[44px] bg-[var(--color-canvas)] overflow-hidden flex flex-col shadow-inner select-none">
                    
                    {/* Top Speaker Slit */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[50px] h-[3px] bg-[#090a0c] rounded-full z-50 opacity-90" />

                    {/* Dynamic Island (Interactive Live Activity Pill) */}
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-40">
                      <motion.button
                        onClick={() => setIslandExpanded(!islandExpanded)}
                        animate={{
                          width: islandExpanded ? 240 : 115,
                          height: islandExpanded ? 46 : 32,
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="bg-black text-white rounded-full flex items-center justify-between px-3 shadow-lg overflow-hidden cursor-pointer"
                      >
                        {/* Dynamic Island Camera Lens & TrueDepth Sensor */}
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full bg-[#0a0d14] ring-1 ring-white/15 flex items-center justify-center shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#1b2338]" />
                          </div>
                          {islandExpanded && (
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse shrink-0" />
                              <span className="text-[11px] font-semibold text-white truncate">
                                Haas VF-2 Service Live
                              </span>
                            </div>
                          )}
                        </div>

                        {islandExpanded ? (
                          <span className="text-[11px] font-mono text-[var(--color-success)] font-semibold">
                            {pct}%
                          </span>
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-blue-500/30 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          </div>
                        )}
                      </motion.button>
                    </div>

                    {/* iOS Status Bar */}
                    <div className="flex items-center justify-between px-7 pt-3.5 pb-1 text-[var(--color-ink)] z-30 font-medium">
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-semibold tracking-tight">9:41</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] opacity-90" title="Location active" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Signal className="w-3.5 h-3.5" strokeWidth={2.5} />
                        <Wifi className="w-3.5 h-3.5" strokeWidth={2.5} />
                        {/* iPhone Battery Capsule */}
                        <div className="flex items-center gap-1 border border-[var(--color-ink)]/40 rounded-[5px] px-1 py-0.5 h-3.5 w-6 relative">
                          <div className="h-full bg-[var(--color-ink)] rounded-[2px]" style={{ width: "85%" }} />
                          <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0.5 h-1.5 bg-[var(--color-ink)]/60 rounded-r-full" />
                        </div>
                      </div>
                    </div>

                    {/* Native App Top Navigation Bar */}
                    <div className="flex items-center justify-between px-5 pt-3 pb-2.5 border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/80 backdrop-blur-md sticky top-0 z-20">
                      <button className="w-8 h-8 grid place-items-center rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] active:scale-95 transition-transform">
                        <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
                      </button>
                      <div className="text-center">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-mute)] block">
                          Maintenance Order
                        </span>
                        <h1 className="text-[14px] font-bold text-[var(--color-ink)] leading-none mt-0.5">
                          #WO-4471
                        </h1>
                      </div>
                      <button className="relative w-8 h-8 grid place-items-center rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] active:scale-95 transition-transform">
                        <AnimatedBell size={16} />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-error)] ring-2 ring-[var(--color-canvas)]" />
                      </button>
                    </div>

                    {/* Scrollable iOS Content Body */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-none">
                      {/* Machine Work Order Banner */}
                      <div className="rounded-[22px] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-[var(--shadow-whisper)]">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-warning-soft)] text-[var(--color-warning-deep)] mb-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning-deep)] animate-pulse" />
                              High Priority
                            </span>
                            <h3 className="text-[16px] font-bold text-[var(--color-ink)] leading-tight">
                              Haas VF-2 CNC Mill
                            </h3>
                            <div className="text-[11px] font-mono text-[var(--color-mute)] mt-0.5">
                              Asset Code: MCH-4471
                            </div>
                          </div>
                          
                          <div className="flex gap-1.5">
                            <button className="w-8 h-8 rounded-full bg-[var(--color-hairline-soft)] grid place-items-center text-[var(--color-ink)] active:scale-90 transition-transform">
                              <AnimatedPhone size={14} />
                            </button>
                            <button className="w-8 h-8 rounded-full bg-[var(--color-hairline-soft)] grid place-items-center text-[var(--color-ink)] active:scale-90 transition-transform">
                              <AnimatedMapPin size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="h-px bg-[var(--color-hairline)] my-3" />

                        <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[12px]">
                          <div>
                            <span className="text-[10px] uppercase font-mono text-[var(--color-mute)]">Client</span>
                            <p className="font-semibold text-[var(--color-ink)]">Meridian Steel</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-mono text-[var(--color-mute)]">Due Time</span>
                            <p className="font-semibold text-[var(--color-error)]">Today · 4:00 PM</p>
                          </div>
                          <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-[var(--color-body)] mt-1">
                            <AnimatedMapPin size={14} className="text-[var(--color-primary)] shrink-0" />
                            Facility A · CNC Bay 4, Pune Works
                          </div>
                        </div>

                        {/* Engineer Info */}
                        <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[var(--color-hairline-soft)]/70 px-3 py-2">
                          <div className="w-7 h-7 rounded-full bg-[var(--color-ink)] text-[var(--color-on-primary)] font-bold text-[11px] grid place-items-center shrink-0">
                            AR
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-bold text-[var(--color-ink)] leading-none truncate">
                              Aarav R.
                            </div>
                            <div className="text-[10px] text-[var(--color-mute)] mt-0.5">
                              Lead Technician
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-success-deep)]">
                            <AnimatedClock size={14} /> ~35m left
                          </div>
                        </div>
                      </div>

                      {/* Service Progress Radial Ring */}
                      <div className="rounded-[22px] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-[var(--shadow-whisper)] flex items-center gap-4">
                        <div className="relative w-16 h-16 shrink-0">
                          <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                            <circle cx="32" cy="32" r={R} fill="none" strokeWidth="5.5" className="stroke-[var(--color-hairline)]" />
                            <motion.circle
                              cx="32"
                              cy="32"
                              r={R}
                              fill="none"
                              strokeWidth="5.5"
                              strokeLinecap="round"
                              className="stroke-[var(--color-success)]"
                              strokeDasharray={CIRC}
                              animate={{ strokeDashoffset: CIRC * (1 - pct / 100) }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                            />
                          </svg>
                          <div className="absolute inset-0 grid place-items-center">
                            <span className="text-[15px] font-extrabold text-[var(--color-ink)]">{pct}%</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[13px] font-bold text-[var(--color-ink)]">
                            Service Checklist
                          </div>
                          <div className="text-[12px] text-[var(--color-mute)] mt-0.5">
                            {doneCount} of {items.length} checklist items complete
                          </div>
                          <div className="text-[11px] text-[var(--color-success-deep)] font-semibold mt-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                            {items.length - doneCount > 0 ? `${items.length - doneCount} action item remaining` : "All tasks finished!"}
                          </div>
                        </div>
                      </div>

                      {/* Interactive Checklist Cards */}
                      <div className="rounded-[22px] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-2 shadow-[var(--shadow-whisper)]">
                        <div className="px-2 py-1 flex items-center justify-between mb-1">
                          <span className="text-[11px] font-mono uppercase font-bold text-[var(--color-mute)]">
                            Tasks ({doneCount}/{items.length})
                          </span>
                          <span className="text-[10px] text-[var(--color-primary)] font-semibold">Tap to toggle</span>
                        </div>
                        <div className="space-y-1">
                          {items.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => toggleItem(item.id)}
                                className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
                                  item.done
                                    ? "bg-[var(--color-hairline-soft)]/50"
                                    : "bg-[var(--color-canvas)] border border-[var(--color-hairline)]"
                                }`}
                              >
                                <span
                                  className={`w-8 h-8 shrink-0 grid place-items-center rounded-xl transition-colors ${
                                    item.done
                                      ? "bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)] text-[var(--color-success-deep)]"
                                      : "bg-[var(--color-hairline-soft)] text-[var(--color-mute)]"
                                  }`}
                                >
                                  <ItemIcon size={16} />
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div
                                    className={`text-[12px] font-semibold leading-tight ${
                                      item.done ? "text-[var(--color-ink)] opacity-75" : "text-[var(--color-ink)]"
                                    }`}
                                  >
                                    {item.title}
                                  </div>
                                  <div className="text-[10px] text-[var(--color-mute)] mt-0.5 truncate">
                                    {item.meta} · {item.time}
                                  </div>
                                </div>

                                {item.done ? (
                                  <AnimatedCheckCircle size={18} className="shrink-0 text-[var(--color-success)]" />
                                ) : (
                                  <span className="w-4.5 h-4.5 shrink-0 rounded-full border-2 border-[var(--color-hairline)]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Photo Evidence Capture */}
                      <div className="rounded-[22px] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 shadow-[var(--shadow-whisper)]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-bold text-[var(--color-ink)]">
                            Inspection Photos
                          </span>
                          <span className="text-[10px] text-[var(--color-mute)] font-mono">2 / 4 Uploaded</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="h-14 rounded-xl bg-[var(--color-hairline)] flex flex-col items-center justify-center text-[10px] font-medium text-[var(--color-body)] relative overflow-hidden border border-[var(--color-hairline)]">
                            <AnimatedCamera size={16} className="text-[var(--color-primary)] mb-0.5" />
                            <span>Spindle.jpg</span>
                          </div>
                          <div className="h-14 rounded-xl bg-[var(--color-hairline)] flex flex-col items-center justify-center text-[10px] font-medium text-[var(--color-body)] relative overflow-hidden border border-[var(--color-hairline)]">
                            <AnimatedWrench size={16} className="text-[var(--color-success)] mb-0.5" />
                            <span>Filter.jpg</span>
                          </div>
                          <button className="h-14 rounded-xl border-2 border-dashed border-[var(--color-hairline)] flex flex-col items-center justify-center text-[10px] font-semibold text-[var(--color-mute)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)] active:scale-95 transition-all">
                            <AnimatedPlus size={16} className="mb-0.5" />
                            <span>Add Photo</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* iOS Bottom Sticky Action Bar + Home Indicator */}
                    <div className="px-4 pt-2.5 pb-2 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/95 backdrop-blur-lg sticky bottom-0 z-20">
                      <button
                        onClick={() => {
                          setItems((prev) => prev.map((i) => ({ ...i, done: true })));
                        }}
                        className="w-full h-11 rounded-2xl bg-[var(--color-ink)] text-[var(--color-on-primary)] text-[13px] font-bold flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform"
                      >
                        <AnimatedCheckCircle size={16} />
                        {pct === 100 ? "Service Signed & Completed" : "Mark All Done & Complete"}
                      </button>

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <button className="h-8 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[11px] font-semibold text-[var(--color-body)] active:scale-95 transition-transform">
                          Save Draft
                        </button>
                        <button className="h-8 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[11px] font-semibold text-[var(--color-body)] active:scale-95 transition-transform flex items-center justify-center gap-1">
                          <AnimatedSend size={14} />
                          Share Report
                        </button>
                      </div>

                      {/* iPhone Home Indicator Gesture Bar */}
                      <div className="mx-auto mt-2 h-1 w-32 rounded-full bg-[var(--color-ink)]/30" />
                    </div>

                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </Section>
  );
}

