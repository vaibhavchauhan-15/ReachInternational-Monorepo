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
  onEdit: (machine: Machine) => void;
  onDelete: (machine: Machine) => void;
}

export function MobileMachineCard({
  machine,
  isAdmin,
  onEdit,
  onDelete,
}: MobileMachineCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(machine.machine_id);
    setCopied(true);
    toast("success", `Copied ID: ${machine.machine_id}`);
    setTimeout(() => setCopied(false), 1800);
  };

  const isBreakdown = machine.health_status === "breakdown";
  const isMaintenance = machine.health_status === "under_maintenance";

  const borderAccentClass = isBreakdown
    ? "border-l-4 border-l-red-500"
    : isMaintenance
    ? "border-l-4 border-l-amber-500"
    : "border-l-4 border-l-emerald-500";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      className={`p-4 rounded-xl border border-[var(--color-hairline)] bg-gradient-to-b from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)] shadow-xs flex flex-col gap-3 relative overflow-hidden group cursor-pointer ${borderAccentClass}`}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-bold text-xs border border-[var(--color-hairline)]">
            {(machine.model || machine.machine_id).charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <button
              onClick={handleCopyCode}
              type="button"
              className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase text-[var(--color-ink)] hover:text-[var(--color-link)] transition-all w-fit"
            >
              <span>{machine.machine_id}</span>
              {copied ? (
                <AnimatedCheck size={12} className="text-emerald-600" />
              ) : (
                <AnimatedCopy size={12} className="text-[var(--color-mute)]" />
              )}
            </button>
            {machine.model && (
              <span className="text-xs font-semibold text-[var(--color-body)] truncate">
                Model: {machine.model}
              </span>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-mute)] mt-0.5">
              {machine.serial_number && <span>Sr: {machine.serial_number}</span>}
              {machine.year_of_mfg && <span>• YUM: {machine.year_of_mfg}</span>}
              {machine.manufacturer && <span>• Mfg: {machine.manufacturer}</span>}
            </div>
          </div>
        </div>

        {/* Health & Status Badges */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {machine.health_status === "breakdown" && <Badge variant="overdue" dot>Breakdown</Badge>}
          {machine.health_status === "under_maintenance" && <Badge variant="warning" dot>Maintenance</Badge>}
          {machine.health_status === "active" && <Badge variant="success" dot>Active</Badge>}

          {machine.status === "rented" ? (
            <Badge variant="info" dot>Rented</Badge>
          ) : (
            <Badge variant="neutral">Available</Badge>
          )}
        </div>
      </div>

      {/* Details Box */}
      <div className="p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--color-mute)] font-medium">Hour Meter (HMR):</span>
          <span className="font-mono font-bold text-[var(--color-ink)]">{machine.hour_meter ?? 0} hrs</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--color-mute)] font-medium">Service Count:</span>
          <span className="font-bold text-[var(--color-ink)]">{machine.service_count ?? 0} Services</span>
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--color-hairline)]">
          <span className="text-[var(--color-mute)] font-medium">Supervisor:</span>
          <span className="font-semibold text-[var(--color-ink)]">{machine.current_supervisor?.full_name || "-"}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--color-mute)] font-medium">Operator:</span>
          <span className="font-semibold text-[var(--color-ink)]">{machine.current_operator?.full_name || "-"}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div
        className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(machine)}
            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-95 transition-all text-xs"
            title="Edit Machine"
          >
            <AnimatedEdit size={14} />
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onDelete(machine)}
              className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-error)] hover:bg-[rgba(238,0,0,0.08)] active:scale-95 transition-all text-xs"
              title="Delete Machine"
            >
              <AnimatedTrash size={14} />
            </button>
          )}
        </div>

        <Link
          href={`/machines/${machine.id}`}
          className="flex items-center gap-0.5 text-xs font-semibold text-[var(--color-link-deep)] hover:underline"
        >
          <span>View Details</span>
          <AnimatedChevronRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}
