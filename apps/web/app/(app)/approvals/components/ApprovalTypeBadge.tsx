import React from "react";
import { Badge } from "@/components/ui/Badge";
import {
  FileCheck,
  UserCheck,
  UserPlus,
  RefreshCw,
  UserX,
  Clock,
  HelpCircle,
} from "lucide-react";

export interface ApprovalTypeBadgeProps {
  typeKey: string;
  typeLabel?: string;
  className?: string;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string }
> = {
  document_verify: {
    label: "Document Verification",
    icon: FileCheck,
    color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  },
  profile_change: {
    label: "Profile Change",
    icon: UserCheck,
    color: "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  },
  registration: {
    label: "Registration",
    icon: UserPlus,
    color: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  },
  document_replace: {
    label: "Document Replacement",
    icon: RefreshCw,
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900",
  },
  account_deletion: {
    label: "Account Deletion",
    icon: UserX,
    color: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900",
  },
  shift_conflict: {
    label: "Shift Overlap",
    icon: Clock,
    color: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-900",
  },
};

export function ApprovalTypeBadge({ typeKey, typeLabel, className }: ApprovalTypeBadgeProps) {
  const config = TYPE_CONFIG[typeKey] || {
    label: typeLabel || typeKey,
    icon: HelpCircle,
    color: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700",
  };

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color} ${className || ""}`}
    >
      <Icon size={12} className="shrink-0" />
      <span>{typeLabel || config.label}</span>
    </span>
  );
}
