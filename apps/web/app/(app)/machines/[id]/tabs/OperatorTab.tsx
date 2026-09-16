"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  Clock,
  Wrench,
} from "lucide-react";
import { AnimatedEdit } from "@/components/ui/animated-icons";
import { Card } from "@/components/ui";
import type { MachineWithEngineer } from "@/lib/types/database";
import type { User } from "@reachinternational/types";

type PersonnelPick = Pick<User, "id" | "full_name" | "phone" | "email" | "shift_time">;

interface OperatorTabProps {
  machine: MachineWithEngineer;
  allowEdit: boolean;
}

export default function OperatorTab({ machine, allowEdit }: OperatorTabProps) {
  const assignedOperators = useMemo((): PersonnelPick[] => {
    if (Array.isArray(machine.operators) && machine.operators.length > 0) {
      return machine.operators;
    }
    if (machine.current_operator) {
      return [machine.current_operator];
    }
    return [];
  }, [machine.operators, machine.current_operator]);

  return (
    <Card padding="md" className="card-hover-system sm:p-6 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
            Assigned Operators ({assignedOperators.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-mute)] bg-[var(--color-hairline-soft-surface)] px-2 py-0.5 rounded-md border border-[var(--color-hairline)]">
            <Clock size={11} className="text-amber-500" />
            Hour Logging & Operations
          </span>
          {allowEdit && (
            <Link
              href={`/machines/${machine.id}/edit`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-link)] hover:underline"
            >
              <AnimatedEdit size={12} />
              <span>Manage Staff</span>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-4">
        {assignedOperators.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-mute)] italic bg-[var(--color-hairline-soft-surface)]/30 rounded-xl border border-dashed border-[var(--color-hairline)] p-4">
            <Wrench className="h-8 w-8 text-[var(--color-mute)] mx-auto mb-2 opacity-50" />
            <p className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">No Operators Assigned</p>
            <p className="text-xs text-[var(--color-mute)] mt-1 max-w-sm mx-auto">
              Assign operators to enable 24h shift logging for this machine.
            </p>
            {allowEdit && (
              <div className="mt-4">
                <Link
                  href={`/machines/${machine.id}/edit`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-link)] hover:underline"
                >
                  <AnimatedEdit size={12} />
                  <span>Assign Operators</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {assignedOperators.map((op, idx) => (
              <div
                key={op.id || idx}
                className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/50 border border-[var(--color-hairline)] text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--color-ink)] truncate">
                      {op.full_name}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Shift {idx + 1}
                    </span>
                  </div>
                  {op.shift_time && (
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                      <Clock size={10} />
                      <span>{op.shift_time}</span>
                    </div>
                  )}
                  {op.email && (
                    <div className="flex items-center gap-1 text-[10px] text-[var(--color-mute)] mt-0.5">
                      <Mail size={10} />
                      <span className="truncate">{op.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {op.phone && (
                    <a
                      href={`tel:${op.phone}`}
                      title={`Call ${op.full_name}`}
                      className="p-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-amber-600 hover:border-amber-500/40 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1.5 flex items-center justify-center"
                    >
                      <Phone size={14} />
                    </a>
                  )}
                  {op.email && (
                    <a
                      href={`mailto:${op.email}`}
                      title={`Email ${op.full_name}`}
                      className="p-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-amber-600 hover:border-amber-500/40 transition-colors min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:p-1.5 flex items-center justify-center"
                    >
                      <Mail size={14} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
