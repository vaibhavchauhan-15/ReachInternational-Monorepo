import { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Smartphone,
  Globe,
  Clock,
  FileCheck,
} from "lucide-react";
import {
  BRAND_NAME,
  BRAND_WEBSITE,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from "@/lib/brand";
import { getCurrentUserOrNull } from "@/lib/dal";
import { ScissorLiftLogoIcon } from "@/components/branding";
import { AccountDeletionWebForm } from "./AccountDeletionWebForm";

export const metadata: Metadata = {
  title: "Account & Data Deletion — REACH INTERNATIONAL",
  description:
    "Official Account and Personal Data Erasure Request Portal for Reach International mobile application and enterprise platform.",
  alternates: {
    canonical: `${BRAND_WEBSITE}/account-deletion`,
  },
  openGraph: {
    title: "Account & Data Deletion — REACH INTERNATIONAL",
    description:
      "Instructions and portal for requesting complete account deletion and data erasure under Google Play Store policies.",
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
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--color-ink)]">
            Account & Data Deletion Request
          </h1>

          <p className="text-sm leading-relaxed text-[var(--color-body)]">
            In compliance with the <strong>Google Play Developer Account Deletion Policy</strong> and statutory privacy regulations, users of the <strong>ReachInternational</strong> application (<code>com.reachinternational.app</code>) have the full right to request complete de-provisioning of their user account and permanent erasure of their personal identity records.
          </p>
        </section>

        {/* Step-by-Step Instructions & Methods */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-5">
          <h2 className="text-sm font-bold tracking-wide uppercase text-[var(--color-ink)]">
            How to Request Account Deletion
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {/* Method 1: Direct Web Portal (Functional Web Deletion Form) */}
            <AccountDeletionWebForm
              initialEmail={currentUser?.email || ""}
              initialName={currentUser?.full_name || ""}
              isAuthenticated={Boolean(currentUser)}
            />

            {/* Method 2: In-App */}
            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm text-[var(--color-ink)]">
                <Smartphone className="w-4 h-4 text-[var(--color-link)]" />
                <span>Method 2: Inside the Mobile App</span>
              </div>
              <ol className="list-decimal list-inside text-xs text-[var(--color-body)] space-y-1.5 ml-1">
                <li>Launch the <strong>ReachInternational</strong> app on your Android or iOS device.</li>
                <li>Tap the <strong>Settings</strong> tab in the bottom navigation bar.</li>
                <li>Tap on <strong>My Account</strong> to expand your profile details.</li>
                <li>Scroll to the bottom and select <strong>Request Account Deletion</strong>.</li>
                <li>Submit your confirmation directly to our compliance desk.</li>
              </ol>
            </div>

            {/* Method 3: Web / Direct Email */}
            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm text-[var(--color-ink)]">
                <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Method 3: Direct Email Request (No App Required)</span>
              </div>
              <p className="text-xs text-[var(--color-body)] leading-relaxed">
                If you have uninstalled the application or cannot access your device, send an email directly to our compliance desk:
              </p>
              <div className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-1 text-xs">
                <p><strong>To:</strong> <a href="mailto:info@reachinternational.co.in" className="text-[var(--color-link)] font-semibold">info@reachinternational.co.in</a></p>
                <p><strong>Subject:</strong> Account Deletion Request — [Your Registered Email]</p>
                <p><strong>Body:</strong> Please delete my user account and associated personal KYC records registered under this email address.</p>
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
                <li>Full legal name, email, and phone number</li>
                <li>Encrypted authentication credentials and login sessions</li>
                <li>Masked Aadhaar and Driving Licence numbers</li>
                <li>Push notification tokens and device metadata</li>
                <li>Personal shift preferences and avatar photos</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
                <FileCheck className="w-4 h-4" />
                <span>Statutory Records Retained</span>
              </div>
              <p className="text-[var(--color-body)] leading-relaxed">
                Industrial safety legislation and equipment warranty statutes mandate that historical machine hour meter logs, pre-shift safety checklists, and equipment inspection logs be preserved in an anonymized format for auditing and regulatory insurance purposes.
              </p>
            </div>
          </div>
        </section>

        {/* Timeline & Verification */}
        <section className="p-6 sm:p-8 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-[var(--color-ink)]">
            <Clock className="w-4 h-4 text-sky-600" />
            <span>Processing Timeline</span>
          </div>

          <p className="text-xs text-[var(--color-body)] leading-relaxed">
            All verified account deletion requests are acknowledged within <strong>48 hours</strong> and fully executed within <strong>14 business days</strong>. Once finalized, you will receive a confirmation email verifying permanent erasure of your identity from our database.
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
