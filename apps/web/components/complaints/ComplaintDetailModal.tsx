"use client";

import { Modal, Button, Badge, CopyCell, TooltipWrapper } from "@/components/ui";
import { formatDisplayDate } from "@reachinternational/utils";
import type { ComplaintWithDetails, UserRole } from "@/lib/types/database";
import {
  AnimatedAlertTriangle,
  AnimatedWrench,
  AnimatedFileText,
  AnimatedEdit,
  AnimatedTrash,
  AnimatedMapPin,
  AnimatedClock,
  AnimatedUserCheck,
  AnimatedBuilding2,
  AnimatedCheckCircle,
} from "@/components/ui/animated-icons";
import { Shield, Package, FileCheck2, User, Cpu } from "lucide-react";

interface ComplaintDetailModalProps {
  open: boolean;
  onClose: () => void;
  complaint: ComplaintWithDetails | null;
  userRole: UserRole;
  onEdit?: () => void;
  onResolveFSR?: () => void;
  onDelete?: () => void;
}

export function ComplaintDetailModal({
  open,
  onClose,
  complaint,
  userRole,
  onEdit,
  onResolveFSR,
  onDelete,
}: ComplaintDetailModalProps) {
  if (!complaint) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="overdue">Open Malfunction</Badge>;
      case "in_progress":
        return <Badge variant="today">In Progress</Badge>;
      case "pending_parts":
        return <Badge variant="tomorrow">Pending Parts</Badge>;
      case "resolved":
        return <Badge variant="active">Resolved</Badge>;
      case "closed":
        return <Badge variant="inactive">Closed (FSR)</Badge>;
      default:
        return <Badge variant="inactive">{status}</Badge>;
    }
  };

  const isResolvedOrClosed = complaint.status === "resolved" || complaint.status === "closed";
  const formattedDate = complaint.complaint_date ? formatDisplayDate(complaint.complaint_date) : "—";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Complaint ${complaint.complaint_no} Details`}
      headerActions={
        <div className="flex items-center gap-1.5">
          {onDelete && (
            <TooltipWrapper content="Delete Complaint" side="top">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  onDelete();
                }}
                className="h-7 w-7 p-0 flex items-center justify-center text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 font-semibold"
                aria-label="Delete Complaint"
              >
                <AnimatedTrash size={14} />
              </Button>
            </TooltipWrapper>
          )}

          {onEdit && (
            <TooltipWrapper content="Edit Complaint" side="top">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  onClose();
                  onEdit();
                }}
                className="h-7 w-7 p-0 flex items-center justify-center font-semibold"
                aria-label="Edit Complaint"
              >
                <AnimatedEdit size={14} />
              </Button>
            </TooltipWrapper>
          )}

          {onResolveFSR && (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                onClose();
                onResolveFSR();
              }}
              className={`h-7 px-2.5 text-xs font-bold ${
                isResolvedOrClosed
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-sky-600 hover:bg-sky-700 text-white"
              }`}
            >
              {isResolvedOrClosed ? (
                <>
                  <AnimatedFileText size={13} className="mr-1" /> View FSR Report
                </>
              ) : (
                <>
                  <AnimatedWrench size={13} className="mr-1" /> Resolve (Fill FSR)
                </>
              )}
            </Button>
          )}
        </div>
      }
      size="xl"
    >
      <div className="flex flex-col gap-5">
        {/* Summary Banner */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <AnimatedAlertTriangle size={20} />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <CopyCell value={complaint.complaint_no} className="font-mono font-bold text-base text-[var(--color-ink)]" />
                {getStatusBadge(complaint.status)}
              </div>
              <span className="text-xs text-[var(--color-mute)]">
                Reported on <span className="font-medium text-[var(--color-ink)]">{formattedDate}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-[var(--color-hairline-soft-surface)] px-3 py-1.5 rounded-lg border border-[var(--color-hairline)] shrink-0">
            <Cpu size={14} className="text-[var(--color-link)] shrink-0" />
            <span className="font-bold text-[var(--color-ink)]">{complaint.machine?.machine_code || "—"}</span>
            <span className="text-[var(--color-mute)]">({complaint.machine?.model || "N/A"})</span>
          </div>
        </div>

        {/* Machine Specifications & Location Card */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedBuilding2 size={16} className="text-[var(--color-link)]" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Machine Details & Location
            </h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--color-mute)] font-medium">Machine Name</span>
              <span className="font-semibold text-[var(--color-ink)] truncate">{complaint.machine?.machine_name || "—"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--color-mute)] font-medium">Machine Code</span>
              <span className="font-mono font-bold text-[var(--color-link)]">{complaint.machine?.machine_code || "—"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--color-mute)] font-medium">Model Number</span>
              <span className="font-medium text-[var(--color-ink)]">{complaint.machine?.model || "N/A"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--color-mute)] font-medium">Serial No.</span>
              <span className="font-mono text-[var(--color-mute)]">{complaint.machine?.serial_number || "—"}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--color-mute)] font-medium">City / State</span>
              <span className="font-medium text-[var(--color-ink)] flex items-center gap-1">
                <AnimatedMapPin size={12} className="text-amber-500 shrink-0" />
                {complaint.city || complaint.state_name ? `${complaint.city || ""}, ${complaint.state_name || ""}`.trim().replace(/^,|,$/g, "") : complaint.location || "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--color-mute)] font-medium">Specific Location</span>
              <span className="font-medium text-[var(--color-ink)] truncate">{complaint.location || "—"}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--color-mute)] font-medium">Hour Meter Reading</span>
              <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                {complaint.hour_meter ? `${complaint.hour_meter} hrs` : "—"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[var(--color-mute)] font-medium">Category</span>
              <span className="font-medium text-[var(--color-ink)] capitalize">{complaint.machine?.machine_name || "Industrial Fleet"}</span>
            </div>
          </div>
        </div>

        {/* Breakdown Description & Parts Card */}
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <AnimatedWrench size={16} className="text-red-500" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
              Malfunction & Spare Part Requirements
            </h4>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <span className="text-[10px] text-[var(--color-mute)] font-medium uppercase tracking-wider">Reported Issue</span>
            <p className="p-3 rounded-lg bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-[var(--color-ink)] leading-relaxed font-medium">
              {complaint.complaint}
            </p>
          </div>

          {complaint.required_part && (
            <div className="mt-1 flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-300/60 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 text-xs">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <span className="font-bold">Required Spare Part: </span>
                  <span>{complaint.required_part}</span>
                </div>
              </div>
              <Badge variant="warning" className="font-bold">
                Qty: {complaint.part_quantity || 1}
              </Badge>
            </div>
          )}
        </div>

        {/* Personnel & Field Service Report Log */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Personnel */}
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
              <AnimatedUserCheck size={16} className="text-[var(--color-link)]" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                Personnel & Assignment
              </h4>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-[var(--color-hairline-soft-surface)] flex items-center justify-center text-[var(--color-ink)] font-bold shrink-0">
                  <User size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[var(--color-mute)]">Reported By (Supervisor)</span>
                  <span className="font-semibold text-[var(--color-ink)]">
                    {complaint.supervisor?.full_name || "Supervisor"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold shrink-0">
                  <AnimatedWrench size={14} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[var(--color-mute)]">Assigned Service Engineer</span>
                  <span className="font-semibold text-[var(--color-link)]">
                    {complaint.engineer?.full_name || "Unassigned"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Work Done & FSR Status */}
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-hairline)]">
              <FileCheck2 size={16} className="text-emerald-500" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink)]">
                Resolution & Work Log
              </h4>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              {complaint.work_done ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-[var(--color-mute)] font-medium">Work Completed</span>
                  <p className="p-2.5 rounded-lg bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] text-[11px]">
                    {complaint.work_done}
                  </p>
                </div>
              ) : (
                <span className="text-[11px] text-[var(--color-mute)] italic">No work log recorded yet.</span>
              )}

              {complaint.pending_work && (
                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Pending Tasks</span>
                  <p className="p-2.5 rounded-lg bg-amber-500/10 text-amber-900 dark:text-amber-200 text-[11px]">
                    {complaint.pending_work}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
