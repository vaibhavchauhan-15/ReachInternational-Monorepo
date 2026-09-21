import { Metadata } from "next";
import { cookies } from "next/headers";
import { CheckCircle2 } from "lucide-react";
import {
  BRAND_NAME,
  BRAND_WEBSITE,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from "@/lib/brand";
import { getCurrentUserOrNull } from "@/lib/dal";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Terms of Service — REACH INTERNATIONAL",
  description:
    "Official Terms of Service, Machinery Custody Conditions, and Operator Industrial Safety Rules for Reach International.",
  alternates: {
    canonical: `${BRAND_WEBSITE}/terms`,
  },
  openGraph: {
    title: "Terms of Service — REACH INTERNATIONAL",
    description:
      "Enterprise fleet usage conditions, machinery custody responsibilities, and industrial safety compliance.",
    type: "website",
    url: `${BRAND_WEBSITE}/terms`,
    siteName: BRAND_NAME,
  },
  twitter: {
    card: "summary",
    title: "Terms of Service — REACH INTERNATIONAL",
    description:
      "Enterprise fleet usage conditions, machinery custody responsibilities, and industrial safety compliance.",
  },
};

export default async function TermsOfServicePage() {
  const user = await getCurrentUserOrNull();
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("reachinternational_sidebar_collapsed")?.value;
  const defaultCollapsed = sidebarCookie === "true";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Service — REACH INTERNATIONAL",
    url: `${BRAND_WEBSITE}/terms`,
    description:
      "Official Terms of Service, Machinery Custody Conditions, and Operator Industrial Safety Rules for Reach International.",
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: BRAND_WEBSITE,
      logo: `${BRAND_WEBSITE}/light-favicon-96x96.png`,
    },
    datePublished: "2026-09-01",
    dateModified: "2026-09-21",
  };

  return (
    <LegalPageShell
      user={user}
      defaultCollapsed={defaultCollapsed}
      title="Terms of Service"
      lastUpdated="September 21, 2026"
    >
      {/* Schema.org JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Terms Hero Card */}
      <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-2.5 text-left">
          <div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--color-ink)] leading-tight text-left mb-1">
              Terms of Service
            </h2>
            <p className="text-xs text-[var(--color-mute)] leading-normal text-left">
              Last Updated: September 21, 2026 • Effective Date: September 21, 2026
            </p>
          </div>

          <div className="h-px bg-[var(--color-hairline)] my-1.5" />

          <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed text-left font-normal">
            These Terms of Service govern all utilization of the <strong>{BRAND_NAME}</strong> machinery management mobile software, fleet tracking systems, and digital custody logs. By accessing or operating through the platform, operators, service managers, field engineers, and client organizations agree to comply with these terms.
          </p>
        </section>

        {/* Section 1: Authorized Machinery Custody */}
        <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 text-left">
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight text-left">
            1. Authorized Machinery Custody & Operator Eligibility
          </h2>

          <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed text-left">
            {BRAND_NAME} fleet machinery (including scissor lifts, boom lifts, telehandlers, and cranes) may only be operated by verified, qualified personnel:
          </p>

          <div className="space-y-2 pt-1">
            <div className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-start gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed">
                <strong className="text-[var(--color-ink)] font-semibold">Statutory Certification: </strong>
                Operators must hold a valid Heavy Machinery / MEWP certification or valid Commercial Driver’s Licence, uploaded and verified by {BRAND_NAME} dispatchers.
              </div>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-start gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed">
                <strong className="text-[var(--color-ink)] font-semibold">Pre-Shift Mechanical Inspection: </strong>
                Prior to commencing operation, operators must execute the in-app digital inspection checklist covering hydraulic fluid levels, tire/track integrity, emergency descent mechanisms, and safety harness anchorages.
              </div>
            </div>

            <div className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-start gap-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed">
                <strong className="text-[var(--color-ink)] font-semibold">Custody Transfer Protocol: </strong>
                Equipment custody remains with the assigned operator until formal digital handover and closing HMR recording is confirmed via the app.
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Hour Meter Readings (HMR) & Duty Shifts */}
        <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 text-left">
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight text-left">
            2. Hour Meter Readings (HMR) & Duty Shifts
          </h2>

          <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2 text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed">
            <p>
              • <strong className="text-[var(--color-ink)] font-semibold">Accurate Meter Reporting:</strong> Operators must input genuine Hour Meter Readings (HMR) at the start and end of every shift. Intentional meter falsification, non-reporting, or bypassing is grounds for immediate termination of custody.
            </p>
            <p>
              • <strong className="text-[var(--color-ink)] font-semibold">Shift Overrun & Overtime Conflict Rules:</strong> The system automatically evaluates shift durations to prevent hazardous fatigue and billing concurrency conflicts. Overtime claims require supervisor validation and cannot collide with conflicting machine assignments.
            </p>
          </div>
        </section>

        {/* Section 3: Safety Standards & Prohibited Conduct */}
        <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 text-left">
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight text-left">
            3. Safety Standards & Prohibited Conduct
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs sm:text-[13px] text-[var(--color-body)]">
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] space-y-1">
              <span className="font-bold text-rose-700 dark:text-rose-400 block text-xs">Prohibited Substance Use</span>
              <p className="text-[var(--color-mute)] leading-relaxed text-xs">
                Operating machinery under the influence of alcohol, narcotics, or fatigue-inducing medication is strictly forbidden.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] space-y-1">
              <span className="font-bold text-rose-700 dark:text-rose-400 block text-xs">Exceeding Rated Capacity</span>
              <p className="text-[var(--color-mute)] leading-relaxed text-xs">
                Operators must never exceed maximum rated platform workload capacities (SWL) or modify factory safety interlocks.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] space-y-1">
              <span className="font-bold text-rose-700 dark:text-rose-400 block text-xs">Unverified Bystanders</span>
              <p className="text-[var(--color-mute)] leading-relaxed text-xs">
                Allowing unauthorized personnel inside operating machinery cabins or aerial work baskets is prohibited.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] space-y-1">
              <span className="font-bold text-rose-700 dark:text-rose-400 block text-xs">Immediate Incident Reporting</span>
              <p className="text-[var(--color-mute)] leading-relaxed text-xs">
                Any breakdown, structural impact, hydraulic leakage, or safety warning must be logged immediately via the app.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Maintenance & Servicing */}
        <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 text-left">
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight text-left">
            4. Servicing & Preventative Maintenance
          </h2>

          <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed text-left font-normal">
            All preventative maintenance intervals, hydraulic seal replacements, electrical inspections, and lubrication schedules are executed by authorized {BRAND_NAME} field engineers. Operators must never perform unauthorized mechanical modifications or disable telemetry monitoring devices.
          </p>
        </section>

        {/* Section 5: Contact & Legal Notices */}
        <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 text-left">
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight text-left">
            5. Contact & Legal Notices
          </h2>

          <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed text-left font-normal">
            For operational inquiries or official notices under these Terms of Service:
          </p>

          <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5 text-left">
            <span className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider block">
              {BRAND_NAME} Operations & Legal Desk
            </span>
            <p className="text-xs text-[var(--color-mute)]">
              Email:{" "}
              <a
                href={`mailto:${BRAND_EMAIL}?subject=Terms%20of%20Service%20Inquiry`}
                className="text-[#0070f3] dark:text-sky-400 font-semibold underline"
              >
                {BRAND_EMAIL}
              </a>
            </p>
            <p className="text-xs text-[var(--color-mute)]">
              Official Website:{" "}
              <a
                href={BRAND_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0070f3] dark:text-sky-400 font-semibold underline"
              >
                {BRAND_WEBSITE_DISPLAY}
              </a>
            </p>
          </div>
        </section>
    </LegalPageShell>
  );
}
