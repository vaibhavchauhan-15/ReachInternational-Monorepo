"use client";

import { useMemo, useState } from "react";
import {
  AnimatedCheck,
  AnimatedCopy,
} from "@/components/ui/animated-icons";
import { Card, Badge } from "@/components/ui";
import type { MachineWithEngineer } from "@/lib/types/database";

interface BasicInfoTabProps {
  machine: MachineWithEngineer;
}

export default function BasicInfoTab({ machine }: BasicInfoTabProps) {
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machine.machine_id || machine.machine_code || "");
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <Card padding="md" className="card-hover-system sm:p-6">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
        <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
          Basic Info
        </h3>
        <Badge variant={machine.status === "rented" || machine.status === "on_rent" ? "info" : "neutral"} dot>
          <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-xs">
            {machine.status === "rented" || machine.status === "on_rent" ? "On Rent" : "Available"}
          </span>
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-3.5 text-xs sm:text-sm">
        {/* Machine ID */}
        <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Machine ID</span>
            <button
              type="button"
              onClick={handleCopyMachineId}
              title="Copy Unique Machine ID"
              className="text-[10px] text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-0.5 cursor-pointer"
            >
              {copiedId ? (
                <AnimatedCheck size={10} className="text-emerald-600" />
              ) : (
                <AnimatedCopy size={10} className="text-[var(--color-mute)]" />
              )}
            </button>
          </div>
          <span className="font-bold text-[var(--color-ink)] font-mono text-xs sm:text-sm">{machine.machine_id}</span>
        </div>

        {/* Model */}
        <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Model</span>
          <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.model || "—"}</span>
        </div>

        {/* Serial No */}
        <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Serial No</span>
          <span className="font-bold text-[var(--color-ink)] font-mono text-xs sm:text-sm">{machine.serial_number || "—"}</span>
        </div>

        {/* Year Of Mfg */}
        <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Year Of Mfg (YUM)</span>
          <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.year_of_mfg || "—"}</span>
        </div>

        {/* Manufacturer */}
        <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Manufacturer</span>
          <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.manufacturer || "—"}</span>
        </div>

        {/* Hour Meter (HMR) */}
        <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Hour Meter (HMR)</span>
          <span className="font-bold text-sky-600 dark:text-sky-400 font-mono text-xs sm:text-sm">{machine.hour_meter ?? 0} hrs</span>
        </div>

        {/* Health Status */}
        <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Health Status</span>
          <span className="font-bold text-xs sm:text-sm capitalize text-[var(--color-ink)]">
            {machine.health_status === "breakdown"
              ? "Breakdown"
              : machine.health_status === "under_maintenance"
              ? "Under Maintenance"
              : machine.health_status === "spare"
              ? "Spare"
              : "Active"}
          </span>
        </div>

        {/* Rental Fleet Status */}
        <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
          <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Rental Fleet Status</span>
          <span className="font-bold text-sky-600 dark:text-sky-400 text-xs sm:text-sm capitalize">
            {machine.status === "rented" || machine.status === "on_rent" ? "On Rent" : "Available"}
          </span>
        </div>
      </div>
    </Card>
  );
}
