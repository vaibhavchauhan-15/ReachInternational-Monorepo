import { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Smartphone,
  Laptop,
  Mail,
} from "lucide-react";
import {
  BRAND_NAME,
  BRAND_WEBSITE,
  BRAND_EMAIL,
} from "@/lib/brand";
import { getCurrentUserOrNull } from "@/lib/dal";
import { LegalPageShell } from "@/components/legal/LegalPageShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Deletion Guide & Warnings — REACH INTERNATIONAL",
  description:
    "Official Account and Personal Data Erasure Policy, Permanent Purge Details, Statutory Fleet Retention, and Step-by-Step Guide for Reach International.",
  alternates: {
    canonical: `${BRAND_WEBSITE}/account-deletion-guide`,
  },
  openGraph: {
    title: "Account Deletion Guide & Warnings — REACH INTERNATIONAL",
    description:
      "Step-by-step instructions, permanent data erasure policies, and non-restorable terms under Google Play Store and DPDPA compliance.",
    type: "website",
    url: `${BRAND_WEBSITE}/account-deletion-guide`,
    siteName: BRAND_NAME,
  },
  twitter: {
    card: "summary",
    title: "Account Deletion Guide & Warnings — REACH INTERNATIONAL",
    description:
      "Official account deletion guide, permanent data purge rules, and statutory compliance policy.",
  },
};

export default async function AccountDeletionGuidePage() {
  const user = await getCurrentUserOrNull();
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("reachinternational_sidebar_collapsed")?.value;
  const defaultCollapsed = sidebarCookie === "true";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Account Deletion Guide & Warnings — REACH INTERNATIONAL",
    url: `${BRAND_WEBSITE}/account-deletion-guide`,
    description:
      "Official step-by-step account deletion guide, permanent purge terms, and data retention policy for Reach International.",
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
      title="Account Deletion Guide"
      lastUpdated="September 21, 2026"
    >
      {/* Schema.org JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Document Hero Card */}
      <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-2.5 text-left">
        <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-mute)] uppercase tracking-wider">
          <ShieldCheck size={14} className="text-[#0070f3]" />
          <span>Compliance &amp; Data Safety Policy</span>
        </div>

        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--color-ink)] leading-tight text-left">
          Account Deletion &amp; Data Erasure Guide
        </h1>

        <p className="text-xs text-[var(--color-mute)] leading-normal text-left">
          Last Updated: September 21, 2026 • Policy Version: v2026.09
        </p>

        <div className="h-px bg-[var(--color-hairline)] my-1.5" />

        <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed text-left font-normal">
          In full compliance with <strong>Google Play Developer Content Policies</strong> (Data Safety &amp; Deletion Standards) and the <strong>Digital Personal Data Protection Act, 2023 (DPDPA)</strong>, users of the <strong>{BRAND_NAME}</strong> mobile application (<code className="text-[11px] font-mono bg-[var(--color-canvas)] px-1 py-0.5 rounded border border-[var(--color-hairline)]">com.reachinternational.app</code>) and cloud platform hold the unequivocal right to permanently delete their account and purge all associated personal identity records.
        </p>

        {/* Action Callout linking to the separate Delete Account Page */}
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-[var(--color-body)]">
              Ready to submit an official account deletion request?
            </span>
          </div>
          <Link
            href="/delete-account"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            <span>Go to Delete Account Page</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      {/* Structured Sections */}
      <div className="space-y-4 sm:space-y-6">
        {/* ========================================================================= */}
        {/* SECTION 1: PERMANENT DATA DELETION */}
        {/* ========================================================================= */}
        <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 text-left scroll-mt-14">
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight text-left">
            1. What Data is Permanently Deleted?
          </h2>
          <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed text-left font-normal">
            When an account deletion request is approved and executed by system administrators, all personal identification records are permanently expunged from primary databases, cloud storage buckets, and identity directories:
          </p>

          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 size={14} />
              <span>Personal Records Permanently Purged</span>
            </div>
            <ul className="list-disc list-outside ml-4 sm:ml-5 space-y-1 text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed">
              <li>
                <strong>Authentication Credentials:</strong> Password hashes, Supabase JWT refresh tokens, active sessions, and multi-device auth credentials are permanently terminated.
              </li>
              <li>
                <strong>Personal Identity:</strong> Full legal name, official business email address, residential address, personal mobile phone number, and avatar photos.
              </li>
              <li>
                <strong>Statutory KYC Records:</strong> Masked Aadhaar numbers (<code className="text-[11px] font-mono">XXXX-XXXX-1234</code>) and Commercial / MEWP Driving Licence scans and verification metadata.
              </li>
              <li>
                <strong>Device Telemetry &amp; Push Tokens:</strong> Firebase Cloud Messaging (FCM) tokens, APNS identifiers, mobile device UUIDs, and local offline cache records.
              </li>
            </ul>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: IRREVERSIBILITY NOTICE */}
        {/* ========================================================================= */}
        <section className="p-4 sm:p-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] shadow-xs space-y-3 text-left scroll-mt-14">
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-rose-700 dark:text-rose-400">
            <AlertTriangle size={16} />
            <span>2. Permanent &amp; Irreversible — Data Cannot Be Restored</span>
          </div>

          <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed text-left font-normal">
            Account deletion is an <strong>absolute and irreversible action</strong>. Once executed:
          </p>

          <ul className="list-disc list-outside ml-4 sm:ml-5 space-y-1.5 text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed">
            <li>
              <strong>No Account Recovery:</strong> Your account cannot be restored, recovered, or un-archived. Login with previous credentials will be rejected.
            </li>
            <li>
              <strong>Loss of Permissions:</strong> All role-based clearances (Operator, Supervisor, Manager, HR) and machinery access keys assigned to the profile are revoked instantly.
            </li>
            <li>
              <strong>Fresh Registration Required:</strong> If you rejoin {BRAND_NAME} or a client organization in the future, you must complete the onboarding and KYC verification workflow as a new user.
            </li>
          </ul>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: STATUTORY RETENTION EXCEPTION */}
        {/* ========================================================================= */}
        <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 text-left scroll-mt-14">
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight text-left">
            3. Statutory Heavy Equipment Records Exception
          </h2>
          <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed text-left font-normal">
            In strict accordance with the <strong>Indian Factories Act, 1948</strong>, OSHA industrial equipment standards, and equipment insurance mandates:
          </p>

          <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5 text-xs sm:text-[13px]">
            <div className="flex items-center gap-2 font-bold text-[var(--color-ink)]">
              <FileCheck size={14} className="text-[#0070f3]" />
              <span>Anonymized Industrial Fleet Telemetry Retained</span>
            </div>
            <p className="text-[var(--color-mute)] leading-relaxed">
              Machinery hour meter readings (opening/closing HMR), safety checklist inspection entries, mechanical breakdown logs, and shift timestamps are <strong>decoupled from your personal identity</strong> and preserved anonymously under machine asset codes (e.g. <code className="text-[11px] font-mono">#SL-004</code>). This ensures tamper-evident safety records for regulatory inspections without compromising your personal privacy.
            </p>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 4: STEP-BY-STEP DELETION GUIDE */}
        {/* ========================================================================= */}
        <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 text-left scroll-mt-14">
          <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight text-left">
            4. Step-by-Step Deletion Guide (3 Available Channels)
          </h2>

          <div className="space-y-3 pt-1">
            {/* Channel 1 */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-[var(--color-ink)]">
                <Laptop size={14} className="text-[#0070f3]" />
                <span>Channel 1: Dedicated Web Deletion Page</span>
              </div>
              <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed">
                Navigate to our dedicated <Link href="/delete-account" className="text-[#0070f3] dark:text-sky-400 font-semibold underline">Delete Account Page</Link>, select your deletion reason from the dropdown selector, check the mandatory acknowledgement checkbox confirming data cannot be restored, and click <strong>Submit Deletion Request</strong>.
              </p>
            </div>

            {/* Channel 2 */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-[var(--color-ink)]">
                <Smartphone size={14} className="text-purple-600 dark:text-purple-400" />
                <span>Channel 2: In-App Mobile Self-Service</span>
              </div>
              <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed">
                Open the ReachInternational Mobile App → Navigate to <em>Settings</em> → <em>Account Management</em> → Tap <strong>&quot;Request Account Deletion&quot;</strong>, choose your reason, and confirm submission.
              </p>
            </div>

            {/* Channel 3 */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-xs text-[var(--color-ink)]">
                <Mail size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>Channel 3: Official Compliance Email</span>
              </div>
              <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed">
                Send an email from your registered address to <a href={`mailto:${BRAND_EMAIL}?subject=Account%20Deletion%20Request`} className="text-[#0070f3] dark:text-sky-400 font-semibold underline">{BRAND_EMAIL}</a> with the subject <em>&quot;Account Deletion Request&quot;</em>.
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 5: SLA & TIMELINE */}
        {/* ========================================================================= */}
        <section className="p-4 sm:p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3 text-left scroll-mt-14">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-[var(--color-ink)]">
            <Clock size={14} className="text-sky-600" />
            <span>5. Processing SLA &amp; Verification Timeline</span>
          </div>

          <p className="text-xs sm:text-[13px] text-[var(--color-body)] leading-relaxed text-left font-normal">
            All submitted account deletion requests are acknowledged within <strong>48 hours</strong>. Complete account de-provisioning, session termination, and KYC data purging is finalized within <strong>14 business days</strong> as required by statutory data protection frameworks. You will receive an automated confirmation email once complete.
          </p>
        </section>
      </div>
    </LegalPageShell>
  );
}
