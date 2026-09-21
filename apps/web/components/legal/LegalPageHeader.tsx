"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatedArrowLeft } from "@/components/ui/animated-icons";

export interface LegalPageHeaderProps {
  title: string;
}

/**
 * Standardized Legal Page Header for /privacy, /terms, and legal documentation.
 * Conforms to Geist design tokens:
 * - Back button with back arrow routing to /settings (or previous in-app history)
 * - Clean title only (Privacy Policy, Terms of Service, etc.)
 * - Zero action buttons (no Go to Dashboard, no Sign In)
 */
export function LegalPageHeader({ title }: LegalPageHeaderProps) {
  const router = useRouter();

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/settings");
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full h-12 bg-[var(--color-canvas)]/95 backdrop-blur-md border-b border-[var(--color-hairline)] shadow-xs flex items-center px-3 sm:px-6 select-none print:hidden transition-colors">
      <div className="max-w-[760px] mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href="/settings"
            onClick={handleBack}
            aria-label="Back to Settings"
            title="Back to Settings"
            className="flex items-center justify-center h-8.5 w-8.5 rounded-lg text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)] active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <AnimatedArrowLeft size={18} />
          </Link>
          <h1 className="text-[15px] font-bold text-[var(--color-ink)] tracking-tight truncate px-1">
            {title}
          </h1>
        </div>
        {/* Right side is intentionally empty: "at the header only show the title" and "remove any btn" */}
        <div className="w-8.5 shrink-0" aria-hidden="true" />
      </div>
    </header>
  );
}
