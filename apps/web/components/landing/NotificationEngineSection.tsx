"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedMail,
  AnimatedMessageSquare,
  AnimatedPhone,
  AnimatedBell,
} from "@/components/ui/animated-icons";
import { Section } from "./_shared/Section";

const CHANNELS = [
  {
    id: "email",
    label: "Email",
    icon: AnimatedMail,
    from: "alerts@reachinternational.com",
    title: "Service due: Haas VF-2 CNC",
    body: "Machine MC-9041 is due for preventive maintenance in 48 hours. Assigned engineer: Sarah Jenkins.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: AnimatedMessageSquare,
    from: "REACH INTERNATIONAL Bot",
    title: "⚠️ Overdue reminder",
    body: "MC-8812 laser sintering unit is overdue by 2 days. Tap to reschedule or reassign.",
  },
  {
    id: "sms",
    label: "SMS",
    icon: AnimatedPhone,
    from: "+1 (555) 010-2288",
    title: "REACH INTERNATIONAL",
    body: "Reminder: Generator #14 service window opens tomorrow 09:00. Reply STOP to opt out.",
  },
];

export function NotificationEngineSection() {
  const [active, setActive] = useState(CHANNELS[0].id);
  const current = CHANNELS.find((c) => c.id === active) ?? CHANNELS[0];

  return (
    <Section
      id="reminders"
      eyebrow="Reminder automation"
      title="The right alert, on the right channel"
      intro="Escalating reminders reach engineers and clients wherever they already are."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* Channel selector */}
        <div className="space-y-3">
          {CHANNELS.map((c) => {
            const on = c.id === active;
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => setActive(c.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-[var(--radius-md)] border text-left transition-colors ${
                  on
                    ? "border-[var(--color-ink)] bg-[var(--color-canvas-elevated)]"
                    : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:border-[var(--color-mute)]"
                }`}
                aria-pressed={on}
              >
                <div className="w-10 h-10 rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft-surface)] flex items-center justify-center text-[var(--color-ink)]">
                  <Icon size={20} />
                </div>
                <div>
                  <div className="body-md font-medium text-[var(--color-ink)]">{c.label}</div>
                  <div className="body-sm text-[var(--color-mute)]">Delivered in seconds</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Preview */}
        <div className="card-elevated p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-2 pb-4 mb-4 border-b border-[var(--color-hairline)]">
                <AnimatedBell size={16} className="text-[var(--color-mute)]" />
                <span className="body-sm font-mono text-[var(--color-mute)]">{current.from}</span>
              </div>
              <h4 className="heading-md text-[var(--color-ink)] mb-2">{current.title}</h4>
              <p className="body-md text-[var(--color-body)]">{current.body}</p>
              <div className="mt-6 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
                <span className="body-sm text-[var(--color-mute)]">Delivered · logged for audit</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}
