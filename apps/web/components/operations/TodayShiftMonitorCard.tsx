"use client";

import React from "react";
import {
  UserCheck,
  AlertCircle,
  UserPlus,
  Wrench,
  Edit2,
} from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { Highlight } from "@/components/ui/Highlight";
import type { TodayShiftMonitorRow } from "@/lib/data/operations/today-shift-monitor";

export interface TodayShiftMonitorCardProps {
  row: TodayShiftMonitorRow;
  idx: number;
  searchQuery: string;
  canEnterLog: boolean;
  onInitiateAssign: (row: TodayShiftMonitorRow) => void;
  onEnterLog: (row: TodayShiftMonitorRow) => void;
  activeMenuCardKey?: string | null;
  setActiveMenuCardKey?: React.Dispatch<React.SetStateAction<string | null>>;
  menuRef?: React.RefObject<HTMLDivElement | null>;
}

function formatTime(t: string | null) {
  if (!t) return "—";
  try {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  } catch {
    return t;
  }
}

export function TodayShiftMonitorCard({
  row,
  idx,
  searchQuery,
  canEnterLog,
  onInitiateAssign,
  onEnterLog,
}: TodayShiftMonitorCardProps) {
  const isUnassigned = row.status === "unassigned" || !row.operator_id;
  const isEntered = row.status === "entered";
  const isBreakdown = row.machine_health_status === "breakdown";
  const isMaintenance =
    row.machine_health_status === "under_maintenance" ||
    row.machine_status === "under_maintenance";

  return (
    <div
      onClick={() => {
        if (isUnassigned) {
          onInitiateAssign(row);
        }
      }}
      className={`rounded-lg border bg-[var(--color-canvas-elevated)] p-3 space-y-2 transition-all ${
        isUnassigned
          ? "cursor-pointer hover:border-[var(--color-ink)]/30 active:scale-[0.99]"
          : ""
      } ${
        isEntered
          ? "border-sky-500/30 bg-sky-500/[0.03] dark:border-sky-500/30 dark:bg-sky-950/20"
          : isBreakdown
          ? "border-rose-500/30 bg-rose-500/[0.03]"
          : isMaintenance
          ? "border-amber-500/30 bg-amber-500/[0.03]"
          : isUnassigned
          ? "border-amber-500/30 bg-amber-500/[0.02]"
          : "border-[var(--color-hairline)]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isUnassigned ? (
            isBreakdown ? (
              <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-rose-600 dark:text-rose-400">
                <AlertCircle size={15} />
                <span>Breakdown Machine</span>
              </div>
            ) : isMaintenance ? (
              <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-amber-600 dark:text-amber-400">
                <Wrench size={15} />
                <span>Under Maintenance</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-amber-600 dark:text-amber-400">
                <AlertCircle size={15} />
                <span>Unassigned Machine</span>
              </div>
            )
          ) : (
            <div className="font-bold text-sm text-[var(--color-ink)] truncate">
              <Highlight text={row.operator_name} query={searchQuery} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant={
              isEntered
                ? "success"
                : isBreakdown
                ? "error"
                : isMaintenance
                ? "warning"
                : isUnassigned
                ? "warning"
                : "warning"
            }
            dot
            className={`text-xs font-semibold px-2 py-0.5 shrink-0 ${
              isBreakdown
                ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                : isMaintenance
                ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : ""
            }`}
          >
            {isEntered
              ? "Entered"
              : isBreakdown
              ? "Breakdown"
              : isMaintenance
              ? "Maintenance"
              : isUnassigned
              ? "Unassigned"
              : "Pending"}
          </Badge>
        </div>
      </div>

      {/* Operator Subtitle */}
      {!isUnassigned && row.operator_employee_id && (
        <div className="text-xs text-muted-foreground font-mono">
          <span className="font-semibold text-sky-700 dark:text-sky-300">
            <Highlight text={row.operator_employee_id} query={searchQuery} />
          </span>
        </div>
      )}

      {/* Details List - All values left-aligned with well-formatted rows */}
      <div className="text-xs space-y-1.5 pt-1.5 border-t border-[var(--color-hairline)]">
        {/* Machine: Model & Serial Number both */}
        <div className="flex items-baseline gap-2 py-0.5 border-b border-[var(--color-hairline)]/30">
          <span className="w-24 shrink-0 text-muted-foreground font-medium">Machine:</span>
          <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
            <span className="font-semibold text-[var(--color-ink)] truncate">
              <Highlight text={row.machine_model || row.machine_code || "—"} query={searchQuery} />
            </span>
            {(() => {
              const serialText =
                row.machine_serial_number ||
                (row.machine_model && row.machine_code !== row.machine_model ? row.machine_code : null);
              if (!serialText) return null;
              const hasPrefix =
                serialText.trim().toUpperCase().startsWith("SN") ||
                serialText.trim().toUpperCase().startsWith("S/N");
              return (
                <span className="font-mono text-muted-foreground text-[11px] shrink-0">
                  ({hasPrefix ? "" : "SN: "}
                  <Highlight text={serialText} query={searchQuery} />)
                </span>
              );
            })()}
          </div>
        </div>

        {/* Shift */}
        <div className="flex items-baseline gap-2 py-0.5 border-b border-[var(--color-hairline)]/30">
          <span className="w-24 shrink-0 text-muted-foreground font-medium">Shift:</span>
          <div className="flex items-baseline gap-1.5 flex-wrap font-medium">
            <span className="font-mono font-bold text-[var(--color-ink)]">
              {row.shift_code
                ? row.shift_code.trim().toUpperCase().startsWith("SHIFT")
                  ? row.shift_code.trim()
                  : `Shift ${row.shift_code.trim()}`
                : "—"}
            </span>
            {(row.shift_start || row.shift_end) && (
              <span className="text-muted-foreground font-mono text-[11px]">
                ({formatTime(row.shift_start)} – {formatTime(row.shift_end)})
              </span>
            )}
          </div>
        </div>

        {/* Meter / HMR */}
        <div className="flex items-baseline gap-2 py-0.5 border-b border-[var(--color-hairline)]/30">
          <span className="w-24 shrink-0 text-muted-foreground font-medium">HMR (Hours):</span>
          <span className="font-mono font-bold text-[var(--color-ink)]">
            {(() => {
              const start = row.start_meter;
              const end = row.end_meter;
              if (start != null && end != null) {
                return `${start} → ${end}`;
              }
              if (start != null) {
                return `${start} → ${end ?? "—"}`;
              }
              if (end != null) {
                return `— → ${end}`;
              }
              if (row.current_meter != null) {
                return `${row.current_meter}`;
              }
              return "—";
            })()}
          </span>
        </div>

        {/* Client */}
        <div className="flex items-baseline gap-2 py-0.5 border-b border-[var(--color-hairline)]/30">
          <span className="w-24 shrink-0 text-muted-foreground font-medium">Client:</span>
          <span className="font-medium text-[var(--color-ink)] truncate">
            <Highlight text={row.client_name || "—"} query={searchQuery} />
          </span>
        </div>

        {/* Site */}
        <div className="flex items-baseline gap-2 py-0.5">
          <span className="w-24 shrink-0 text-muted-foreground font-medium">Site:</span>
          <span className="font-medium text-[var(--color-ink)] truncate">
            <Highlight
              text={row.client_city || row.site_name || "—"}
              query={searchQuery}
            />
          </span>
        </div>
      </div>

      {/* Entered By Attribution */}
      {isEntered && row.entered_by_name && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5 px-0.5 pt-0.5">
          <UserCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Entered by {row.entered_by_name}</span>
          {row.entry_source && row.entry_source !== "operator" && (
            <Badge variant="info" className="text-xs font-semibold px-1.5 py-0.5">
              {row.entry_source}
            </Badge>
          )}
        </div>
      )}

      {/* Action Button - Placed at the bottom of the card */}
      {canEnterLog && !isUnassigned ? (
        <Button
          variant={isEntered ? "outline" : "primary"}
          onClick={(e) => {
            e.stopPropagation();
            onEnterLog(row);
          }}
          className={`w-full h-10 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer mt-1 ${
            isEntered
              ? "border-sky-500/40 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10"
              : "bg-sky-600 hover:bg-sky-500 text-white"
          }`}
        >
          <Edit2 size={14} className="shrink-0" />
          <span>{isEntered ? "Edit Shift" : "Enter Shift"}</span>
        </Button>
      ) : isUnassigned ? (
        <Button
          variant={isBreakdown ? "outline" : "primary"}
          onClick={(e) => {
            e.stopPropagation();
            onInitiateAssign(row);
          }}
          className={`w-full h-10 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer mt-1 ${
            isBreakdown
              ? "border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
              : isMaintenance
              ? "bg-amber-600 hover:bg-amber-500 text-white"
              : "bg-sky-600 hover:bg-sky-500 text-white"
          }`}
        >
          {isBreakdown || isMaintenance ? <Wrench size={15} /> : <UserPlus size={15} />}
          <span>
            {isBreakdown
              ? `Activate & Assign ${row.machine_model || row.machine_code}`
              : isMaintenance
              ? `Activate & Assign ${row.machine_model || row.machine_code}`
              : `Assign Operator to ${row.machine_model || row.machine_code}`}
          </span>
        </Button>
      ) : null}
    </div>
  );
}
