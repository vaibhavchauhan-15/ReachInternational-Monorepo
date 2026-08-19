"use client";

import { motion } from "framer-motion";
import {
  AnimatedClipboardList,
  AnimatedCalendarClock,
  AnimatedSend,
  AnimatedWrench,
  AnimatedFileCheck,
} from "@/components/ui/animated-icons";
import { Section } from "./_shared/Section";

const STEPS = [
  { icon: AnimatedClipboardList, title: "Register", desc: "Add machines and define service intervals." },
  { icon: AnimatedCalendarClock, title: "Schedule", desc: "Auto-generate maintenance calendars per asset." },
  { icon: AnimatedSend, title: "Dispatch", desc: "Assign engineers and fire multi-channel reminders." },
  { icon: AnimatedWrench, title: "Service", desc: "Log work, parts, and photos from the field." },
  { icon: AnimatedFileCheck, title: "Report", desc: "Close out with an auditable service record." },
];

export function WorkflowSection() {
  return (
    <Section
      id="workflow"
      eyebrow="How it works"
      title="From asset to audit trail in five steps"
      intro="A single flow keeps every machine on schedule and every service accounted for."
    >
      <div className="relative grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-4">
        {/* Connecting line (desktop) */}
        <div className="hidden md:block absolute top-6 left-[10%] right-[10%] h-px bg-[var(--color-hairline)]" />

        {STEPS.map((step, idx) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center"
          >
            <div className="relative z-10 w-12 h-12 rounded-full bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink)] mb-4">

              {(() => {
                const StepIcon = step.icon;
                return <StepIcon size={20} />;
              })()}
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[10px] font-mono flex items-center justify-center">
                {idx + 1}
              </span>
            </div>
            <h3 className="heading-md text-[var(--color-ink)] mb-1">{step.title}</h3>
            <p className="body-sm text-[var(--color-mute)] max-w-[14rem]">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
