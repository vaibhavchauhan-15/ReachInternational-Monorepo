"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedSettings,
  AnimatedBuilding,
  AnimatedPackage,
  AnimatedRotateCw,
  AnimatedCpu,
  AnimatedSparkles,
  AnimatedWrench,
  AnimatedClipboardList,
} from "@/components/ui/animated-icons";
import { Section } from "./_shared/Section";
import {
  ExcavatorIcon,
  BulldozerIcon,
  LoaderIcon,
  CraneIcon,
  ForkliftIcon,
  DumpTruckIcon,
} from "./_shared/MachineIcon";

type IconComp = React.ComponentType<{ className?: string; size?: number }>;

type Machine = { name: string; Icon: IconComp };

const CATEGORIES: { id: string; label: string; machines: Machine[] }[] = [
  {
    id: "construction",
    label: "Construction",
    machines: [
      { name: "Excavator", Icon: ExcavatorIcon },
      { name: "Bulldozer", Icon: BulldozerIcon },
      { name: "Wheel Loader", Icon: LoaderIcon },
      { name: "Crane", Icon: CraneIcon },
      { name: "Forklift", Icon: ForkliftIcon },
      { name: "Dump Truck", Icon: DumpTruckIcon },
    ],
  },
  {
    id: "mining",
    label: "Mining",
    machines: [
      { name: "Crusher", Icon: AnimatedClipboardList },
      { name: "Drilling Rig", Icon: AnimatedWrench },
      { name: "Screening Plant", Icon: AnimatedPackage },
    ],
  },
  {
    id: "industrial",
    label: "Industrial",
    machines: [
      { name: "Generator", Icon: AnimatedSparkles },
      { name: "Air Compressor", Icon: AnimatedRotateCw },
      { name: "Boiler", Icon: AnimatedSparkles },
      { name: "CNC Machine", Icon: AnimatedCpu },
      { name: "Conveyor", Icon: AnimatedSettings },
    ],
  },
  {
    id: "manufacturing",
    label: "Manufacturing",
    machines: [
      { name: "Injection Molding", Icon: AnimatedBuilding },
      { name: "Hydraulic Press", Icon: AnimatedClipboardList },
      { name: "Packaging Machine", Icon: AnimatedPackage },
    ],
  },
  {
    id: "agriculture",
    label: "Agriculture",
    machines: [
      { name: "Tractor", Icon: LoaderIcon },
      { name: "Harvester", Icon: AnimatedWrench },
      { name: "Rotavator", Icon: AnimatedRotateCw },
    ],
  },
];

export function EquipmentGallery() {
  const [active, setActive] = useState(CATEGORIES[0].id);
  const current = CATEGORIES.find((c) => c.id === active) ?? CATEGORIES[0];

  return (
    <Section
      id="equipment"
      eyebrow="Supported equipment"
      title="One platform for every machine on the floor"
      intro="From excavators to CNC cells, track service across your entire fleet."
    >
      {/* Category tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
        {CATEGORIES.map((cat) => {
          const on = cat.id === active;
          return (
            <button
              key={cat.id}
              onClick={() => setActive(cat.id)}
              className={`h-9 px-4 rounded-[var(--radius-pill-category)] text-button-md font-medium transition-colors ${
                on
                  ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                  : "bg-[var(--color-canvas-elevated)] text-[var(--color-body)] border border-[var(--color-hairline)] hover:border-[var(--color-mute)]"
              }`}
              aria-pressed={on}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Machine grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {current.machines.map((m) => {
            const Icon = m.Icon;
            return (
              <div
                key={m.name}
                className="card-base card-hover-system group flex flex-col items-center justify-center gap-3 p-5 text-center transition-all duration-300 hover:border-indigo-500/40 hover:shadow-md"
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-hairline-soft)] dark:bg-slate-800/80 border border-[var(--color-hairline)] flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:text-blue-600 dark:group-hover:text-cyan-400 group-hover:bg-indigo-50 dark:group-hover:bg-slate-800 transition-all duration-300 group-hover:scale-110 shadow-sm shrink-0">
                  <Icon size={34} />
                </div>
                <span className="body-sm font-semibold text-[var(--color-ink)] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {m.name}
                </span>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </Section>
  );
}
