"use client";

import { motion } from "framer-motion";
import {
  AnimatedCalendarClock,
  AnimatedBell,
  AnimatedUsers,
  AnimatedBarChart3,
  AnimatedShieldCheck,
  AnimatedSmartphone,
} from "@/components/ui/animated-icons";
import { Section } from "./_shared/Section";

const FEATURES = [
  {
    icon: AnimatedCalendarClock,
    title: "Preventive scheduling",
    desc: "Auto-generate service calendars from usage hours, dates, or custom intervals.",
  },
  {
    icon: AnimatedBell,
    title: "Multi-channel reminders",
    desc: "Email, SMS, and WhatsApp alerts fire before every deadline — no missed service.",
  },
  {
    icon: AnimatedUsers,
    title: "Engineer dispatch",
    desc: "Assign field engineers, track status, and route the nearest available technician.",
  },
  {
    icon: AnimatedBarChart3,
    title: "Predictive analytics",
    desc: "Spot at-risk machines before they fail with health scoring and trend data.",
  },
  {
    icon: AnimatedShieldCheck,
    title: "Audit-ready records",
    desc: "Every service, part, and sign-off logged with a tamper-evident history.",
  },
  {
    icon: AnimatedSmartphone,
    title: "Field-first mobile",
    desc: "Engineers log work, upload photos, and close jobs from any device.",
  },
];

export function FeatureShowcaseSection() {
  return (
    <Section
      id="features"
      eyebrow="Platform capabilities"
      title="Everything maintenance operations need"
      intro="Replace spreadsheets and reminders-in-your-head with one system of record."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FEATURES.map((f, idx) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (idx % 3) * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="card-base card-hover-system p-6"
            >
              <div className="w-11 h-11 rounded-[var(--radius-md)] bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink)] mb-5">
                <Icon size={20} />
              </div>
              <h3 className="heading-md text-[var(--color-ink)] mb-2">{f.title}</h3>
              <p className="body-md text-[var(--color-body)]">{f.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
