import { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Smartphone,
  Globe,
  Clock,
  FileCheck,
  Laptop,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Mail,
  Trash2,
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
  title: "Account & Data Deletion Guide — REACH INTERNATIONAL",
  description:
    "Official Account and Personal Data Erasure Policy and Guide for Reach International mobile application and enterprise platform.",
  alternates: {
    canonical: `${BRAND_WEBSITE}/account-deletion`,
  },
  openGraph: {
    title: "Account & Data Deletion Guide — REACH INTERNATIONAL",
    description:
      "Step-by-step instructions and compliance policy for requesting complete account deletion and data erasure under Google Play Store policies.",
    type: "website",
    url: `${BRAND_WEBSITE}/account-deletion`,
    siteName: BRAND_NAME,
  },
};

export default async function AccountDeletionPage() {
  const currentUser = await getCurrentUserOrNull();
  const isLoggedIn = Boolean(currentUser && currentUser.status === "active");

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] flex flex-col justify-between font-sans selection:bg-[var(--color-ink)] selection:text-white">
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
                href={currentUser?.role === "operator" ? "/operations?tab=entry" : "/machines"}
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

      {/* Main Container */}
      <main className="max-w-[760px] mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 space-y-6 sm:space-y-8 flex-1">
        {/* Header Hero — Clean Minimalist Typography */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-mute)] uppercase tracking-wider">
            <ShieldCheck size={14} className="text-[#0070f3]" />
            <span>Compliance & Privacy Policy</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
            Account Deletion & Data Erasure Guide
          </h1>

          <p className="text-sm leading-relaxed text-[var(--color-body)]">
            In compliance with the <strong>Google Play Developer Account Deletion Policy</strong> and statutory privacy regulations (including India's Digital Personal Data Protection Act), users of the <strong>ReachInternational</strong> mobile application (<code>com.reachinternational.app</code>) and web portal have the full right to request complete de-provisioning of their account and permanent erasure of their personal identity records.
          </p>

          <div className="mt-3 p-3.5 rounded-xl border border-sky-500/20 bg-sky-500/5 text-xs text-[var(--color-body)] flex items-start gap-2.5">
            <Clock size={16} className="text-[#0070f3] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-[var(--color-ink)]">Policy Notice: </strong>
              This page is the informational compliance guide. To submit an official deletion request immediately, proceed to our dedicated deletion portal.
            </div>
          </div>

          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-xs">
            <div className="flex items-center gap-2">
              <Trash2 size={16} className="text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-[var(--color-body)]">
                Ready to submit an official account deletion request?
              </span>
            </div>
            <Link
              href="/delete-account"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              <span>Go to Delete Account Page</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </section>

        {/* Step-by-Step Instructions & Methods */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-5">
          <h2 className="text-sm font-bold tracking-wide uppercase text-[var(--color-ink)]">
            How to Request Account Deletion
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {/* Method 1: Web Application (From Profile Dialogue) */}
            <div className="p-5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm text-[var(--color-ink)]">
                  <Laptop className="w-4 h-4 text-[#0070f3]" />
                  <span>Method 1: In the Web Application (From Your Profile)</span>
                </div>
                <Link
                  href="/delete-account"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition-colors"
                >
                  <Trash2 size={12} />
                  <span>Open Deletion Page</span>
                  <ArrowRight size={11} />
                </Link>
              </div>

              <ol className="list-decimal list-inside text-xs text-[var(--color-body)] space-y-2 ml-1 leading-relaxed">
                <li>
                  Sign in to your account at <strong>{BRAND_WEBSITE_DISPLAY}</strong>.
                </li>
                <li>
                  Click on your <strong>Profile Card</strong> at the bottom of the navigation sidebar (or open the profile dropdown).
                </li>
                <li>
                  Select the red <strong>Account Deletion</strong> option.
                </li>
                <li>
                  A secure dialogue box will appear prompting you to fill in the <strong>Reason for Deletion</strong>.
                </li>
                <li>
                  Click <strong>Submit Deletion Request</strong> to transmit the request directly to administrators.
                </li>
                <li>
                  Company administrators will review the request, deactivate your account, and permanently scrub your personal KYC credentials.
                </li>
              </ol>
            </div>

            {/* Method 2: In-App Mobile */}
            <div className="p-5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-[var(--color-ink)]">
                <Smartphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Method 2: Inside the Mobile App (Android & iOS)</span>
              </div>
              <ol className="list-decimal list-inside text-xs text-[var(--color-body)] space-y-2 ml-1 leading-relaxed">
                <li>Launch the <strong>ReachInternational</strong> app on your mobile device.</li>
                <li>Tap the <strong>Settings</strong> tab in the bottom floating navigation bar.</li>
                <li>Select <strong>My Account</strong> or tap on your Profile.</li>
                <li>Scroll down and tap <strong>Request Account Deletion</strong>.</li>
                <li>In the confirmation dialogue, provide your reason and confirm submission.</li>
              </ol>
            </div>

            {/* Method 3: Web / Direct Email */}
            <div className="p-5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-[var(--color-ink)]">
                <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Method 3: Direct Email Request (If You Cannot Access the App)</span>
              </div>
              <p className="text-xs text-[var(--color-body)] leading-relaxed">
                If you have uninstalled the application, lost your device, or are unable to log in, you can submit a manual deletion request directly to our compliance desk:
              </p>
              <div className="p-3.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1 text-xs">
                <p><strong>To:</strong> <a href={`mailto:${BRAND_EMAIL}`} className="text-[#0070f3] font-semibold">{BRAND_EMAIL}</a></p>
                <p><strong>Subject:</strong> Account Deletion Request — [Your Registered Email / Phone]</p>
                <p><strong>Body:</strong> Please delete my user account and associated personal KYC records registered under this email address. Reason: [Brief reason].</p>
              </div>
            </div>
          </div>
        </section>

        {/* Data Erasure Details: What is Deleted vs Retained */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-4">
          <h2 className="text-sm font-bold tracking-wide uppercase text-[var(--color-ink)]">
            Data Erasure Breakdown
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Data Permanently Purged</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[var(--color-body)] ml-1">
                <li>Full legal name, email address, and personal phone</li>
                <li>Encrypted authentication credentials and active sessions</li>
                <li>Aadhaar card number and Driving Licence records</li>
                <li>Push notification tokens and device hardware IDs</li>
                <li>Personal shift preferences and avatar photos</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
                <FileCheck className="w-4 h-4" />
                <span>Statutory Machine Records Retained</span>
              </div>
              <p className="text-[var(--color-body)] leading-relaxed">
                Industrial machinery safety legislation (Indian Factories Act, 1948) and insurance policies mandate that historical machine hour meter readings (HMR), breakdown durations, and equipment pre-shift inspection logs be preserved in an anonymized archive for statutory safety auditing.
              </p>
            </div>
          </div>
        </section>

        {/* Timeline & Verification */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-[var(--color-ink)]">
            <Clock className="w-4 h-4 text-sky-600" />
            <span>Processing Timeline & Verification</span>
          </div>

          <p className="text-xs text-[var(--color-body)] leading-relaxed">
            All submitted account deletion requests are reviewed by system administrators and acknowledged within <strong>48 hours</strong>. Complete account de-provisioning and KYC scrubbing is fully executed within <strong>14 business days</strong>. You will receive an automated confirmation email once the process is complete.
          </p>
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
            <Link href="/terms" className="text-[var(--color-body)] hover:text-[var(--color-ink)] transition-colors">
              Terms of Service
            </Link>
            <span className="text-[var(--color-hairline)]">•</span>
            <Link href="/account-deletion" className="text-[var(--color-ink)] font-bold hover:underline">
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
