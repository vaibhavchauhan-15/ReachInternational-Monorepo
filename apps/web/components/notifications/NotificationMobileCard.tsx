"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import {
  AnimatedMessageSquare,
  AnimatedMail,
  AnimatedPhone,
  AnimatedEye,
  AnimatedRefresh,
  AnimatedCpu,
  AnimatedUser,
  AnimatedAlertTriangle,
  AnimatedChevronRight,
} from "@/components/ui/animated-icons";
import { Badge, CopyCell } from "@/components/ui";
import type { NotificationWithDetails } from "@/lib/types/database";

interface NotificationMobileCardProps {
  notification: NotificationWithDetails;
  isAdmin: boolean;
  resendingId: string | null;
  onPreview: (notification: NotificationWithDetails) => void;
  onResend: (id: string) => void;
}

function getChannelIcon(channel?: string) {
  const ch = (channel || "").toLowerCase();
  if (ch.includes("whatsapp")) {
    return <AnimatedMessageSquare size={14} className="text-[#25D366]" />;
  }
  if (ch.includes("sms")) {
    return <AnimatedPhone size={14} className="text-indigo-500" />;
  }
  return <AnimatedMail size={14} className="text-blue-500" />;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "sent":
      return <Badge variant="success" dot>Sent</Badge>;
    case "failed":
      return <Badge variant="error" dot>Failed</Badge>;
    case "pending":
      return <Badge variant="warning" dot>Pending</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

function getAlertTypeBadge(type: string) {
  switch (type) {
    case "today":
    case "service_reminder":
      return <Badge variant="today" dot>Service Due</Badge>;
    case "tomorrow":
      return <Badge variant="tomorrow" dot>Tomorrow</Badge>;
    case "overdue":
    case "overdue_alert":
      return <Badge variant="overdue" dot>Overdue</Badge>;
    default:
      return (
        <Badge variant="default" dot>
          {type.replace("_", " ")}
        </Badge>
      );
  }
}

export const NotificationMobileCard = memo(function NotificationMobileCard({
  notification: n,
  isAdmin,
  resendingId,
  onPreview,
  onResend,
}: NotificationMobileCardProps) {
  const recipientName =
    n.recipient?.full_name || n.machine?.customer_name || "System Recipient";
  const contactInfo =
    n.recipient?.email || n.recipient?.phone || n.machine?.customer_mobile || "";
  const isResending = resendingId === n.id;

  const formattedDate = new Date(n.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onPreview(n)}
      className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs hover:border-[var(--color-ink)]/20 transition-all flex flex-col gap-3 relative overflow-hidden group cursor-pointer"
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] font-bold text-xs border border-[var(--color-hairline)]">
            {recipientName.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[var(--color-ink)] truncate">
              {recipientName}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-mute)]">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--color-hairline-soft-surface)]">
                {getChannelIcon(n.channel)}
                {n.channel || "Email"}
              </span>
              {contactInfo && <CopyCell value={contactInfo} />}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {getStatusBadge(n.status)}
          <span className="text-[10px] font-mono text-[var(--color-mute)]">
            {formattedDate}
          </span>
        </div>
      </div>

      {/* Center Details Box */}
      <div className="p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[var(--color-ink)] font-mono font-bold">
            <AnimatedCpu size={14} className="text-blue-500" />
            <span>{n.machine?.machine_code || "System Event"}</span>
          </div>
          {getAlertTypeBadge(n.alert_type)}
        </div>

        {n.machine?.machine_name && (
          <p className="text-[11px] text-[var(--color-body)] font-medium truncate">
            {n.machine.machine_name}
          </p>
        )}

        {n.machine?.customer_name && (
          <div className="flex items-center gap-1 text-[11px] text-[var(--color-mute)]">
            <AnimatedUser size={12} />
            <span className="truncate">{n.machine.customer_name}</span>
          </div>
        )}
      </div>

      {/* Failure Callout Banner if Failed */}
      {n.status === "failed" && n.error_message && (
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-[11px] flex items-start gap-1.5">
          <AnimatedAlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span className="line-clamp-2">{n.error_message}</span>
        </div>
      )}

      {/* Action Footer */}
      <div
        className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)]/50 mt-1"
        onClick={(e) => e.stopPropagation()}
      >
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={() => onPreview(n)}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/40"
        >
          <AnimatedEye size={14} />
          <span>Preview Payload</span>
        </motion.button>

        {isAdmin && n.status === "failed" ? (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            disabled={isResending}
            onClick={() => onResend(n.id)}
            className="flex items-center gap-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 px-2.5 py-1 rounded-md shadow-xs transition-colors"
          >
            <AnimatedRefresh size={14} className={isResending ? "animate-spin" : ""} />
            <span>{isResending ? "Resending..." : "Retry"}</span>
          </motion.button>
        ) : (
          <div className="flex items-center text-[11px] text-[var(--color-mute)] font-medium">
            <span>Details</span>
            <AnimatedChevronRight size={14} />
          </div>
        )}
      </div>
    </motion.div>
  );
});
