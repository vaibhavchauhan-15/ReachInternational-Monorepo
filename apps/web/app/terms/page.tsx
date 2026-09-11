import { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Mail,
} from "lucide-react";
import {
  BRAND_NAME,
  BRAND_WEBSITE,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from "@/lib/brand";
import { getCurrentUserOrNull } from "@/lib/dal";
import { ScissorLiftLogoIcon } from "@/components/branding";

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
  const isLoggedIn = Boolean(user && user.status === "active");

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
    dateModified: "2026-09-11",
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] flex flex-col justify-between font-sans selection:bg-[var(--color-ink)] selection:text-white">
      {/* Schema.org JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Header — Clean, Polished & Identical to Main Page Brand Language */}
      <header className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] px-4 sm:px-8 py-3.5 print:hidden">
        <div className="max-w-[760px] mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3 group select-none">
            <ScissorLiftLogoIcon size={32} className="text-[var(--color-ink)]" />
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black tracking-tight text-[var(--color-ink)] text-base sm:text-[17px] font-sans uppercase">
                  REACH
                </span>
                <span className="font-black tracking-tight text-[#0070f3] dark:text-sky-400 text-base sm:text-[17px] font-sans uppercase">
                  INTERNATIONAL
                </span>
              </div>
              <div className="flex flex-col mt-1 w-full">
                <div className="h-[1px] w-full bg-[var(--color-hairline)]" />
                <span className="font-bold tracking-[0.22em] text-[9px] sm:text-[9.5px] text-[var(--color-mute)] uppercase leading-none mt-1">
                  REACHING ALL HEIGHTS
                </span>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href={user?.role === "operator" ? "/operations?tab=entry" : "/machines"}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#0070f3] hover:bg-[#0060df] text-white !text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <span className="text-white !text-white font-semibold text-xs leading-none">
                  Go to Dashboard
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#0070f3] hover:bg-[#0060df] text-white !text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <span className="text-white !text-white font-semibold text-xs leading-none">
                  Sign In
                </span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Container — Strictly Adhering to 760px Max Width */}
      <main className="max-w-[760px] mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 text-left flex-1 space-y-6 sm:space-y-8">
        {/* Terms Hero Card */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[var(--color-ink)] leading-tight mb-2">
              Terms of Service
            </h1>
            <p className="text-[14px] text-[var(--color-mute)] leading-[1.6]">
              Last Updated: September 11, 2026 • Effective Date: September 11, 2026
            </p>
          </div>

          <div className="h-px bg-[var(--color-hairline)]" />

          <p className="text-[15px] sm:text-[16px] text-[var(--color-body)] leading-[1.65] font-normal">
            These Terms of Service govern all utilization of the <strong>{BRAND_NAME}</strong> machinery management mobile software, fleet tracking systems, and digital custody logs. By accessing or operating through the platform, operators, service managers, field engineers, and client organizations agree to comply with these terms.
          </p>
        </section>

        {/* Section 1: Authorized Machinery Custody */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight">
            1. Authorized Machinery Custody & Operator Eligibility
          </h2>

          <p className="text-[15px] sm:text-[16px] text-[var(--color-body)] leading-[1.65]">
            {BRAND_NAME} fleet machinery (including scissor lifts, boom lifts, telehandlers, and cranes) may only be operated by verified, qualified personnel:
          </p>

          <div className="space-y-3 pt-1">
            <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[14px] sm:text-[15px] text-[var(--color-body)] leading-[1.6]">
                <strong className="text-[var(--color-ink)] font-semibold">Statutory Certification: </strong>
                Operators must hold a valid Heavy Machinery / MEWP certification or valid Commercial Driver’s Licence, uploaded and verified by {BRAND_NAME} dispatchers.
              </div>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[14px] sm:text-[15px] text-[var(--color-body)] leading-[1.6]">
                <strong className="text-[var(--color-ink)] font-semibold">Pre-Shift Mechanical Inspection: </strong>
                Prior to commencing operation, operators must execute the in-app digital inspection checklist covering hydraulic fluid levels, tire/track integrity, emergency descent mechanisms, and safety harness anchorages.
              </div>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[14px] sm:text-[15px] text-[var(--color-body)] leading-[1.6]">
                <strong className="text-[var(--color-ink)] font-semibold">Custody Transfer Protocol: </strong>
                Equipment custody remains with the assigned operator until formal digital handover and closing HMR recording is confirmed via the app.
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Hour Meter Readings (HMR) & Duty Shifts */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight">
            2. Hour Meter Readings (HMR) & Duty Shifts
          </h2>

          <div className="p-4 sm:p-5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3 text-[14px] sm:text-[15px] text-[var(--color-body)] leading-[1.6]">
            <p>
              • <strong className="text-[var(--color-ink)] font-semibold">Accurate Meter Reporting:</strong> Operators must input genuine Hour Meter Readings (HMR) at the start and end of every shift. Intentional meter falsification, non-reporting, or bypassing is grounds for immediate termination of custody.
            </p>
            <p>
              • <strong className="text-[var(--color-ink)] font-semibold">Shift Overrun & Overtime Conflict Rules:</strong> The system automatically evaluates shift durations to prevent hazardous fatigue and billing concurrency conflicts. Overtime claims require supervisor validation and cannot collide with conflicting machine assignments.
            </p>
          </div>
        </section>

        {/* Section 3: Safety Standards & Prohibited Conduct */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight">
            3. Safety Standards & Prohibited Conduct
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-[13px] sm:text-[14px] text-[var(--color-body)]">
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5">
              <span className="font-bold text-rose-700 dark:text-rose-400 block">Prohibited Substance Use</span>
              <p className="text-[var(--color-mute)] leading-relaxed">
                Operating machinery under the influence of alcohol, narcotics, or fatigue-inducing medication is strictly forbidden.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5">
              <span className="font-bold text-rose-700 dark:text-rose-400 block">Exceeding Rated Capacity</span>
              <p className="text-[var(--color-mute)] leading-relaxed">
                Operators must never exceed maximum rated platform workload capacities (SWL) or modify factory safety interlocks.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5">
              <span className="font-bold text-rose-700 dark:text-rose-400 block">Unverified Bystanders</span>
              <p className="text-[var(--color-mute)] leading-relaxed">
                Allowing unauthorized personnel inside operating machinery cabins or aerial work baskets is prohibited.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5">
              <span className="font-bold text-rose-700 dark:text-rose-400 block">Immediate Incident Reporting</span>
              <p className="text-[var(--color-mute)] leading-relaxed">
                Any breakdown, structural impact, hydraulic leakage, or safety warning must be logged immediately via the app.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Maintenance & Servicing */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight">
            4. Servicing & Preventative Maintenance
          </h2>

          <p className="text-[15px] sm:text-[16px] text-[var(--color-body)] leading-[1.65]">
            All preventative maintenance intervals, hydraulic seal replacements, electrical inspections, and lubrication schedules are executed by authorized {BRAND_NAME} field engineers. Operators must never perform unauthorized mechanical modifications or disable telemetry monitoring devices.
          </p>
        </section>

        {/* Section 5: Contact & Legal Notices */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4">
          <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight">
            5. Contact & Legal Notices
          </h2>

          <p className="text-[15px] sm:text-[16px] text-[var(--color-body)] leading-[1.65]">
            For operational inquiries or official notices under these Terms of Service:
          </p>

          <div className="p-4 sm:p-5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-sm font-bold text-[var(--color-ink)] block">
                {BRAND_NAME} Operations & Legal Desk
              </span>
              <span className="text-xs text-[var(--color-mute)] block">
                Email: {BRAND_EMAIL} • Web: {BRAND_WEBSITE_DISPLAY}
              </span>
            </div>
            <a
              href={`mailto:${BRAND_EMAIL}?subject=Terms%20of%20Service%20Inquiry`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0070f3] hover:bg-[#0060df] text-white !text-white transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <Mail className="w-4 h-4 text-white !text-white shrink-0" />
              <span className="text-white !text-white font-semibold text-sm leading-none">
                Contact Operations
              </span>
            </a>
          </div>
        </section>
      </main>

      {/* Footer — Polished, Clean & Minimalist */}
      <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] py-10 px-4 sm:px-8 text-center text-xs text-[var(--color-mute)] print:hidden">
        <div className="max-w-[760px] mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm font-medium">
            <Link href="/privacy" className="text-[var(--color-body)] hover:text-[var(--color-ink)] transition-colors">
              Privacy Policy
            </Link>
            <span className="text-[var(--color-hairline)]">•</span>
            <Link href="/terms" className="text-[var(--color-ink)] font-bold hover:underline">
              Terms of Service
            </Link>
            <span className="text-[var(--color-hairline)]">•</span>
            <Link href="/account-deletion" className="text-[var(--color-body)] hover:text-[var(--color-ink)] transition-colors">
              Account Deletion
            </Link>
            <span className="text-[var(--color-hairline)]">•</span>
            <a href={`mailto:${BRAND_EMAIL}`} className="text-[var(--color-body)] hover:text-[var(--color-ink)] transition-colors">
              {BRAND_EMAIL}
            </a>
          </div>
          <p className="text-xs text-[var(--color-mute)]">
            © {new Date().getFullYear()} {BRAND_NAME} •{" "}
            <a href={BRAND_WEBSITE} className="hover:text-[var(--color-ink)] transition-colors">
              {BRAND_WEBSITE_DISPLAY}
            </a>
            . All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
