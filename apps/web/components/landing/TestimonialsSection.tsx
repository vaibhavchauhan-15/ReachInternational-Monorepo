"use client";

import { motion } from "framer-motion";
import { Section } from "./_shared/Section";
import { User } from "lucide-react";

// Role-based representative quotes — no fabricated company names.
const TESTIMONIALS = [
  {
    quote:
      "We went from chasing maintenance on spreadsheets to zero missed services in a quarter. The reminders alone paid for it.",
    name: "Service Manager",
    role: "Manufacturing plant, 300+ machines",
  },
  {
    quote:
      "Logging a job from my phone in the field — photos, parts, sign-off — takes two minutes now instead of paperwork at the end of the day.",
    name: "Field Engineer",
    role: "Regional service team",
  },
  {
    quote:
      "The audit trail and analytics gave our leadership the visibility they never had. We can prove SLA compliance on demand.",
    name: "Operations Director",
    role: "Multi-site industrial group",
  },
];

export function TestimonialsSection() {
  return (
    <Section
      id="testimonials"
      eyebrow="What teams say"
      title="Trusted by the people who keep machines running"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TESTIMONIALS.map((t, idx) => (
          <motion.figure
            key={t.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="card-base p-6 flex flex-col"
          >
            <blockquote className="body-lg text-[var(--color-ink)] flex-1 mb-6">
              “{t.quote}”
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center border border-[var(--color-hairline)] bg-[var(--surface-tint)] text-sky-600 dark:text-sky-400 shadow-[var(--shadow-whisper)] shrink-0"
                aria-label={`Avatar placeholder for ${t.name}`}
              >
                <User className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <span>
                <span className="block body-md font-medium text-[var(--color-ink)]">{t.name}</span>
                <span className="block body-sm text-[var(--color-mute)]">{t.role}</span>
              </span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </Section>
  );
}
