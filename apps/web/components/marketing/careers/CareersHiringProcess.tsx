"use client";

import { FileText, Phone, Wrench, CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    step: "01",
    icon: FileText,
    title: "Apply in 2 Minutes",
    description: "Submit your basic details and resume without creating an account or filling out tedious questionnaires.",
  },
  {
    step: "02",
    icon: Phone,
    title: "Initial HR Connect",
    description: "Our recruitment team reviews your profile within 48-72 hours for an introductory phone discussion.",
  },
  {
    step: "03",
    icon: Wrench,
    title: "Technical Assessment",
    description: "Demonstrate equipment maintenance skills or operational competence at one of our regional yards.",
  },
  {
    step: "04",
    icon: CheckCircle2,
    title: "Offer & Onboarding",
    description: "Receive a competitive compensation offer with full PF/ESIC benefits, safety kit, and swift site placement.",
  },
];

export function CareersHiringProcess() {
  return (
    <section className="py-16 md:py-24 border-b border-black/[0.06] dark:border-white/[0.08]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#008CFC]">
            Simple & Transparent
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Our 4-Step Hiring Process
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We value your time. We keep our application direct, our screening fast, and our feedback clear.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] relative space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="size-10 rounded-xl bg-sky-500/10 text-[#008CFC] flex items-center justify-center font-bold">
                    <Icon className="size-5" />
                  </div>
                  <span className="text-2xl font-black font-mono text-muted/50 dark:text-muted/30">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
