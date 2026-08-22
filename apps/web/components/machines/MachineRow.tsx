"use client";

import { memo } from "react";
import Link from "next/link";
import { AnimatedEye, AnimatedEdit, AnimatedTrash } from "@/components/ui/animated-icons";
import { TableRow, TableCell, Badge, TooltipWrapper } from "@/components/ui";
import type { Machine } from "@/lib/types/database";

interface MachineRowProps {
  machine: Machine;
  isAdmin: boolean;
  onEdit: (machine: Machine) => void;
  onDelete: (machine: Machine) => void;
}

function getHealthBadge(healthStatus: string) {
  if (healthStatus === "breakdown") {
    return <Badge variant="overdue" dot>Breakdown</Badge>;
  }
  if (healthStatus === "under_maintenance") {
    return <Badge variant="warning" dot>Under Maintenance</Badge>;
  }
  return <Badge variant="success" dot>Active</Badge>;
}

function getRentalStatusBadge(status: string) {
  if (status === "rented") {
    return <Badge variant="info" dot>Rented</Badge>;
  }
  return <Badge variant="neutral">Available</Badge>;
}

export const MachineRow = memo(function MachineRow({
  machine,
  isAdmin,
  onEdit,
  onDelete,
}: MachineRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <Link
            href={`/machines/${machine.id}`}
            className="label-sm text-[var(--color-ink)] hover:underline font-bold font-mono text-sm flex items-center gap-1.5"
          >
            {machine.machine_id}
          </Link>
          {machine.model && <span className="body-sm text-[var(--color-ink)] font-semibold">{machine.model}</span>}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-mute)] mt-0.5">
            {machine.serial_number && <span>Sr: {machine.serial_number}</span>}
            {machine.year_of_mfg && <span>• YUM: {machine.year_of_mfg}</span>}
            {machine.manufacturer && <span>• Mfg: {machine.manufacturer}</span>}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col">
          <span className="font-mono font-bold text-xs text-[var(--color-ink)]">{machine.hour_meter ?? 0} hrs</span>
          <span className="text-[11px] text-[var(--color-mute)]">HMR Reading</span>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col">
          <span className="font-bold text-xs text-[var(--color-ink)]">{machine.service_count ?? 0}</span>
          <span className="text-[11px] text-[var(--color-mute)]">Services Logged</span>
        </div>
      </TableCell>

      <TableCell>
        {machine.current_supervisor ? (
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[10px] font-bold text-[var(--color-ink)] border border-[var(--color-hairline)]">
              {machine.current_supervisor.full_name?.charAt(0).toUpperCase()}
            </div>
            <span className="body-sm text-[var(--color-ink)] font-medium">{machine.current_supervisor.full_name}</span>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-mute)] font-normal">-</span>
        )}
      </TableCell>

      <TableCell>
        {machine.current_operator ? (
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[10px] font-bold text-[var(--color-ink)] border border-[var(--color-hairline)]">
              {machine.current_operator.full_name?.charAt(0).toUpperCase()}
            </div>
            <span className="body-sm text-[var(--color-ink)] font-medium">{machine.current_operator.full_name}</span>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-mute)] font-normal">-</span>
        )}
      </TableCell>

      <TableCell>{getHealthBadge(machine.health_status)}</TableCell>

      <TableCell>{getRentalStatusBadge(machine.status)}</TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <TooltipWrapper content="View machine details" side="top">
            <Link href={`/machines/${machine.id}`}>
              <button
                aria-label="View machine details"
                className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] active:scale-[0.95] transition-colors cursor-pointer"
              >
                <AnimatedEye size={16} />
              </button>
            </Link>
          </TooltipWrapper>

          {isAdmin && (
            <>
              <TooltipWrapper content="Edit machine" side="top">
                <button
                  aria-label="Edit machine"
                  onClick={() => onEdit(machine)}
                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] active:scale-[0.95] transition-colors cursor-pointer"
                >
                  <AnimatedEdit size={16} />
                </button>
              </TooltipWrapper>

              <TooltipWrapper content="Delete machine" side="top">
                <button
                  aria-label="Delete machine"
                  onClick={() => onDelete(machine)}
                  className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-mute)] hover:bg-[rgba(238,0,0,0.1)] hover:text-[var(--color-error-deep)] active:scale-[0.95] transition-colors cursor-pointer"
                >
                  <AnimatedTrash size={16} />
                </button>
              </TooltipWrapper>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
