"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AnimatedCopy,
  AnimatedCheck,
} from "@/components/ui/animated-icons";
import { History, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { Badge, useToast } from "@/components/ui";
import { Highlight } from "@/components/ui/Highlight";
import { MachineRowActionsMenu } from "./MachineRowActionsMenu";
import type { Machine } from "@/lib/types/database";

export interface MachineCardData {
  id: string;
  machine_id?: string | null;
  machine_code?: string | null;
  model?: string | null;
  machine_name?: string | null;
  serial_number?: string | null;
  manufacturer?: string | null;
  year_of_mfg?: string | number | null;
  status?: string | null;
  health_status?: string | null;
  hour_meter?: number | null;
  supervisors?: Array<{ id?: string; full_name?: string; phone?: string | null }> | null;
  operators?: Array<{ id?: string; full_name?: string; phone?: string | null }> | null;
  current_supervisor?: { id?: string; full_name?: string; phone?: string | null } | null;
  current_operator?: { id?: string; full_name?: string; phone?: string | null } | null;
  assigned_operator_name?: string | null;
  assigned_operator_code?: string | null;
  client?: { company_name?: string | null; code?: string | null } | null;
  customer_name?: string | null;
  [key: string]: any;
}

export interface MobileMachineCardProps {
  machine: Machine | MachineCardData;
  isAdmin?: boolean;
  isSupervisor?: boolean;
  isOperatorView?: boolean;
  canAssignSupervisor?: boolean;
  canAssignOperator?: boolean;
  canAssignClient?: boolean;
  canViewAudit?: boolean;
  onLogEntry?: (machine: any) => void;
  searchTerm?: string;
  onEditMachine?: (machine: any) => void;
  onAssignSupervisor?: (machine: any) => void;
  onAssignOperator?: (machine: any) => void;
  onEditPersonnel?: (machine: any) => void;
  onEditClient?: (machine: any) => void;
  onViewAudit?: (machine: any) => void;
  onViewLogs?: (machine: any) => void;
  onDelete?: (machine: any) => void;
  // Fallbacks
  onEdit?: (machine: any) => void;
  onViewAssignments?: (machine: any) => void;
  onViewHistory?: (machine: any) => void;
  onViewDetails?: (machine: any) => void;
  className?: string;
  showActions?: boolean;
}

export function MobileMachineCard({
  machine,
  isAdmin = false,
  isSupervisor = false,
  isOperatorView = false,
  canAssignSupervisor,
  canAssignOperator,
  canAssignClient,
  canViewAudit,
  onLogEntry,
  searchTerm = "",
  onEditMachine,
  onAssignSupervisor,
  onAssignOperator,
  onEditPersonnel,
  onEditClient,
  onViewAudit,
  onViewLogs,
  onDelete,
  onEdit,
  onViewAssignments,
  onViewHistory,
  onViewDetails,
  className = "",
  showActions = true,
}: MobileMachineCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const m = machine as MachineCardData;

  // Resilient field normalization across Machine and UserMachineItem
  const machineId = m.machine_id || m.machine_code || m.id || "—";
  const modelName = m.model || m.machine_name || "";
  const serialNumber = m.serial_number || "";
  const hourMeter = m.hour_meter != null ? m.hour_meter : 0;
  const clientName = m.client?.company_name || m.customer_name || "—";
  const healthStatus = m.health_status || (m.status === "active" ? "active" : undefined);
  const rentalStatus = m.status === "rented" ? "rented" : "available";

  const supervisors = useMemo(() => {
    if (Array.isArray(m.supervisors) && m.supervisors.length > 0) {
      return m.supervisors.filter((s: any) => Boolean(s?.full_name));
    }
    if (m.current_supervisor?.full_name) {
      return [m.current_supervisor];
    }
    return [];
  }, [m.supervisors, m.current_supervisor]);

  const operators = useMemo(() => {
    if (Array.isArray(m.operators) && m.operators.length > 0) {
      return m.operators.filter((o: any) => Boolean(o?.full_name));
    }
    if (m.current_operator?.full_name) {
      return [m.current_operator];
    }
    if (m.assigned_operator_name) {
      return [{
        id: "assigned",
        full_name: m.assigned_operator_name,
        code: m.assigned_operator_code,
      }];
    }
    return [];
  }, [m.operators, m.current_operator, m.assigned_operator_name, m.assigned_operator_code]);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!machineId || machineId === "—") return;
    navigator.clipboard.writeText(machineId);
    setCopied(true);
    toast("success", `Copied ID: ${machineId}`);
    setTimeout(() => setCopied(false), 1800);
  };

  const getAccentBorder = () => {
    if (healthStatus === "breakdown") {
      return "border-l-[3px] border-l-rose-500 dark:border-l-rose-400";
    }
    if (healthStatus === "under_maintenance") {
      return "border-l-[3px] border-l-amber-500 dark:border-l-amber-400";
    }
    if (healthStatus === "spare") {
      return "border-l-[3px] border-l-cyan-500 dark:border-l-cyan-400";
    }
    if (rentalStatus === "rented") {
      return "border-l-[3px] border-l-sky-500 dark:border-l-sky-400";
    }
    return "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400";
  };

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails(machine);
    } else {
      router.push(`/machines/${machine.machine_id || machine.id}`);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      onClick={handleCardClick}
      tabIndex={0}
      role="article"
      aria-label={`Machine ${machineId}: ${modelName || "Asset"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={`p-3.5 sm:p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs hover:border-[var(--color-ink)]/30 hover:shadow-md transition-all flex flex-col gap-3 relative overflow-hidden group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${getAccentBorder()} ${className}`}
    >
      {/* Top Hairline Sheen on Hover */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/40 dark:via-sky-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Header Row: M/C ID Chip on Left (Thin Padding matching status chips), Status Badges on Right */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handleCopyCode}
          type="button"
          className="inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full bg-[var(--color-hairline-soft-surface)] hover:bg-[var(--color-hairline)] border border-[var(--color-hairline)] text-xs font-mono font-semibold uppercase text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 active:scale-95 transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-sky-500 shrink-0"
          title="Click to copy Machine ID"
        >
          <span>
            <Highlight text={machineId} query={searchTerm} />
          </span>
          {copied ? (
            <AnimatedCheck size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AnimatedCopy size={12} className="text-[var(--color-mute)] shrink-0" />
          )}
        </button>

        {/* Health & Status Badges */}
        <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap">
          {healthStatus === "breakdown" && (
            <Badge variant="overdue" dot className="whitespace-nowrap text-xs">
              Breakdown
            </Badge>
          )}
          {healthStatus === "under_maintenance" && (
            <Badge variant="warning" dot className="whitespace-nowrap text-xs">
              Maintenance
            </Badge>
          )}
          {healthStatus === "spare" && (
            <Badge variant="spare" dot className="whitespace-nowrap text-xs">
              Spare
            </Badge>
          )}
          {(!healthStatus || healthStatus === "active") && (
            <Badge variant="success" dot className="whitespace-nowrap text-xs">
              Active
            </Badge>
          )}

          {rentalStatus === "rented" ? (
            <Badge variant="info" dot className="whitespace-nowrap text-xs">
              Rented
            </Badge>
          ) : (
            <Badge variant="neutral" className="whitespace-nowrap text-xs">
              Available
            </Badge>
          )}
        </div>
      </div>

      {/* Model · S/N · Manufacturer · Mfg year. Mirrors the native card meta row
          and wraps (instead of clipping) on narrow viewports. */}
      {(modelName || serialNumber || m.manufacturer || m.year_of_mfg) && (
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0 text-sm leading-snug">
          {modelName && (
            <span
              className="font-bold text-[var(--color-ink)] truncate tracking-tight min-w-0"
              title={modelName}
            >
              <Highlight text={modelName} query={searchTerm} />
            </span>
          )}
          {modelName && (serialNumber || m.manufacturer || m.year_of_mfg) && (
            <span className="text-[var(--color-mute)] shrink-0 text-xs select-none">•</span>
          )}
          {serialNumber && (
            <span
              className="font-mono text-xs text-[var(--color-mute)] truncate max-w-[55%] font-medium"
              title={`S/N: ${serialNumber}`}
            >
              <span className="text-[var(--color-mute)] font-sans">S/N:</span>{" "}
              <Highlight text={serialNumber} query={searchTerm} />
            </span>
          )}
          {serialNumber && m.manufacturer && (
            <span className="text-[var(--color-mute)] shrink-0 text-xs select-none">•</span>
          )}
          {m.manufacturer && (
            <span className="text-xs text-[var(--color-mute)] truncate" title={m.manufacturer}>
              {m.manufacturer}
            </span>
          )}
          {(serialNumber || m.manufacturer) && m.year_of_mfg && (
            <span className="text-[var(--color-mute)] shrink-0 text-xs select-none">•</span>
          )}
          {m.year_of_mfg && (
            <span className="text-xs text-[var(--color-mute)]">Mfg: {m.year_of_mfg}</span>
          )}
        </div>
      )}

      {/* Structured Key Specs Inset Well — Seamlessly Clickable as Part of the Whole Card */}
      <div className="p-3 rounded-xl bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Hour Meter (HMR):</span>
            <span className="font-mono font-bold text-xs text-[var(--color-ink)] mt-0.5 block">
              {hourMeter} hrs
            </span>
          </div>
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Assigned Client:</span>
            <span
              className="font-bold text-xs text-[var(--color-ink)] mt-0.5 truncate block"
              title={clientName}
            >
              {clientName}
            </span>
          </div>
        </div>

        {/* Personnel Section */}
        <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="mb-0.5">
              <span className="text-[var(--color-mute)] font-medium">Supervisor:</span>
            </div>
            {(() => {
              if (supervisors.length === 0) {
                return <span className="text-xs text-[var(--color-mute)] italic">Unassigned</span>;
              }

              const count = supervisors.length;
              const visible = supervisors.slice(0, 3);
              const remaining = count > 3 ? count - 3 : 0;
              const textSize = "text-xs font-semibold";

              return (
                <div className="flex flex-col gap-0.5 min-w-0" title={supervisors.map((s: any) => s.full_name).join(", ")}>
                  {visible.map((s: any, idx: number) => {
                    const isLast = idx === visible.length - 1;
                    return (
                      <div key={`${s.id || 'sup'}-${idx}`} className="flex items-center gap-1 min-w-0">
                        <span className={`${textSize} text-[var(--color-ink)] truncate block`}>
                          {s.full_name}
                        </span>
                        {isLast && remaining > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
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
            <div className="mb-0.5">
              <span className="text-[var(--color-mute)] font-medium">Operator (24h):</span>
            </div>
            {(() => {
              if (operators.length === 0) {
                return <span className="text-xs text-[var(--color-mute)] italic">Unassigned</span>;
              }

              const count = operators.length;
              const visible = operators.slice(0, 3);
              const remaining = count > 3 ? count - 3 : 0;
              const textSize = "text-xs font-semibold";

              return (
                <div className="flex flex-col gap-0.5 min-w-0" title={operators.map((o: any) => o.full_name).join(", ")}>
                  {visible.map((o: any, idx: number) => {
                    const isLast = idx === visible.length - 1;
                    return (
                      <div key={`${o.id || 'op'}-${idx}`} className="flex items-center gap-1 min-w-0">
                        <span className={`${textSize} text-[var(--color-ink)] truncate block`}>
                          {o.full_name}
                        </span>
                        {isLast && remaining > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
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

      {/* Action Footer: 3-Dots Menu & Logs on Left, Assign Operator on Right */}
      {showActions && (
        <div
          className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)] gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            {(isAdmin || isSupervisor || canAssignSupervisor || canAssignOperator) && (onEditMachine || onAssignSupervisor || onAssignOperator || onDelete || onViewAudit || onViewLogs || onViewAssignments) && (
              <MachineRowActionsMenu
                machine={machine as Machine}
                canEdit={Boolean(isAdmin)}
                isSupervisor={Boolean(isSupervisor)}
                isAdmin={Boolean(isAdmin)}
                canAssignClient={canAssignClient}
                canViewAudit={canViewAudit}
                onEditMachine={onEditMachine}
                onAssignSupervisor={onAssignSupervisor}
                onAssignOperator={onAssignOperator}
                onEditPersonnel={onEditPersonnel}
                onEditClient={onEditClient}
                onViewAudit={onViewAudit}
                onViewLogs={onViewLogs}
                onDelete={onDelete}
                onEdit={onEdit}
                onViewAssignments={onViewAssignments}
                onViewHistory={onViewHistory}
                onViewDetails={onViewDetails}
                align="left"
                triggerClassName="min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] sm:h-8 sm:w-8 rounded-lg text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] active:scale-95 transition-all text-xs font-semibold flex items-center justify-center cursor-pointer shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            )}

            {/* Logs Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onViewLogs) {
                  onViewLogs(machine);
                } else {
                  router.push(`/machines/${machine.machine_id || machine.id}?tab=running_hours`);
                }
              }}
              className="min-h-[44px] sm:min-h-[32px] sm:h-8 px-3 rounded-lg text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] active:scale-95 transition-all text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              title="View Machine Running Logs (HMR)"
            >
              <History size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
              <span className="inline text-xs font-semibold">Logs</span>
            </button>
          </div>

          {/* Operator view: Log Entry CTA (no assignment controls are mounted). */}
          {isOperatorView && onLogEntry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLogEntry(machine);
              }}
              className="min-h-[44px] sm:min-h-[32px] sm:h-8 px-3 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ml-auto"
              title="Log a shift entry for this machine"
            >
              <span className="inline text-xs font-semibold">Log Entry</span>
            </button>
          )}

          {/* Assign Operator Button (manager tier / supervisor only) */}
          {!isOperatorView && (canAssignOperator ?? (isAdmin || isSupervisor)) && onAssignOperator && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onAssignOperator) {
                  onAssignOperator(machine);
                } else if (onEditPersonnel) {
                  onEditPersonnel(machine);
                } else if (onViewAssignments) {
                  onViewAssignments(machine);
                }
              }}
              className="min-h-[44px] sm:min-h-[32px] sm:h-8 px-3 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ml-auto"
              title="Assign Operator to this Machine"
            >
              <UserPlus size={14} className="shrink-0" />
              <span className="inline text-xs font-semibold">Assign Operator</span>
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
