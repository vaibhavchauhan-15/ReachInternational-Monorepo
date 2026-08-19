"use client";

import { memo } from "react";
import Link from "next/link";
import { AnimatedMapPin, AnimatedEye, AnimatedEdit, AnimatedTrash } from "@/components/ui/animated-icons";
import { TableRow, TableCell, Badge, TooltipWrapper } from "@/components/ui";
import type { MachineWithEngineer } from "@/lib/types/database";

interface MachineRowProps {
  machine: MachineWithEngineer;
  isAdmin: boolean;
  today: string;
  tomorrow: string;
  onEdit: (machine: MachineWithEngineer) => void;
  onDelete: (machine: MachineWithEngineer) => void;
}

function getStatusBadge(machine: MachineWithEngineer, today: string, tomorrow: string) {
  if (machine.status === "inactive") {
    return <Badge variant="neutral">Inactive</Badge>;
  }
  if (machine.status === "on_rent") {
    return <Badge variant="info" dot>On Rent</Badge>;
  }
  if (machine.status === "under_maintenance") {
    return <Badge variant="warning" dot>Under Maintenance</Badge>;
  }
  if (machine.next_service_due_date < today) {
    return <Badge variant="overdue" dot>Overdue ({machine.next_service_due_date})</Badge>;
  }
  if (machine.next_service_due_date === today) {
    return <Badge variant="today" dot>Due Today</Badge>;
  }
  if (machine.next_service_due_date === tomorrow) {
    return <Badge variant="tomorrow" dot>Due Tomorrow</Badge>;
  }
  return <Badge variant="default">Due {machine.next_service_due_date}</Badge>;
}

export const MachineRow = memo(function MachineRow({
  machine,
  isAdmin,
  today,
  tomorrow,
  onEdit,
  onDelete,
}: MachineRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <Link
            href={`/machines/${machine.id}`}
            className="label-sm text-[var(--color-ink)] hover:underline font-bold font-mono flex items-center gap-1.5"
          >
            {machine.machine_code}
          </Link>
          <span className="body-sm text-[var(--color-body)] font-medium">{machine.machine_name}</span>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-mute)] mt-0.5">
            {machine.manufacturer && <span>{machine.manufacturer}</span>}
            {machine.model && <span>• Model: {machine.model}</span>}
            {machine.serial_number && <span>• Sr: {machine.serial_number}</span>}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col">
          <span className="body-md text-[var(--color-ink)]">{machine.customer_name}</span>
          <span className="body-sm text-[var(--color-mute)]">{machine.customer_mobile}</span>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1 text-[var(--color-body)] body-sm">
          <AnimatedMapPin size={14} className="text-[var(--color-mute)] flex-shrink-0" />
          {machine.city}, {machine.state}
        </div>
      </TableCell>

      <TableCell>
        {machine.engineer ? (
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[10px] font-medium text-[var(--color-ink)]">
              {machine.engineer.full_name?.charAt(0).toUpperCase()}
            </div>
            <span className="body-sm text-[var(--color-ink)]">{machine.engineer.full_name}</span>
          </div>
        ) : (
          <span className="badge-base bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]">
            Unassigned
          </span>
        )}
      </TableCell>

      <TableCell>{getStatusBadge(machine, today, tomorrow)}</TableCell>

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

              {machine.status === "active" && (
                <TooltipWrapper content="Deactivate machine" side="top">
                  <button
                    aria-label="Deactivate machine"
                    onClick={() => onDelete(machine)}
                    className="p-1.5 rounded-[var(--radius-sm)] text-[var(--color-mute)] hover:bg-[rgba(238,0,0,0.1)] hover:text-[var(--color-error-deep)] active:scale-[0.95] transition-colors cursor-pointer"
                  >
                    <AnimatedTrash size={16} />
                  </button>
                </TooltipWrapper>
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
