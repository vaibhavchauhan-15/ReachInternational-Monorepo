"use client";

import { motion } from "framer-motion";
import {
  AnimatedLock,
  AnimatedKeyRound,
  AnimatedFileText,
  AnimatedDatabase,
} from "@/components/ui/animated-icons";
import { Section } from "./_shared/Section";

const FEATURES = [
  { title: "Row-level security", desc: "Tenant-isolated data policies enforced in Postgres.", icon: AnimatedDatabase },
  { title: "Immutable audit trail", desc: "Every edit and sign-off logged with verifiable timestamps.", icon: AnimatedFileText },
  { title: "Role-based access", desc: "Granular roles for admins, engineers, and clients.", icon: AnimatedKeyRound },
  { title: "Encrypted end to end", desc: "TLS 1.3 in transit, AES-256 at rest.", icon: AnimatedLock },
];

export function EnterpriseSecuritySection() {
  return (
    <Section
      id="security"
      eyebrow="Enterprise governance"
      title="Security and compliance at the core"
      intro="Built for zero-trust data privacy and strict regulatory auditing."
      className="bg-[var(--color-canvas-elevated)] border-y border-[var(--color-hairline)]"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((sec, idx) => {
          const Icon = sec.icon;
          return (
            <motion.div
              key={sec.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="card-base card-hover-system p-6"
            >
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-[var(--color-ink)] flex items-center justify-center mb-4">
                <Icon size={20} />
              </div>
              <h3 className="heading-md text-[var(--color-ink)] mb-2">{sec.title}</h3>
              <p className="body-md text-[var(--color-body)]">{sec.desc}</p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
