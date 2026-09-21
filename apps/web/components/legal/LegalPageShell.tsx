"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShellClient } from "@/components/layout/AppShellClient";
import type { User } from "@/lib/types/database";
import { ReachInternationalLogo } from "@/components/ui";
import { AnimatedArrowLeft } from "@/components/ui/animated-icons";
import { ArrowLeft } from "lucide-react";

export interface LegalPageShellProps {
  user: User | null;
  defaultCollapsed?: boolean;
  title: string;
  lastUpdated?: string;
  backHref?: string;
  children: React.ReactNode;
}

/**
 * Universal Responsive Legal Page Shell for Privacy Policy, Terms of Service,
 * Account Deletion Guide, and Delete Account.
 *
 * Capabilities:
 * - Authenticated Desktop: Full AppSidebar, standard authenticated layout shell (AppShellClient),
 *   in-page desktop breadcrumb / header with back-to-settings.
 * - Authenticated Mobile: Standard MobilePageHeader (solid top bar, back arrow) and BottomNav.
 * - Unauthorized / Guest Desktop: Public header with Reach International "Reaching All Heights" logo,
 *   direct "Sign In" action, centered clean reading view.
 * - Unauthorized / Guest Mobile: Clean public mobile top bar with back navigation and quick "Sign In" button;
 *   no logo displayed on mobile for a clean focused header.
 */
export function LegalPageShell({
  user,
  defaultCollapsed = false,
  title,
  lastUpdated = "September 21, 2026",
  backHref = "/settings",
  children,
}: LegalPageShellProps) {
  const router = useRouter();

  const handlePublicBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/login");
    }
  };

  // 1. Authenticated User Experience (shows desktop sidebar, mobile header + bottom nav)
  if (user) {
    return (
      <AppShellClient user={user} defaultCollapsed={defaultCollapsed}>
        <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* In-Page Desktop Breadcrumb & Action Bar */}
          <div className="hidden md:flex items-center justify-between pb-3.5 border-b border-[var(--color-hairline)] select-none print:hidden">
            <div className="flex items-center gap-2 text-xs">
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors py-1 px-2 rounded-lg hover:bg-[var(--color-canvas-elevated)]"
              >
                <AnimatedArrowLeft size={14} />
                <span>Settings</span>
              </Link>
              <span className="text-[var(--color-hairline)]">/</span>
              <span className="font-semibold text-[var(--color-ink)]">{title}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--color-mute)]">
                Last updated: {lastUpdated}
              </span>
            </div>
          </div>

          {/* Document Content Viewport */}
          <article className="w-full space-y-4 sm:space-y-6 pb-12 sm:pb-16">
            {children}
          </article>
        </div>
      </AppShellClient>
    );
  }

  // 2. Unauthorized / Guest User Experience (Public layout, zero login redirection)
  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] flex flex-col justify-between font-sans selection:bg-[var(--color-ink)] selection:text-white">
      {/* Public Top Header */}
      <header className="sticky top-0 z-40 w-full h-12 sm:h-14 bg-[var(--color-canvas)]/95 backdrop-blur-md border-b border-[var(--color-hairline)] shadow-xs flex items-center px-3 sm:px-6 select-none print:hidden transition-colors">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          {/* Mobile Back Button + Title (Clean Header, Zero Logo on Mobile) */}
          <div className="flex sm:hidden items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handlePublicBack}
              aria-label="Back"
              className="flex items-center justify-center h-8.5 w-8.5 rounded-lg text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)] active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-sm font-semibold text-[var(--color-ink)] tracking-tight truncate">
              {title}
            </h1>
          </div>

          {/* Desktop Brand Logo: Reach International "Reaching All Heights" Logo */}
          <div className="hidden sm:flex items-center">
            <Link
              href="/"
              className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg transition-transform hover:scale-[1.01]"
              title="Reach International Home"
              aria-label="Reach International Home"
            >
              <ReachInternationalLogo variant="full" size={24} />
            </Link>
          </div>

          {/* Public Action Controls: Sign In button only */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)] active:scale-95 transition-all cursor-pointer"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Centered Document Viewport */}
      <main className="max-w-4xl mx-auto w-full px-3.5 sm:px-6 py-6 sm:py-10 flex-1 space-y-4 sm:space-y-6">
        <article className="w-full space-y-4 sm:space-y-6 pb-12 sm:pb-16">
          {children}
        </article>
      </main>
    </div>
  );
}
