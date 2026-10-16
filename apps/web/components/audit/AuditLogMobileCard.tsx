"use client";

import React from "react";
import { Highlight } from "@/components/ui/Highlight";
import {
  formatAuditAction,
  getAuditSeverityStyle,
  getAuditLogDescription,
} from "@/lib/audit-helpers";
import type { AuditLogWithUser } from "@/lib/types/database";
import type { AuditTab } from "@/lib/queries/audit-logs";

export function formatAuditTime(dateStr: string, includeSeconds = true): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: includeSeconds ? "2-digit" : undefined,
      hour12: true,
    });
  } catch {
    return "—";
  }
}

export function formatAuditDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function AuditLogMobileSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2.5" aria-label="Loading audit logs...">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 shadow-sm space-y-2.5 animate-pulse"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="h-4 w-32 rounded bg-[var(--color-hairline)]" />
            <div className="h-4 w-14 rounded-full bg-[var(--color-hairline)]" />
          </div>
          <div className="h-3 w-48 rounded bg-[var(--color-hairline)]/70" />
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-hairline)]">
            <div className="h-3 w-28 rounded bg-[var(--color-hairline)]/60" />
            <div className="h-3 w-16 rounded bg-[var(--color-hairline)]/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface AuditLogMobileCardProps {
  log: AuditLogWithUser;
  activeTab: AuditTab;
  currentSearch?: string;
  onSelect: (log: AuditLogWithUser) => void;
}

export const AuditLogMobileCard: React.FC<AuditLogMobileCardProps> = ({
  log,
  activeTab,
  currentSearch = "",
  onSelect,
}) => {
  const severityStyle = getAuditSeverityStyle(log.severity || "info");
  const description = getAuditLogDescription(log);
  const meta = (log.metadata || {}) as Record<string, any>;

  return (
    <div
      onClick={() => onSelect(log)}
      className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 shadow-sm active:bg-[var(--color-canvas-subtle)] transition-colors min-h-[44px] cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(log);
        }
      }}
    >
      {/* Top Bar: Action & Severity */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-semibold text-xs text-[var(--color-ink)] leading-snug">
          {formatAuditAction(log.action)}
        </span>
        <span
          className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border ${severityStyle.bgClass} ${severityStyle.textClass}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full mr-1 ${severityStyle.dotClass}`}
          />
          {severityStyle.label}
        </span>
      </div>

      {/* Domain-specific highlights on mobile */}
      {activeTab === "assignments" && (meta.operator_name || meta.supervisor_name) && (
        <div className="text-xs font-semibold text-[var(--color-primary)] mb-1">
          Assigned: <Highlight text={meta.operator_name || meta.supervisor_name} query={currentSearch} />
        </div>
      )}

      {activeTab === "rentals" && (meta.client_name || meta.company_name) && (
        <div className="text-xs font-semibold text-[var(--color-primary)] mb-1">
          Client: <Highlight text={meta.client_name || meta.company_name} query={currentSearch} />
        </div>
      )}

      {/* Description / Summary */}
      {description && (
        <p className="text-xs text-[var(--color-subtle)] line-clamp-2 mb-2">
          <Highlight text={description} query={currentSearch} />
        </p>
      )}

      {/* Meta Strip */}
      <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)] pt-2 border-t border-[var(--color-hairline)]">
        <div className="flex items-center gap-1 font-mono">
          <span>By: <Highlight text={log.actor_name || log.user?.full_name || "System"} query={currentSearch} /></span>
          {log.entity_name && (
            <span>• <span className="text-[var(--color-ink)]"><Highlight text={log.entity_name} query={currentSearch} /></span></span>
          )}
        </div>
        <div suppressHydrationWarning className="font-mono text-[10px]">
          {formatAuditTime(log.created_at, false)}
        </div>
      </div>
    </div>
  );
};
