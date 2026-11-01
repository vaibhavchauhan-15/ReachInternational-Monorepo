"use client";

import { ShieldCheck, HardHat, TrendingUp, Award,  Truck } from "lucide-react";

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Zero-Compromise Safety",
    description:
      "All technicians and operators are equipped with top-tier PPE, regular toolbox safety talks, and strict adherence to international safety protocols.",
  },
  {
    icon: HardHat,
    title: "Nationwide Landmark Projects",
    description:
      "Deploy our modern fleet across high-speed rail, metro corridors, greenfield airports, mega warehousing hubs, and industrial plants.",
  },
  {
    icon: TrendingUp,
    title: "OEM Training & Growth",
    description:
      "Gain hands-on certified training on leading global machinery brands (JLG, Genie, Haulotte, JCB, Hyundai) with clear advancement ladders.",
  },
  {
    icon: Award,
    title: "Timely Pay & Stability",
    description:
      "Guaranteed punctual payroll, transparent overtime accounting, comprehensive medical protection, and statutory PF/ESIC compliance.",
  },
];

export function CareersWhyJoin() {
  return (
    <section className="py-16 md:py-24 bg-muted/20 border-b border-black/[0.06] dark:border-white/[0.08]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#008CFC]">
            Why Join Reach International
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Work with India&apos;s Heavy Access Leaders
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We empower our field technicians, certified operators, engineers, and corporate teams with the best tools, safety culture, and respect they deserve.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PILLARS.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white dark:bg-[#171717] border border-black/[0.06] dark:border-white/[0.08] shadow-xs hover:shadow-md hover:border-[#008CFC]/40 transition-all duration-200 space-y-3 group"
              >
                <div className="size-11 rounded-xl bg-sky-500/10 text-[#008CFC] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-base font-bold text-foreground">{p.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
