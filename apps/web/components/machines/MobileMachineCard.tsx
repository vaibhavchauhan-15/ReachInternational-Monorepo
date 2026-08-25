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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs hover:border-[var(--color-ink)]/30 transition-all flex flex-col gap-3 relative overflow-hidden group cursor-pointer"
    >
      {/* Header Row — Cleaned without initial circle avatar */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyCode}
              type="button"
              className="inline-flex items-center gap-1 font-mono text-xs font-extrabold uppercase text-[var(--color-ink)] hover:text-[var(--color-link)] transition-all w-fit"
            >
              <span>{machine.machine_id}</span>
              {copied ? (
                <AnimatedCheck size={12} className="text-emerald-600" />
              ) : (
                <AnimatedCopy size={12} className="text-[var(--color-mute)]" />
              )}
            </button>
            {machine.model && (
              <span className="text-xs font-bold text-[var(--color-ink)] truncate">
                • {machine.model}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-mute)] mt-1 font-medium">
            {machine.serial_number && <span>S/N: {machine.serial_number}</span>}
            {machine.year_of_mfg && <span>• YUM: {machine.year_of_mfg}</span>}
            {machine.manufacturer && <span>• Mfg: {machine.manufacturer}</span>}
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

      {/* Structured Key Specs Inset Well */}
      <div className="p-3 rounded-lg bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] text-xs flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Hour Meter (HMR):</span>
            <span className="font-mono font-bold text-[var(--color-ink)]">{machine.hour_meter ?? 0} hrs</span>
          </div>
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Service Count:</span>
            <span className="font-bold text-[var(--color-ink)]">{machine.service_count ?? 0} Services</span>
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--color-hairline)] grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Supervisor:</span>
            <span className="font-semibold text-[var(--color-ink)] truncate block" title={machine.current_supervisor?.full_name || "Unassigned"}>
              {machine.current_supervisor?.full_name || "Unassigned"}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-mute)] font-medium block">Operator:</span>
            <span className="font-semibold text-[var(--color-ink)] truncate block" title={machine.current_operator?.full_name || "Unassigned"}>
              {machine.current_operator?.full_name || "Unassigned"}
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div
        className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(machine)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] active:scale-95 transition-all text-xs font-semibold"
            title="Edit Machine"
          >
            <AnimatedEdit size={14} className="text-amber-500" />
            <span>Edit</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onDelete(machine)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-rose-600 hover:bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 active:scale-95 transition-all text-xs font-semibold"
              title="Delete Machine"
            >
              <AnimatedTrash size={14} className="text-rose-500" />
              <span>Delete</span>
            </button>
          )}
        </div>

        <Link
          href={`/machines/${machine.id}`}
          className="flex items-center gap-1 text-xs font-bold text-[var(--color-link)] hover:underline py-1.5 px-2"
        >
          <span>View Details</span>
          <AnimatedChevronRight size={14} />
        </Link>
      </div>
    </motion.div>
  );
}
