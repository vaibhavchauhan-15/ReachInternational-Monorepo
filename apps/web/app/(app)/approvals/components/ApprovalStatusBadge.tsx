import React from "react";
import type { ApprovalStatus } from "@reachinternational/types";
import { CheckCircle2, XCircle, Clock, Ban, AlertCircle } from "lucide-react";

export interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  cancelled: {
    label: "Cancelled",
    icon: Ban,
    color: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
  },
  expired: {
    label: "Expired",
    icon: AlertCircle,
    color: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  },
};

export function ApprovalStatusBadge({ status, className }: ApprovalStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color} ${className || ""}`}
    >
      <Icon size={12} className="shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}
