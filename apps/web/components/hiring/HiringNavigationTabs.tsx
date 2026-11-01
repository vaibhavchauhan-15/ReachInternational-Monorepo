"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatedBriefcase, AnimatedUsers } from "@/components/ui/animated-icons";
import { cn } from "@/lib/utils";

interface HiringNavigationTabsProps {
  totalJobs?: number;
  totalApplications?: number;
  newApplications?: number;
}

export function HiringNavigationTabs({
  totalJobs,
  totalApplications,
  newApplications,
}: HiringNavigationTabsProps) {
  const pathname = usePathname();

  const isJobs = pathname.startsWith("/hiring/jobs");
  const isApplications = pathname.startsWith("/hiring/applications");

  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] rounded-xl w-fit">
      <Link
        href="/hiring/jobs"
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none",
          isJobs
            ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-bold shadow-2xs border border-[var(--color-hairline)]"
            : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]/40"
        )}
      >
        <AnimatedBriefcase size={14} className={isJobs ? "text-sky-600 dark:text-sky-400" : ""} />
        <span>Job Postings</span>
        {totalJobs !== undefined && (
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ml-0.5",
              isJobs
                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]"
            )}
          >
            {totalJobs}
          </span>
        )}
      </Link>

      <Link
        href="/hiring/applications"
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none",
          isApplications
            ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-bold shadow-2xs border border-[var(--color-hairline)]"
            : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]/40"
        )}
      >
        <AnimatedUsers size={14} className={isApplications ? "text-sky-600 dark:text-sky-400" : ""} />
        <span>Applications</span>
        {totalApplications !== undefined && (
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ml-0.5",
              isApplications
                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]"
            )}
          >
            {totalApplications}
          </span>
        )}
        {newApplications !== undefined && newApplications > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            {newApplications} new
          </span>
        )}
      </Link>
    </div>
  );
}
