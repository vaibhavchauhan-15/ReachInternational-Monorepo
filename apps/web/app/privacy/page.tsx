import { Metadata } from "next";
import Link from "next/link";
import {
  Mail,
  CheckCircle2,
  Lock,
  ShieldCheck,
  UserX,
} from "lucide-react";
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_WEBSITE,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from "@/lib/brand";
import { getCurrentUserOrNull } from "@/lib/dal";
import { ScissorLiftLogoIcon } from "@/components/branding";

export const metadata: Metadata = {
  title: "Privacy Policy — REACH INTERNATIONAL",
  description:
    "Official Data Protection, Telemetry Privacy, and Statutory KYC Compliance Policy for Reach International heavy machinery fleet management and mobile field operations.",
  alternates: {
    canonical: `${BRAND_WEBSITE}/privacy`,
  },
  openGraph: {
    title: "Privacy Policy — REACH INTERNATIONAL",
    description:
      "Enterprise heavy equipment fleet operations, hour meter telemetry, and statutory KYC data protection policy.",
    type: "website",
    url: `${BRAND_WEBSITE}/privacy`,
    siteName: BRAND_NAME,
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy — REACH INTERNATIONAL",
    description:
      "Enterprise fleet telemetry, statutory KYC protection, and Google Play Data Safety policy.",
  },
};

export default async function PrivacyPolicyPage() {
  const user = await getCurrentUserOrNull();
  const isLoggedIn = Boolean(user && user.status === "active");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy Policy — REACH INTERNATIONAL",
    url: `${BRAND_WEBSITE}/privacy`,
    description:
      "Official Data Protection and Privacy Policy for Reach International heavy equipment fleet management, telemetry, and field operations.",
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

      {/* Main Container — Strictly Adhering to 720–800px Max Width */}
      <main className="max-w-[760px] mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 text-left flex-1 space-y-6 sm:space-y-8">
        {/* Document Hero & Header */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[var(--color-ink)] leading-tight text-left mb-2">
              Data Protection & Privacy Policy
            </h1>
            <p className="text-[14px] text-[var(--color-mute)] leading-[1.6] text-left">
              Last Updated: September 11, 2026 • Effective Date: September 11, 2026
            </p>
          </div>
          <div className="h-px bg-[var(--color-hairline)] my-2" />
          <p className="text-[15px] sm:text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
            At <strong>{BRAND_NAME}</strong>, we are committed to upholding the highest standards of data confidentiality, privacy, and integrity for heavy industrial machinery fleet management, field service engineers, machine operators, and corporate clients. This Privacy Policy governs all data collected via the ReachInternational mobile application, field telemetry services, and enterprise cloud platform.
          </p>
        </section>

        {/* 13 Structured Comprehensive Sections */}
        <div className="space-y-6 sm:space-y-8">
          {/* ========================================================================= */}
          {/* SECTION 1 */}
          {/* ========================================================================= */}
          <section id="section-1" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              1. Scope, Applicability & Statutory Legal Framework
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              This Data Protection and Privacy Policy applies to all digital services, software products, mobile applications, and IoT equipment telemetry integrations provided by <strong>{BRAND_NAME}</strong> across web and mobile ecosystems:
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2.5 sm:space-y-3 text-[16px] text-[var(--color-body)] leading-[1.65]">
              <li>
                <strong>Enterprise Cloud Platform:</strong> The centralized cloud application accessible at <code className="text-sm font-mono">{BRAND_WEBSITE_DISPLAY}</code> and associated APIs powering machine dispatch, maintenance tracking, and fleet analytics.
              </li>
              <li>
                <strong>Mobile Field Application:</strong> The hybrid and native mobile application (<code className="text-sm font-mono">com.reachinternational.app</code>) distributed on Google Play Store, Apple App Store, and internal enterprise distribution channels.
              </li>
              <li>
                <strong>Heavy Machinery Categories:</strong> Operational monitoring and operator safety telemetry for Scissor Lifts, Articulated Boom Lifts, Telescopic Boom Lifts, Rough-Terrain Forklifts, Mobile Cranes, and Material Handling Equipment (MHE).
              </li>
              <li>
                <strong>Covered Stakeholder Roles:</strong> Super Administrators, Service Managers, Field Operations Engineers, Heavy Machinery Operators, Base Yard Supervisors, and Corporate Client representatives.
              </li>
            </ul>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal mt-4">
              This policy is drafted and enforced in strict compliance with the <strong>Digital Personal Data Protection Act, 2023 (DPDPA)</strong>, Section 43A of the <strong>Information Technology Act, 2000</strong> (and the SPDI Rules, 2011), Google Play Developer Content Policies (Data Safety & Account Deletion Standards), and UIDAI statutory directives regarding identity masking.
            </p>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 2 */}
          {/* ========================================================================= */}
          <section id="section-2" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              2. Categories of Information We Collect
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              To coordinate machine custody, prevent workplace fatigue incidents, maintain equipment reliability, and verify statutory compliance, we collect the following categories of data:
            </p>

            <div className="space-y-6 pt-2">
              <div>
                <h3 className="text-[18px] font-semibold text-[var(--color-ink)] mb-2">
                  2.1 Personal Identity & Profile Credentials
                </h3>
                <ul className="list-disc list-outside ml-6 space-y-2 text-[16px] text-[var(--color-body)] leading-[1.65]">
                  <li>Full legal name, official business email address, verified mobile telephone number, and residential street address.</li>
                  <li>Assigned system role (Super Admin, Service Manager, Engineer, Operator, Client), designated company name, and assigned machinery base yard or operational depot.</li>
                  <li>Cryptographic one-way salted password hashes managed securely through Supabase Auth (plaintext passwords are never stored or accessible).</li>
                </ul>
              </div>

              <div>
                <h3 className="text-[18px] font-semibold text-[var(--color-ink)] mb-2">
                  2.2 Statutory Operator Licences & Masked KYC
                </h3>
                <ul className="list-disc list-outside ml-6 space-y-2 text-[16px] text-[var(--color-body)] leading-[1.65]">
                  <li>Heavy Machinery Operating Licences, Commercial Driving Licences (HMV/HTV), and Mobile Elevating Work Platform (MEWP) competence certificates required for legal machine clearance.</li>
                  <li>Aadhaar numbers recorded strictly with statutory 8-digit masking (<code className="text-sm font-mono">XXXX-XXXX-1234</code>) in full compliance with UIDAI regulations. Reach International never collects or stores raw biometrics.</li>
                  <li>Licence validity dates, issuing regional transport offices (RTO), and supervisor clearance verification timestamps.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-[18px] font-semibold text-[var(--color-ink)] mb-2">
                  2.3 Machinery & Hour Meter Telemetry (HMR)
                </h3>
                <ul className="list-disc list-outside ml-6 space-y-2 text-[16px] text-[var(--color-body)] leading-[1.65]">
                  <li>Initial shift opening and closing Hour Meter Readings (HMR) to compute net engine running hours and calculate wear rates.</li>
                  <li>Equipment mechanical operational status: operating hours, breakdown tickets, hydraulic oil checklists, and structural defect alerts.</li>
                  <li>Pre-shift mechanical checklists verifying emergency descent valves, platform controls, and safety harness anchor points.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-[18px] font-semibold text-[var(--color-ink)] mb-2">
                  2.4 Shift Timestamps & Custody Transfers
                </h3>
                <ul className="list-disc list-outside ml-6 space-y-2 text-[16px] text-[var(--color-body)] leading-[1.65]">
                  <li>Duty check-in, check-out, break intervals, and supervisor-approved overtime durations.</li>
                  <li>Digital machine custody handover records transferred between shift operators.</li>
                  <li>Automated shift concurrency data evaluating potential operator fatigue or double-booking conflicts.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-[18px] font-semibold text-[var(--color-ink)] mb-2">
                  2.5 Device Diagnostics & Push Notification Tokens
                </h3>
                <ul className="list-disc list-outside ml-6 space-y-2 text-[16px] text-[var(--color-body)] leading-[1.65]">
                  <li>Operating system version, device model, Expo SDK runtime version, browser user-agent, and IP address.</li>
                  <li>Network connectivity state (online, cellular, wifi, offline) used to manage offline data caching queues.</li>
                  <li>Firebase Cloud Messaging (FCM) and Apple Push Notification Service (APNS) device tokens used strictly for operational alerts.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-[18px] font-semibold text-[var(--color-ink)] mb-2">
                  2.6 Field Media & Inspection Documentation
                </h3>
                <ul className="list-disc list-outside ml-6 space-y-2 text-[16px] text-[var(--color-body)] leading-[1.65]">
                  <li>Worksite inspection photographs verifying machine structural condition before shift commencement.</li>
                  <li>Breakdown evidence photos capturing mechanical faults, hydraulic leaks, or electrical errors.</li>
                  <li>Signed digital delivery challans and equipment custody receipts executed on client worksites.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 3 */}
          {/* ========================================================================= */}
          <section id="section-3" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              3. Methods & Channels of Data Collection
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              Information collected by {BRAND_NAME} is gathered through direct, transparent, and operational interactions:
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2.5 sm:space-y-3 text-[16px] text-[var(--color-body)] leading-[1.65]">
              <li>
                <strong>Direct Input:</strong> Submitted intentionally by operators and engineers during onboarding, profile setup, daily meter log modal entry, and pre-shift checklist completion.
              </li>
              <li>
                <strong>Automated Engine Calculations:</strong> Operational metrics calculated automatically from opening/closing HMR deltas, shift timestamps, and automated shift overlap evaluation routines.
              </li>
              <li>
                <strong>Administrative Allocation:</strong> Project assignments, machine dispatches, and client yard locations configured by Service Managers or Fleet Administrators.
              </li>
              <li>
                <strong>Offline Queues & Background Sync:</strong> Data captured in remote or low-connectivity worksites is stored locally in encrypted storage (<code className="text-sm font-mono">AsyncStorage</code> / SQLite) and synchronized securely upon network reconnection.
              </li>
            </ul>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 4 */}
          {/* ========================================================================= */}
          <section id="section-4" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              4. Purposes & Legal Grounds of Data Processing
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              We process personal data and machinery telemetry strictly for legitimate industrial fleet management, workplace safety, and statutory compliance purposes:
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2.5 sm:space-y-3 text-[16px] text-[var(--color-body)] leading-[1.65]">
              <li>
                <strong>Equipment Custody & Operator Authorization:</strong> Verifying valid heavy equipment licences and qualifications prior to releasing custody of high-capacity aerial platforms.
              </li>
              <li>
                <strong>Shift Conflict & Fatigue Prevention:</strong> Monitoring daily shift allocations in real time to prevent operator exhaustion, double-booking, and dangerous shift overruns.
              </li>
              <li>
                <strong>Predictive Fleet Maintenance:</strong> Forecasting hydraulic fluid changes, load-cell calibrations, wire rope replacements, and engine servicing based on verified engine hours.
              </li>
              <li>
                <strong>Transparent Rental Billing:</strong> Supplying tamper-evident, verifiable operating hour logs for accurate equipment rental invoicing.
              </li>
              <li>
                <strong>Statutory Safety Audits & Investigations:</strong> Maintaining auditable historical records for industrial safety authorities, Directorate General of Factory Advice Service (DGFASLI), OSHA, and insurance compliance.
              </li>
              <li>
                <strong>Platform Integrity & Anti-Falsification:</strong> Detecting anomalous meter adjustments, preventing fraudulent hour alterations, and maintaining immutable audit records.
              </li>
            </ul>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 5 */}
          {/* ========================================================================= */}
          <section id="section-5" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              5. Data Security, Cryptographic Controls & Architecture
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              {BRAND_NAME} implements multi-layered enterprise cybersecurity controls to safeguard all platform records:
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2.5 sm:space-y-3 text-[16px] text-[var(--color-body)] leading-[1.65]">
              <li>
                <strong>PostgreSQL Row-Level Security (RLS):</strong> Data queries are partitioned at the database kernel level according to user role and tenant scoping. Operators only access their own shifts and assigned equipment.
              </li>
              <li>
                <strong>Role-Based Access Control (RBAC):</strong> System roles (<code className="text-sm font-mono">admin</code>, <code className="text-sm font-mono">service_manager</code>, <code className="text-sm font-mono">engineer</code>, <code className="text-sm font-mono">operator</code>, <code className="text-sm font-mono">client</code>) possess strictly compartmentalized permissions. Sensitive personal KYC data is shielded from unauthorized peers.
              </li>
              <li>
                <strong>Encryption in Transit & at Rest:</strong> All network communication uses TLS 1.3 encryption with enforced HTTPS. Stored records, backup snapshots, and cloud document buckets utilize AES-256 encryption.
              </li>
              <li>
                <strong>Salted Passwords & Secret Isolation:</strong> User passwords utilize one-way salted cryptographic hashing managed by Supabase Auth; secrets are never stored in client bundles.
              </li>
              <li>
                <strong>Tamper-Evident Immutable Audit Trails:</strong> Modifications to machine hour readings, operator assignments, and account statuses produce immutable structured audit trails (<code className="text-sm font-mono">logAudit</code>) containing actor ID, timestamp, and IP address.
              </li>
            </ul>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 6 */}
          {/* ========================================================================= */}
          <section id="section-6" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              6. Third-Party Sub-processors & Zero Data Sale Guarantee
            </h2>
            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2 mb-4">
              <span className="text-[14px] font-bold uppercase tracking-wider text-emerald-600 block">
                Strict Zero Data Sale Guarantee
              </span>
              <p className="text-[16px] text-[var(--color-body)] leading-[1.65]">
                {BRAND_NAME} operates strictly as an industrial technology and equipment service provider. We <strong>do not sell, rent, monetize, or trade</strong> your personal identity, contact details, KYC credentials, or equipment telemetry with third-party advertisers or data brokers under any circumstances.
              </p>
            </div>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              We contract exclusively with vetted, enterprise-grade cloud sub-processors operating under strict contractual data protection agreements:
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2.5 sm:space-y-3 text-[16px] text-[var(--color-body)] leading-[1.65]">
              <li>
                <strong>Supabase, Inc.:</strong> Provides SOC 2 Type II certified managed PostgreSQL database, authentication, and encrypted document storage.
              </li>
              <li>
                <strong>Expo / 650 Industries:</strong> Powers mobile application compilation, Over-The-Air runtime updates, and secure push notification gateway services.
              </li>
              <li>
                <strong>Vercel, Inc.:</strong> Delivers our web application and API infrastructure with global edge DDoS protection and SSL/TLS termination.
              </li>
            </ul>
            <p className="text-[14px] text-[var(--color-mute)] leading-[1.6] text-left mt-3">
              Statutory Disclosures: We may disclose personal data solely when legally compelled to do so by a valid judicial court order or an authorized governmental safety investigation regarding a worksite incident.
            </p>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 7 */}
          {/* ========================================================================= */}
          <section id="section-7" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              7. Data Retention & Archival Policies
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              Data retention periods are established based on operational necessity, heavy machinery warranty obligations, and statutory limitation acts:
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2.5 sm:space-y-3 text-[16px] text-[var(--color-body)] leading-[1.65]">
              <li>
                <strong>Active Account Records:</strong> Personal contact details, designated roles, and yard assignments are maintained for the duration of the operator’s active contract or employment.
              </li>
              <li>
                <strong>Statutory Heavy Equipment Safety Logs (Minimum 7 Years):</strong> In compliance with the Indian Factories Act and OSHA equipment lifecycle standards, machinery inspection records, Hour Meter logs, and signed delivery challans are retained for a minimum of seven (7) years to facilitate regulatory safety audits and insurance verification.
              </li>
              <li>
                <strong>Audit Trails & Mutation History:</strong> Cryptographic audit trails and system mutation logs are preserved in secure long-term archival storage.
              </li>
            </ul>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 8 */}
          {/* ========================================================================= */}
          <section id="section-8" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              8. User Rights & Google Play Account Deletion Policy
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              In full compliance with Google Play Developer Content Policies and the Digital Personal Data Protection Act, users hold comprehensive rights regarding their personal data:
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2.5 sm:space-y-3 text-[16px] text-[var(--color-body)] leading-[1.65]">
              <li>
                <strong>Right of Access & Portability:</strong> Users can request an export of their personal profile and historical shift records in CSV or PDF formats.
              </li>
              <li>
                <strong>Right of Rectification:</strong> Operators can update inaccurate contact numbers or submit licence renewal details via the in-app Edit Profile workflow.
              </li>
              <li>
                <strong>Right of Permanent Erasure:</strong> Complete account deletion and purging of personal identity records.
              </li>
            </ul>

            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3 mt-4">
              <span className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-ink)] block">
                How to Request Account Deletion (3 Available Channels)
              </span>
              <ol className="list-decimal list-outside ml-6 space-y-2 text-[16px] text-[var(--color-body)] leading-[1.65]">
                <li>
                  <strong>In-App Self-Service:</strong> Open the ReachInternational Mobile App → Navigate to <em>Settings</em> → <em>My Account</em> → Tap <strong>"Request Account Deletion"</strong>.
                </li>
                <li>
                  <strong>Dedicated Web Portal:</strong> Visit our public <Link href="/account-deletion" className="text-[#0070f3] dark:text-sky-400 font-semibold underline">Account Deletion Page</Link> to initiate a verified account erasure request without needing the app installed.
                </li>
                <li>
                  <strong>Direct Email:</strong> Send an email from your registered address to <a href={`mailto:${BRAND_EMAIL}?subject=Account%20Deletion%20Request`} className="text-[#0070f3] dark:text-sky-400 font-semibold underline">{BRAND_EMAIL}</a> with the subject <em>"Account Deletion Request"</em>.
                </li>
              </ol>
              <p className="text-[14px] text-[var(--color-mute)] leading-[1.6] pt-1 border-t border-[var(--color-hairline)]">
                <strong>Execution SLA:</strong> Upon receipt of a verified request, all personal account credentials, contact numbers, push tokens, and submitted KYC documents are permanently expunged within <strong>14 business days</strong>. Statutory equipment safety logs are decoupled and retained anonymously as required by law.
              </p>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 9 */}
          {/* ========================================================================= */}
          <section id="section-9" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              9. Cookies & Local Session Storage Policy
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              Our web application utilizes strictly necessary cookies and browser storage keys solely to maintain authenticated sessions and UI theme preferences:
            </p>
            <ul className="list-disc list-outside ml-6 space-y-2.5 sm:space-y-3 text-[16px] text-[var(--color-body)] leading-[1.65]">
              <li>
                <strong>Authentication Session Cookies:</strong> <code className="text-sm font-mono">sb-access-token</code> and <code className="text-sm font-mono">sb-refresh-token</code> are essential for encrypted JWT session validation.
              </li>
              <li>
                <strong>Theme & Display Preferences:</strong> Stores user theme mode (<code className="text-sm font-mono">light</code>, <code className="text-sm font-mono">dark</code>, or <code className="text-sm font-mono">system</code>).
              </li>
              <li>
                <strong>Zero Behavioral Tracking:</strong> Reach International does not deploy third-party advertising cookies, retargeting scripts, Facebook Pixels, or cross-site marketing trackers.
              </li>
            </ul>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 10 */}
          {/* ========================================================================= */}
          <section id="section-10" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              10. Working Age & Operator Eligibility (Minors Policy)
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              Reach International serves commercial industrial fleets and heavy machinery operations. Operating heavy machinery (including boom lifts, scissor lifts, and cranes) is strictly restricted by law to verified individuals of legal working age (minimum <strong>18 years old</strong>) possessing valid operating clearances.
            </p>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              Our platform is not directed toward minors. We do not knowingly solicit or collect personal information from individuals under the age of 18. Any account found to belong to a minor will be terminated immediately.
            </p>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 11 */}
          {/* ========================================================================= */}
          <section id="section-11" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              11. Cross-Border Transfers & Storage Localization
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              All primary operational databases and confidential document storage buckets are maintained in high-security enterprise cloud data centers adhering to Indian data localization principles and international compliance standards (SOC 2, ISO 27001). Any cross-border infrastructure failover is conducted under strict Standard Contractual Clauses (SCCs) ensuring equivalent data protection.
            </p>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 12 */}
          {/* ========================================================================= */}
          <section id="section-12" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              12. Policy Modifications & Notification Framework
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              We review and update this Privacy Policy periodically to reflect technological enhancements or regulatory changes. In the event of material modifications affecting data handling practices or operator rights, we will provide advance notice at least <strong>15 days</strong> prior to enforcement through in-app notices, web dashboard alerts, and email communications.
            </p>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 13 */}
          {/* ========================================================================= */}
          <section id="section-13" className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4 text-left scroll-mt-6">
            <h2 className="text-[20px] sm:text-[22px] font-bold text-[var(--color-ink)] tracking-tight text-left">
              13. Grievance Redressal, Compliance Officer & Official Contact
            </h2>
            <p className="text-[16px] text-[var(--color-body)] leading-[1.65] text-left font-normal">
              In accordance with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000, Reach International has designated a Compliance Officer for grievance redressal:
            </p>

            <div className="p-5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-4 mt-4">
              <div className="space-y-1 text-left">
                <span className="text-[14px] font-bold text-[var(--color-ink)] uppercase tracking-wider block">
                  Reach International Compliance & Legal Desk
                </span>
                <p className="text-[16px] text-[var(--color-body)]">
                  Designation: Grievance Redressal & Data Protection Officer
                </p>
                <p className="text-[14px] text-[var(--color-mute)]">
                  Official Email:{" "}
                  <a
                    href={`mailto:${BRAND_EMAIL}?subject=Privacy%20Policy%20Inquiry`}
                    className="text-[#0070f3] dark:text-sky-400 font-semibold underline"
                  >
                    {BRAND_EMAIL}
                  </a>
                </p>
                <p className="text-[14px] text-[var(--color-mute)]">
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

              <div>
                <a
                  href={`mailto:${BRAND_EMAIL}?subject=Privacy%20Policy%20Inquiry`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0070f3] hover:bg-[#0060df] text-white !text-white transition-colors shadow-xs cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-white !text-white shrink-0" />
                  <span className="text-white !text-white font-semibold text-sm leading-none">
                    Contact Compliance Desk
                  </span>
                </a>
              </div>

              <div className="pt-3 border-t border-[var(--color-hairline)] text-[14px] text-[var(--color-mute)] leading-[1.6]">
                <strong>Statutory SLA:</strong> All privacy inquiries and grievances are formally acknowledged within <strong>48 hours</strong> and resolved in full within <strong>30 days</strong> as mandated by the DPDP Act, 2023.
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer — Polished, Clean & Minimalist */}
      <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-canvas)] py-10 px-4 sm:px-8 text-center text-xs text-[var(--color-mute)] print:hidden">
        <div className="max-w-[760px] mx-auto space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm font-medium">
            <Link href="/privacy" className="text-[var(--color-ink)] font-bold hover:underline">
              Privacy Policy
            </Link>
            <span className="text-[var(--color-hairline)]">•</span>
            <Link href="/terms" className="text-[var(--color-body)] hover:text-[var(--color-ink)] transition-colors">
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
