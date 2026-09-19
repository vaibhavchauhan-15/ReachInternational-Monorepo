"use client";

import React from "react";
import { Building2, MapPin, Truck, AlertCircle } from "lucide-react";
import type { OperatorEntryContext } from "@reachinternational/types";

interface OperatorMachineInfoProps {
  machine: OperatorEntryContext["machine"];
  client: OperatorEntryContext["client"];
  operator: OperatorEntryContext["operator"];
}

export function OperatorMachineInfo({
  machine,
  client,
}: OperatorMachineInfoProps) {
  if (!machine) {
    return (
      <div className="p-3.5 sm:p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm">
          <p className="font-bold">No Machine Assigned</p>
          <p className="text-[11px] sm:text-xs opacity-90 mt-0.5">
            You do not currently have an active machine assignment. Please contact your supervisor to assign equipment to your shift.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[var(--color-mute)] font-mono">
          Assigned Equipment &amp; Worksite
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
        {/* Machine Card */}
        <div className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-start gap-3 shadow-2xs">
          <div className="h-8 w-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
            <Truck className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
                {machine.model ? `${machine.model} (${machine.machine_id})` : machine.machine_id}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] sm:text-[11px] font-mono text-[var(--color-mute)] bg-[var(--color-canvas)] px-1.5 py-0.5 rounded border border-[var(--color-hairline)]">
                S/N: {machine.serial_number || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Client & Site Card */}
        <div className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-start gap-3 shadow-2xs">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate">
              {client?.company_name || "Internal Yard / Unassigned"}
            </h3>
            <div className="flex items-start gap-1 mt-1 text-[11px] text-[var(--color-mute)]">
              <MapPin className="h-3 w-3 shrink-0 text-rose-500 mt-0.5" />
              <span className="break-words leading-tight" title={client?.site || "Base Yard"}>
                {client?.site || "Base Yard"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
