import { Metadata } from "next";
import Link from "next/link";
import {
  BRAND_NAME,
  BRAND_WEBSITE,
  BRAND_WEBSITE_DISPLAY,
  BRAND_EMAIL,
} from "@/lib/brand";
import { getCurrentUserOrNull } from "@/lib/dal";
import { ScissorLiftLogoIcon } from "@/components/branding";
import { getMyPendingAccountDeletionRequestAction } from "@/app/actions/account-deletion";
import { DeleteAccountClient } from "./DeleteAccountClient";

export const metadata: Metadata = {
  title: "Delete Account & Personal Data — REACH INTERNATIONAL",
  description:
    "Official Account Deletion Request Page for Reach International mobile application and enterprise platform.",
  alternates: {
    canonical: `${BRAND_WEBSITE}/delete-account`,
  },
  openGraph: {
    title: "Delete Account & Personal Data — REACH INTERNATIONAL",
    description:
      "Submit an official account deletion and personal identity records erasure request.",
    type: "website",
    url: `${BRAND_WEBSITE}/delete-account`,
    siteName: BRAND_NAME,
  },
};

export default async function DeleteAccountPage() {
  const currentUser = await getCurrentUserOrNull();
  const isLoggedIn = Boolean(currentUser && currentUser.status === "active");

  let initialPendingRequest: any = null;
  if (currentUser) {
    try {
      initialPendingRequest = await getMyPendingAccountDeletionRequestAction();
    } catch {}
  }

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

      {/* Main Content */}
      <main className="max-w-[760px] mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 flex-1">
        <DeleteAccountClient
          currentUser={currentUser as any}
          initialPendingRequest={initialPendingRequest}
        />
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
            <Link href="/account-deletion" className="text-[var(--color-body)] hover:text-[var(--color-ink)] transition-colors">
              Account Deletion Guide
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
