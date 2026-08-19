"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedPlus } from "@/components/ui/animated-icons";
import { Section } from "./_shared/Section";

const FAQS = [
  {
    q: "How is this better than spreadsheets?",
    a: "Spreadsheets don't remind you. REACH INTERNATIONAL generates schedules automatically, fires multi-channel alerts before every deadline, and keeps an auditable record no cell can accidentally overwrite.",
  },
  {
    q: "What equipment types are supported?",
    a: "Any serviceable asset — construction, mining, industrial, manufacturing, and agriculture. You define the machine, its intervals, and the service checklist.",
  },
  {
    q: "How do reminders reach my team?",
    a: "Email, SMS, and WhatsApp. Reminders escalate as deadlines approach and every send is logged for compliance.",
  },
  {
    q: "Can field engineers use it offline?",
    a: "Yes. Engineers log work, capture photos, and complete jobs from mobile; data syncs when connectivity returns.",
  },
  {
    q: "Is my data secure?",
    a: "Row-level security, role-based access, TLS 1.3 in transit, and AES-256 at rest, with an immutable audit trail across the platform.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" eyebrow="FAQ" title="Questions, answered" align="center">
      <div className="max-w-3xl mx-auto divide-y divide-[var(--color-hairline)] border-y border-[var(--color-hairline)]">
        {FAQS.map((item, idx) => {
          const isOpen = open === idx;
          return (
            <div key={item.q}>
              <button
                onClick={() => setOpen(isOpen ? null : idx)}
                className="w-full flex items-center justify-between gap-4 py-5 text-left focus-ring"
                aria-expanded={isOpen}
              >
                <span className="heading-md text-[var(--color-ink)]">{item.q}</span>
                <AnimatedPlus
                  size={20}
                  className={`shrink-0 text-[var(--color-mute)] transition-transform duration-200 ${
                    isOpen ? "rotate-45" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="body-md text-[var(--color-body)] pb-5 pr-9">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
