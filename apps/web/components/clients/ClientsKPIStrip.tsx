"use client";

import React, { memo } from "react";
import { Building2, CheckCircle2, ShieldAlert, MapPin } from "lucide-react";

interface ClientsKPIStripProps {
  metrics: {
    total: number;
    active: number;
    inactive: number;
    cities: number;
    locationsCovered?: number;
  };
}

export const ClientsKPIStrip = memo(function ClientsKPIStrip({ metrics }: ClientsKPIStripProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Total Clients */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-xs transition-colors hover:border-[var(--color-hairline-strong)]">
        <div className="flex items-center justify-between text-xs text-[var(--color-mute)] mb-1">
          <span className="font-medium">Total Clients</span>
          <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Building2 className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-[var(--color-ink)] tracking-tight">{metrics.total}</p>
        <span className="text-[10px] text-[var(--color-mute)]">Registered master accounts</span>
      </div>

      {/* Active Clients */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-xs transition-colors hover:border-emerald-500/30">
        <div className="flex items-center justify-between text-xs text-[var(--color-mute)] mb-1">
          <span className="font-medium">Active Clients</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
          {metrics.active}
        </p>
        <span className="text-[10px] text-[var(--color-mute)]">Operational rental accounts</span>
      </div>

      {/* Inactive Clients */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-xs transition-colors hover:border-amber-500/30">
        <div className="flex items-center justify-between text-xs text-[var(--color-mute)] mb-1">
          <span className="font-medium">Inactive Clients</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
          {metrics.inactive}
        </p>
        <span className="text-[10px] text-[var(--color-mute)]">Deactivated or soft-deleted</span>
      </div>

      {/* Locations Covered */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-xs transition-colors hover:border-purple-500/30">
        <div className="flex items-center justify-between text-xs text-[var(--color-mute)] mb-1">
          <span className="font-medium">Locations Covered</span>
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <MapPin className="h-4 w-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-[var(--color-ink)] tracking-tight">
          {metrics.locationsCovered ?? metrics.cities}
        </p>
        <span className="text-[10px] text-[var(--color-mute)]">Unique client project cities</span>
      </div>
    </div>
  );
});
