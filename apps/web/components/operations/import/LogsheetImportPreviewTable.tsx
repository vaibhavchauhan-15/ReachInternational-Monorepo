"use client";

import React from "react";
import { SegmentedToggle } from "@/components/ui";
import type { LogsheetImportIssue, LogsheetImportRowStatus } from "@reachinternational/validation";
import type { LogsheetPreviewRow } from "@/lib/server/logsheet-import/types";

export type LogsheetPreviewFilter = "all" | "valid" | "warning" | "invalid" | "duplicate" | "review";

const STATUS_META: Record<
  LogsheetImportRowStatus,
  { label: string; className: string }
> = {
  valid: { label: "Valid", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25" },
  warning: { label: "Warning", className: "bg-amber-500/10 text-amber-600 border-amber-500/25" },
  duplicate: { label: "Duplicate", className: "bg-sky-500/10 text-sky-600 border-sky-500/25" },
  invalid: { label: "Invalid", className: "bg-rose-500/10 text-rose-600 border-rose-500/25" },
  review: { label: "Needs Review", className: "bg-orange-500/10 text-orange-600 border-orange-500/25" },
};

const SEVERITY_BADGE: Record<LogsheetImportIssue["severity"], string> = {
  error: "bg-rose-500/10 text-rose-600 border-rose-500/25",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/25",
};

function StatusPill({ status }: { status: LogsheetImportRowStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export interface LogsheetImportPreviewTableProps {
  rows: LogsheetPreviewRow[];
  filter: LogsheetPreviewFilter;
  onFilterChange: (filter: LogsheetPreviewFilter) => void;
  counts: { all: number; valid: number; warning: number; invalid: number; duplicate: number; review: number };
}

/**
 * Interactive preview table for the logsheet import: filterable statuses, the
 * real logsheet fields, resolved values and per-row validation details.
 * Desktop = high-density table; mobile = stacked touch cards (3-tier contract).
 */
export const LogsheetImportPreviewTable = React.memo(function LogsheetImportPreviewTable({
  rows,
  filter,
  onFilterChange,
  counts,
}: LogsheetImportPreviewTableProps) {
  const filtered = React.useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter((r) => {
            if (filter === "valid") return r.status === "valid" || r.status === "warning";
            return r.status === filter;
          }),
    [rows, filter]
  );

  const filterItems: Array<{ id: LogsheetPreviewFilter; label: string }> = [
    { id: "all", label: `All (${counts.all})` },
    { id: "valid", label: `Valid (${counts.valid + counts.warning})` },
    { id: "invalid", label: `Invalid (${counts.invalid})` },
    { id: "duplicate", label: `Duplicates (${counts.duplicate})` },
    { id: "review", label: `Review (${counts.review})` },
    { id: "warning", label: `Warnings (${counts.warning})` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <SegmentedToggle<LogsheetPreviewFilter>
        items={filterItems}
        value={filter}
        onChange={onFilterChange}
        size="sm"
        ariaLabel="Filter preview rows by validation status"
      />

      {/* Desktop: high-density table */}
      <div className="hidden md:block overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-hairline)]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-[var(--color-hairline-soft-surface)] text-[11px] uppercase text-[var(--color-mute)]">
              <th className="px-2.5 py-2 font-semibold">Row</th>
              <th className="px-2.5 py-2 font-semibold">Status</th>
              <th className="px-2.5 py-2 font-semibold">Date</th>
              <th className="px-2.5 py-2 font-semibold">Operator</th>
              <th className="px-2.5 py-2 font-semibold">Shift</th>
              <th className="px-2.5 py-2 font-semibold">Start–End</th>
              <th className="px-2.5 py-2 font-semibold text-right">HMR Start</th>
              <th className="px-2.5 py-2 font-semibold text-right">HMR End</th>
              <th className="px-2.5 py-2 font-semibold text-right">Running H</th>
              <th className="px-2.5 py-2 font-semibold text-right">OT</th>
              <th className="px-2.5 py-2 font-semibold">Condition</th>
              <th className="px-2.5 py-2 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.rowNumber}
                className="border-t border-[var(--color-hairline)] align-top hover:bg-[var(--color-canvas)]"
              >
                <td className="px-2.5 py-2 font-mono text-[11px] text-[var(--color-mute)]">{row.rowNumber}</td>
                <td className="px-2.5 py-2"><StatusPill status={row.status} /></td>
                <td className="px-2.5 py-2 whitespace-nowrap">{row.source.logDate || "—"}</td>
                <td className="px-2.5 py-2">
                  <div className="font-medium text-[var(--color-ink)]">{row.resolved.operatorLabel}</div>
                  {(row.source.operatorEmployeeId || row.source.operatorName) && (
                    <div className="text-[10px] text-[var(--color-mute)]">
                      {[row.source.operatorEmployeeId, row.source.operatorName].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-2.5 py-2 whitespace-nowrap">
                  {row.resolved.shiftCode}
                  {!row.source.shiftCode && <span className="text-[10px] text-[var(--color-mute)]"> (auto)</span>}
                </td>
                <td className="px-2.5 py-2 whitespace-nowrap">
                  {row.source.startTime}–{row.source.endTime}
                  {row.resolved.isOvernight && (
                    <span className="text-[10px] text-sky-600"> +1d</span>
                  )}
                </td>
                <td className="px-2.5 py-2 text-right font-mono">{row.source.startMeter ?? "—"}</td>
                <td className="px-2.5 py-2 text-right font-mono">{row.source.endMeter ?? "—"}</td>
                <td className="px-2.5 py-2 text-right font-mono font-semibold">{row.resolved.runningHours.toFixed(2)}</td>
                <td className="px-2.5 py-2 text-right font-mono">
                  {row.resolved.overtimeHours.toFixed(2)}
                  {row.source.overtimeHours === null && (
                    <span className="text-[10px] text-[var(--color-mute)]"> (auto)</span>
                  )}
                </td>
                <td className="px-2.5 py-2 whitespace-nowrap">
                  {row.resolved.machineCondition}
                  {row.resolved.breakdownDuration && (
                    <div className="text-[10px] text-rose-600">{row.resolved.breakdownDuration}</div>
                  )}
                </td>
                <td className="px-2.5 py-2 min-w-[220px]">
                  {row.issues.length === 0 ? (
                    <span className="text-[var(--color-mute)]">—</span>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {row.issues.map((issue, idx) => (
                        <li key={idx} className="text-[11px] leading-snug">
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-semibold mr-1 ${SEVERITY_BADGE[issue.severity]}`}
                          >
                            {issue.severity === "error" ? "ERROR" : "WARN"}
                          </span>
                          <span className="text-[var(--color-ink)]">{issue.message}</span>
                          {issue.columnLabel && (
                            <span className="text-[var(--color-mute)]">
                              {" "}({issue.columnLabel}
                              {issue.value ? `: "${issue.value}"` : ""} → {issue.expected})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked touch cards */}
      <div className="md:hidden flex flex-col gap-2">
        {filtered.map((row) => (
          <div
            key={row.rowNumber}
            className="rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[var(--color-mute)]">#{row.rowNumber}</span>
                <span className="text-[13px] font-semibold text-[var(--color-ink)]">{row.source.logDate || "—"}</span>
              </div>
              <StatusPill status={row.status} />
            </div>
            <div className="text-xs text-[var(--color-ink)]">
              <div className="font-semibold">{row.resolved.operatorLabel}</div>
              <div className="text-[var(--color-mute)]">
                Shift {row.resolved.shiftCode} · {row.source.startTime}–{row.source.endTime}
                {row.resolved.isOvernight ? " (+1d)" : ""}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft-surface)] py-1.5">
                <div className="text-[9px] uppercase text-[var(--color-mute)] font-semibold">HMR</div>
                <div className="text-[11px] font-mono">{row.source.startMeter ?? "—"} → {row.source.endMeter ?? "—"}</div>
              </div>
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft-surface)] py-1.5">
                <div className="text-[9px] uppercase text-[var(--color-mute)] font-semibold">Running</div>
                <div className="text-[11px] font-mono font-semibold">{row.resolved.runningHours.toFixed(2)}h</div>
              </div>
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft-surface)] py-1.5">
                <div className="text-[9px] uppercase text-[var(--color-mute)] font-semibold">OT</div>
                <div className="text-[11px] font-mono">{row.resolved.overtimeHours.toFixed(2)}h</div>
              </div>
            </div>
            {row.issues.length > 0 && (
              <ul className="flex flex-col gap-1">
                {row.issues.map((issue, idx) => (
                  <li key={idx} className="text-[11px] leading-snug">
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-semibold mr-1 ${SEVERITY_BADGE[issue.severity]}`}
                    >
                      {issue.severity === "error" ? "ERROR" : "WARN"}
                    </span>
                    <span className="text-[var(--color-ink)]">{issue.message}</span>
                    {issue.columnLabel && (
                      <span className="text-[var(--color-mute)]">
                        {" "}({issue.columnLabel}
                        {issue.value ? `: "${issue.value}"` : ""} → {issue.expected})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-10 text-center text-sm text-[var(--color-mute)]">
          No rows match this filter.
        </div>
      )}
    </div>
  );
});
