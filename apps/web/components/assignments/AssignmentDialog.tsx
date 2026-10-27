"use client";

import React, { ReactNode } from "react";
import { Modal, type ModalProps } from "@/components/ui/Modal";
import { ShieldCheck, Truck, User, Building2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TargetEntityDetails {
  type: "machine" | "operator" | "supervisor" | "client";
  title: string;
  code?: string | null;
  subtitle?: string | null;
  statusBadge?: string | null;
  inheritedNotice?: {
    clientName?: string | null;
    supervisorName?: string | null;
    message?: string;
  } | null;
}

export interface AssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  targetEntity?: TargetEntityDetails;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function AssignmentDialog({
  open,
  onClose,
  title,
  description,
  targetEntity,
  children,
  footer,
  size = "lg",
  className,
}: AssignmentDialogProps) {
  const getEntityIcon = (type?: string) => {
    switch (type) {
      case "machine":
        return <Truck className="h-4 w-4 text-[var(--color-primary)]" />;
      case "supervisor":
        return <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "operator":
        return <User className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
      case "client":
        return <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      default:
        return null;
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={size}
      className={cn("p-0 overflow-hidden", className)}
      title={
        <div className="flex items-center gap-2 flex-wrap min-w-0 pr-6">
          <span className="font-bold text-sm sm:text-base text-[var(--color-ink)]">
            {title}
          </span>
          {targetEntity?.code && (
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)] font-semibold">
              {targetEntity.code}
            </span>
          )}
        </div>
      }
      description={description}
    >
      <div className="flex flex-col space-y-4 p-4 sm:p-5">
        {/* Target Entity Banner if details provided */}
        {targetEntity && (
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] shrink-0">
                {getEntityIcon(targetEntity.type)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[var(--color-ink)] truncate">
                    {targetEntity.title}
                  </span>
                  {targetEntity.statusBadge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {targetEntity.statusBadge}
                    </span>
                  )}
                </div>
                {targetEntity.subtitle && (
                  <p className="text-[11px] text-[var(--color-mute)] truncate">
                    {targetEntity.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Inherited Client Supervisor Callout if applicable */}
        {targetEntity?.inheritedNotice && (
          <div className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50 dark:bg-sky-950/40 p-3 text-xs text-sky-900 dark:text-sky-300 space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>Supervised via Client Scope</span>
            </p>
            <p className="text-[11px] leading-relaxed text-sky-800 dark:text-sky-300">
              {targetEntity.inheritedNotice.message ||
                `This equipment belongs to ${targetEntity.inheritedNotice.clientName || "the assigned client"}. Supervisors are managed at the client level and automatically inherit fleet operational oversight.`}
            </p>
          </div>
        )}

        {/* Main Content Area */}
        <div className="space-y-4">{children}</div>

        {/* Modal Footer */}
        {footer}
      </div>
    </Modal>
  );
}
