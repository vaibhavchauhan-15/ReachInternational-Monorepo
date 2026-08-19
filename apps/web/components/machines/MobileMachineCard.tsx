"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AnimatedMapPin,
  AnimatedPhone,
  AnimatedMessageSquare,
  AnimatedEdit,
  AnimatedTrash,
  AnimatedChevronRight,
  AnimatedCopy,
  AnimatedCheck,
  AnimatedCalendarClock,
} from "@/components/ui/animated-icons";
import { motion } from "framer-motion";
import { Badge, useToast } from "@/components/ui";
import type { MachineWithEngineer } from "@/lib/types/database";

interface MobileMachineCardProps {
  machine: MachineWithEngineer;
  isAdmin: boolean;
  today: string;
  tomorrow: string;
  onEdit: (machine: MachineWithEngineer) => void;
  onDelete: (machine: MachineWithEngineer) => void;
}

export function MobileMachineCard({
  machine,
  isAdmin,
  today,
  tomorrow,
  onEdit,
  onDelete,
}: MobileMachineCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const isOverdue = machine.next_service_due_date < today;
  const isToday = machine.next_service_due_date === today;
  const isTomorrow = machine.next_service_due_date === tomorrow;
  const isInactive = machine.status === "inactive";

  // Urgency Border Accent
  const borderAccentClass = isInactive
    ? "border-l-4 border-l-neutral-400 dark:border-l-neutral-600"
    : isOverdue
    ? "border-l-4 border-l-red-500 dark:border-l-red-500"
    : isToday
    ? "border-l-4 border-l-amber-500 dark:border-l-amber-400"
    : isTomorrow
    ? "border-l-4 border-l-blue-500 dark:border-l-blue-400"
    : "border-l-4 border-l-emerald-500 dark:border-l-emerald-400";

  // Top Sheen Hover Gradient Accent
  const sheenGradientClass = isOverdue
    ? "via-red-500/60"
    : isToday
    ? "via-amber-500/60"
    : isTomorrow
    ? "via-blue-500/60"
    : "via-[var(--color-link)]/40";

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(machine.machine_code);
    setCopied(true);
    toast("success", `Copied code: ${machine.machine_code}`);
    setTimeout(() => setCopied(false), 1800);
  };

  // Clean customer phone number for whatsapp link
  const cleanPhone = machine.customer_mobile.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`}?text=${encodeURIComponent(
    `Hello ${machine.customer_name}, regarding service for machine ${machine.machine_code} (${machine.machine_name})...`
  )}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.2, type: "spring", stiffness: 350, damping: 25 }}
      className={`p-4 rounded-xl border border-[var(--color-hairline)] bg-gradient-to-b from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)] shadow-xs hover:border-[var(--color-ink)]/30 hover:shadow-lg dark:hover:shadow-black/50 hover:-translate-y-0.5 transition-all flex flex-col gap-3 relative overflow-hidden group cursor-pointer ${borderAccentClass}`}
    >
      {/* Top Hairline Sheen Gradient on Hover */}
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${sheenGradientClass} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} />
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-bold text-xs border border-[var(--color-hairline)]">
            {machine.machine_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <Link
              href={`/machines/${machine.id}`}
              className="text-xs font-bold text-[var(--color-ink)] group-hover:text-[var(--color-link)] transition-colors truncate"
            >
              {machine.machine_name}
            </Link>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-mute)] mt-0.5">
              <button
                onClick={handleCopyCode}
                type="button"
                className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] active:scale-95 transition-all"
                title="Click to copy machine code"
              >
                <span>{machine.machine_code}</span>
                {copied ? (
                  <AnimatedCheck size={12} className="text-emerald-600" />
                ) : (
                  <AnimatedCopy size={12} className="text-[var(--color-mute)] group-hover:text-[var(--color-ink)]" />
                )}
              </button>
              {machine.model && (
                <span className="text-[10px] text-[var(--color-mute)] font-medium truncate max-w-[90px]">
                  {machine.model}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {machine.status === "inactive" && <Badge variant="neutral">Inactive</Badge>}
          {machine.status === "on_rent" && <Badge variant="info" dot>On Rent</Badge>}
          {machine.status === "under_maintenance" && <Badge variant="warning" dot>Under Maintenance</Badge>}
          {machine.status !== "inactive" && machine.status !== "on_rent" && machine.status !== "under_maintenance" && (
            <>
              {isOverdue && (
                <Badge variant="overdue" className="animate-pulse" dot>
                  Overdue
                </Badge>
              )}
              {isToday && (
                <Badge variant="today" dot>
                  Due Today
                </Badge>
              )}
              {isTomorrow && (
                <Badge variant="tomorrow" dot>
                  Tomorrow
                </Badge>
              )}
              {!isOverdue && !isToday && !isTomorrow && (
                <Badge variant="default">Due {machine.next_service_due_date}</Badge>
              )}
            </>
          )}
        </div>
      </div>

      {/* Center Details Box */}
      <div className="p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold tracking-wider shrink-0">
              Customer:
            </span>
            <span className="font-semibold text-[var(--color-ink)] truncate">
              {machine.customer_name}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-body)] font-medium shrink-0">
            <AnimatedMapPin size={12} className="text-[var(--color-mute)]" />
            {machine.city}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--color-hairline)]/50 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[9px] font-bold text-[var(--color-ink)] border border-[var(--color-hairline)] shrink-0">
              {machine.engineer?.full_name?.charAt(0).toUpperCase() || "?"}
            </div>
            <span className="text-[var(--color-body)] font-medium truncate">
              {machine.engineer?.full_name || "Unassigned"}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[var(--color-mute)] font-mono text-[10px] shrink-0">
            <AnimatedCalendarClock size={12} />
            <span>{machine.next_service_due_date}</span>
          </div>
        </div>
      </div>

      {/* Failure / Overdue Alert Banner if Overdue */}
      {isOverdue && (
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[11px] flex items-center gap-1.5 font-medium">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-ping shrink-0" />
          <span>Service overdue! Schedule immediate maintenance or contact engineer.</span>
        </div>
      )}

      {/* Action Footer */}
      <div
        className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]/50 mt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <a
            href={`tel:${machine.customer_mobile}`}
            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 hover:underline"
            title={`Call ${machine.customer_mobile}`}
          >
            <AnimatedPhone size={12} />
            <span>Call</span>
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400 px-2 py-1 rounded bg-green-50 dark:bg-green-950/40 hover:underline"
            title="Send WhatsApp message"
          >
            <AnimatedMessageSquare size={12} />
            <span>WhatsApp</span>
          </a>
        </div>

        <div className="flex items-center gap-1">
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
              title="Deactivate Machine"
            >
              <AnimatedTrash size={14} />
            </button>
          )}

          <Link
            href={`/machines/${machine.id}`}
            className="flex items-center gap-0.5 text-xs font-semibold text-[var(--color-link-deep)] hover:underline pl-1"
          >
            <span>Details</span>
            <AnimatedChevronRight size={14} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
