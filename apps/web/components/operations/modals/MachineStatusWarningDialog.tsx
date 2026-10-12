"use client";

import React, { useState } from "react";
import { Modal, Button, Badge } from "@/components/ui";
import { AlertTriangle, Wrench, CheckCircle2, ShieldAlert } from "lucide-react";
import { AnimatedLoader } from "@/components/ui/animated-icons";

export interface MachineStatusWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
  machine: {
    id: string;
    code: string;
    serialNumber?: string | null;
    model?: string | null;
    healthStatus?: string | null;
    status?: string | null;
    clientName?: string | null;
  } | null;
  onConfirmActiveAndAssign: (machineId: string) => Promise<void> | void;
}

export function MachineStatusWarningDialog({
  isOpen,
  onClose,
  machine,
  onConfirmActiveAndAssign,
}: MachineStatusWarningDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!machine) return null;

  const isBreakdown = machine.healthStatus === "breakdown";
  const isMaintenance =
    machine.healthStatus === "under_maintenance" || machine.status === "under_maintenance";
  const statusLabel = isBreakdown ? "Breakdown" : "Under Maintenance";

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirmActiveAndAssign(machine.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title=""
      size="md"
      className="max-w-md p-0 overflow-hidden"
    >
      <div className="p-5 sm:p-6 space-y-4">
        {/* Warning Icon & Header */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isBreakdown
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            {isBreakdown ? <AlertTriangle size={20} /> : <Wrench size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[var(--color-ink)] leading-snug">
              Machine Currently in {statusLabel}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Attention required before assigning personnel
            </p>
          </div>
        </div>

        {/* Machine Details Card */}
        <div className="p-3.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="font-mono text-xs font-semibold text-[var(--color-ink)]">
              {machine.code}
            </div>
            <Badge
              variant={isBreakdown ? "error" : "warning"}
              dot
              className="text-[10px] px-2 py-0.5"
            >
              {statusLabel}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground space-y-0.5">
            {(machine.serialNumber || machine.model) && (
              <div>
                <span className="text-[var(--color-ink)] font-medium">Model / S/N:</span>{" "}
                {[machine.model, machine.serialNumber].filter(Boolean).join(" · ")}
              </div>
            )}
            {machine.clientName && (
              <div>
                <span className="text-[var(--color-ink)] font-medium">Assigned Client:</span>{" "}
                {machine.clientName}
              </div>
            )}
          </div>
        </div>

        {/* Informative Explanation */}
        <div className="text-xs text-muted-foreground leading-relaxed space-y-1.5">
          <p>
            Operators cannot be rostered on equipment that is logged under breakdown or undergoing
            scheduled maintenance.
          </p>
          <p className="font-medium text-[var(--color-ink)]">
            To assign an operator, this machine will be marked as{" "}
            <span className="text-sky-600 dark:text-sky-400 font-semibold">Active</span>.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--color-hairline)]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            {isSubmitting ? (
              <>
                <AnimatedLoader className="w-3.5 h-3.5" />
                <span>Activating Machine...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Mark Active & Assign</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
