"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wrench, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface EquipmentAdminNavTabsProps {
  totalModels?: number;
  totalEnquiries?: number;
  newEnquiries?: number;
}

export function EquipmentAdminNavTabs({
  totalModels,
  totalEnquiries,
  newEnquiries,
}: EquipmentAdminNavTabsProps) {
  const pathname = usePathname();

  const isModels =
    pathname === "/marketing/equipment" ||
    pathname.startsWith("/marketing/equipment/new") ||
    (pathname.startsWith("/marketing/equipment/") &&
      !pathname.includes("/enquiries") &&
      !pathname.includes("/settings"));

  const isEnquiries = pathname.startsWith("/marketing/equipment/enquiries");
  const isSettings = pathname.startsWith("/marketing/equipment/settings");

  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] rounded-xl w-fit">
      <Link
        href="/marketing/equipment"
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none",
          isModels
            ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-bold shadow-2xs border border-[var(--color-hairline)]"
            : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]/40"
        )}
      >
        <Wrench size={14} className={isModels ? "text-sky-600 dark:text-sky-400" : ""} />
        <span>Fleet Models</span>
        {totalModels !== undefined && (
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ml-0.5",
              isModels
                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]"
            )}
          >
            {totalModels}
          </span>
        )}
      </Link>

      <Link
        href="/marketing/equipment/enquiries"
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none",
          isEnquiries
            ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-bold shadow-2xs border border-[var(--color-hairline)]"
            : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]/40"
        )}
      >
        <MessageSquare size={14} className={isEnquiries ? "text-sky-600 dark:text-sky-400" : ""} />
        <span>Quotation Enquiries</span>
        {newEnquiries !== undefined && newEnquiries > 0 ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ml-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {newEnquiries} new
          </span>
        ) : totalEnquiries !== undefined ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold ml-0.5 bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]">
            {totalEnquiries}
          </span>
        ) : null}
      </Link>

      <Link
        href="/marketing/equipment/settings"
        className={cn(
          "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none",
          isSettings
            ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-bold shadow-2xs border border-[var(--color-hairline)]"
            : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]/40"
        )}
      >
        <Settings size={14} className={isSettings ? "text-sky-600 dark:text-sky-400" : ""} />
        <span>Taxonomy Settings</span>
      </Link>
    </div>
  );
}
