"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AnimatedEdit,
  AnimatedTrash,
  AnimatedChevronRight,
  AnimatedCopy,
  AnimatedCheck,
} from "@/components/ui/animated-icons";
import { motion } from "framer-motion";
import { Badge, useToast } from "@/components/ui";
import type { Machine } from "@/lib/types/database";

interface MobileMachineCardProps {
  machine: Machine;
  isAdmin: boolean;
  isSupervisor?: boolean;
  onEdit: (machine: Machine) => void;
  onDelete: (machine: Machine) => void;
}

export function MobileMachineCard({
  machine,
  isAdmin,
  isSupervisor = false,
  onEdit,
  onDelete,
}: MobileMachineCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!machine.machine_id) return;
    navigator.clipboard.writeText(machine.machine_id);
    setCopied(true);
    toast("success", `Copied ID: ${machine.machine_id}`);
    setTimeout(() => setCopied(false), 1800);
  };

  const getAccentBorder = () => {
    if (machine.health_status === "breakdown") {
      return "border-l-[3px] border-l-rose-500 dark:border-l-rose-400";
    }
    if (machine.health_status === "under_maintenance") {
      return "border-l-[3px] border-l-amber-500 dark:border-l-amber-400";
    }
    if (machine.status === "rented") {
      return "border-l-[3px] border-l-sky-500 dark:border-l-sky-400";
    }
    return "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400";
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      className={`p-3.5 sm:p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs hover:border-[var(--color-ink)]/30 hover:shadow-md transition-all flex flex-col gap-3 relative overflow-hidden group cursor-pointer ${getAccentBorder()}`}
    >
      {/* Top Hairline Sheen on Hover */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/40 dark:via-sky-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Header Row */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyCode}
              type="button"
              className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-[var(--color-hairline-soft-surface)] hover:bg-[var(--color-hairline)] border border-[var(--color-hairline)] text-xs font-mono font-bold uppercase text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 active:scale-95 transition-all cursor-pointer"
              title="Click to copy Machine ID"
            >
              <span>{machine.machine_id}</span>
              {copied ? (
                <AnimatedCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AnimatedCopy size={13} className="text-[var(--color-mute)] shrink-0" />
              )}
            </button>
            {machine.model && (
              <span className="text-xs sm:text-sm font-bold text-[var(--color-ink)] truncate tracking-tight">
                {machine.model}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--color-mute)] mt-1.5 font-medium">
            {machine.serial_number && (
              <span className="font-mono text-[var(--color-body)]">S/N: {machine.serial_number}</span>
            )}
            {machine.year_of_mfg && (
              <span className="before:content-['•'] before:mr-2">YUM: {machine.year_of_mfg}</span>
            )}
            {machine.manufacturer && (
              <span className="before:content-['•'] before:mr-2">Mfg: {machine.manufacturer}</span>
            )}
          </div>
        </div>

        {/* Health & Status Badges */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {machine.health_status === "breakdown" && (
            <Badge variant="overdue" dot className="whitespace-nowrap text-[10px] sm:text-xs">
              Breakdown
            </Badge>
          )}
          {machine.health_status === "under_maintenance" && (
            <Badge variant="warning" dot className="whitespace-nowrap text-[10px] sm:text-xs">
              Maintenance
            </Badge>
          )}
          {(!machine.health_status || machine.health_status === "active") && (
            <Badge variant="success" dot className="whitespace-nowrap text-[10px] sm:text-xs">
              Active
            </Badge>
          )}

          {machine.status === "rented" ? (
            <Badge variant="info" dot className="whitespace-nowrap text-[10px] sm:text-xs">
              Rented
            </Badge>
          ) : (
            <Badge variant="neutral" className="whitespace-nowrap text-[10px] sm:text-xs">
              Available
            </Badge>
          )}
        </div>
      </div>

      {/* Structured Key Specs Inset Well */}
      <div className="p-3 rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Hour Meter (HMR):</span>
            <span className="font-mono font-bold text-xs text-[var(--color-ink)] mt-0.5 block">
              {machine.hour_meter ?? 0} hrs
            </span>
          </div>
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Assigned Client:</span>
            <span
              className="font-bold text-xs text-[var(--color-ink)] mt-0.5 truncate block"
              title={machine.client?.company_name || machine.customer_name || "Unassigned"}
            >
              {machine.client?.company_name || machine.customer_name || "—"}
            </span>
          </div>
        </div>

        {/* Personnel Section */}
        <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[var(--color-mute)] font-medium">Supervisor:</span>
              {Array.isArray(machine.supervisors) && machine.supervisors.length > 3 && (
                <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                  +{machine.supervisors.length - 3}
                </span>
              )}
            </div>
            {(() => {
              const sups = Array.isArray(machine.supervisors) && machine.supervisors.length > 0
                ? machine.supervisors.filter((s) => Boolean(s?.full_name))
                : machine.current_supervisor?.full_name ? [machine.current_supervisor] : [];
              
              if (sups.length === 0) {
                return <span className="text-xs text-[var(--color-mute)] italic">Unassigned</span>;
              }

              const count = sups.length;
              const visible = sups.slice(0, 3);
              const remaining = count > 3 ? count - 3 : 0;
              const textSize =
                count === 1
                  ? "text-xs font-semibold"
                  : count === 2
                  ? "text-[11px] leading-tight font-semibold"
                  : "text-[10px] leading-[1.25] font-semibold";

              return (
                <div className="flex flex-col gap-0.5 min-w-0" title={sups.map((s) => s.full_name).join(", ")}>
                  {visible.map((s, idx) => {
                    const isLast = idx === visible.length - 1;
                    return (
                      <div key={s.id || idx} className="flex items-center gap-1 min-w-0">
                        <span className={`${textSize} text-[var(--color-ink)] truncate block`}>
                          {s.full_name}
                        </span>
                        {isLast && remaining > 0 && (
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
                            +{remaining}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[var(--color-mute)] font-medium">Operator (24h):</span>
              {Array.isArray(machine.operators) && machine.operators.length > 3 && (
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  +{machine.operators.length - 3}
                </span>
              )}
            </div>
            {(() => {
              const ops = Array.isArray(machine.operators) && machine.operators.length > 0
                ? machine.operators.filter((o) => Boolean(o?.full_name))
                : machine.current_operator?.full_name ? [machine.current_operator] : [];
              
              if (ops.length === 0) {
                return <span className="text-xs text-[var(--color-mute)] italic">Unassigned</span>;
              }

              const count = ops.length;
              const visible = ops.slice(0, 3);
              const remaining = count > 3 ? count - 3 : 0;
              const textSize =
                count === 1
                  ? "text-xs font-semibold"
                  : count === 2
                  ? "text-[11px] leading-tight font-semibold"
                  : "text-[10px] leading-[1.25] font-semibold";

              return (
                <div className="flex flex-col gap-0.5 min-w-0" title={ops.map((o) => o.full_name).join(", ")}>
                  {visible.map((o, idx) => {
                    const isLast = idx === visible.length - 1;
                    return (
                      <div key={o.id || idx} className="flex items-center gap-1 min-w-0">
                        <span className={`${textSize} text-[var(--color-ink)] truncate block`}>
                          {o.full_name}
                        </span>
                        {isLast && remaining > 0 && (
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                            +{remaining}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div
        className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => onEdit(machine)}
              className="h-8 px-3 rounded-md text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Edit Machine Specifications"
            >
              <AnimatedEdit size={14} className="text-amber-500 shrink-0" />
              <span>Edit</span>
            </button>
          )}

          {isSupervisor && !isAdmin && (
            <button
              type="button"
              onClick={() => onEdit(machine)}
              className="h-8 px-3 rounded-md text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Update Status & Assignments"
            >
              <AnimatedEdit size={14} className="text-sky-500 shrink-0" />
              <span>Update Status</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => onDelete(machine)}
              className="h-8 px-3 rounded-md text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Delete Machine"
            >
              <AnimatedTrash size={14} className="text-rose-500 shrink-0" />
              <span>Delete</span>
            </button>
          )}
        </div>

        <Link
          href={`/machines/${machine.id}`}
          className="h-8 px-3 rounded-md text-xs font-bold text-[var(--color-link)] bg-sky-500/10 hover:bg-sky-500/15 active:scale-95 transition-all flex items-center gap-1 shadow-2xs"
        >
          <span>View Details</span>
          <AnimatedChevronRight size={14} className="shrink-0" />
        </Link>
      </div>
    </motion.div>
  );
}
