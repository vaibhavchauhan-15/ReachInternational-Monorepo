"use client";

import { memo } from "react";
import { AnimatedMessageSquare, AnimatedMail, AnimatedPhone, AnimatedEye, AnimatedRotateCw } from "@/components/ui/animated-icons";
import { TableRow, TableCell, Badge, Button } from "@/components/ui";
import type { NotificationWithDetails } from "@/lib/types/database";

interface NotificationRowProps {
  notification: NotificationWithDetails;
  isAdmin: boolean;
  resendingId: string | null;
  onPreview: (notification: NotificationWithDetails) => void;
  onResend: (id: string) => void;
}

function getAlertTypeBadge(type: string) {
  switch (type) {
    case "today":
      return <Badge variant="today" dot>Due Today</Badge>;
    case "tomorrow":
      return <Badge variant="tomorrow" dot>Due Tomorrow</Badge>;
    case "overdue":
      return <Badge variant="overdue" dot>Overdue Alert</Badge>;
    case "new_machine":
      return <Badge variant="default" dot>Machine Added</Badge>;
    case "machine_updated":
      return <Badge variant="default" dot>Machine Updated</Badge>;
    case "machine_deleted":
      return <Badge variant="error" dot>Machine Deleted</Badge>;
    case "excel_import":
      return <Badge variant="success" dot>Excel Import</Badge>;
    case "system_error":
      return <Badge variant="error" dot>System Error</Badge>;
    case "reminder_failed":
      return <Badge variant="error" dot>Reminder Failed</Badge>;
    case "daily_summary":
      return <Badge variant="default" dot>Daily Summary</Badge>;
    default:
      return <Badge variant="default">{type.replace("_", " ")}</Badge>;
  }
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

export const NotificationRow = memo(function NotificationRow({
  notification: n,
  isAdmin,
  resendingId,
  onPreview,
  onResend,
}: NotificationRowProps) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="body-md font-medium text-[var(--color-ink)]">{n.alert_date}</span>
          <div>{getAlertTypeBadge(n.alert_type)}</div>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col">
          <span className="label-sm text-[var(--color-ink)] font-semibold">
            {n.machine?.machine_code || "N/A"}
          </span>
          <span className="body-sm text-[var(--color-body)]">{n.machine?.machine_name || "—"}</span>
          {n.machine?.customer_name && (
            <span className="caption-sm text-[var(--color-mute)]">Client: {n.machine.customer_name}</span>
          )}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col">
          <span className="body-md text-[var(--color-ink)] font-medium">
            {n.recipient?.full_name || "System Recipient"}
          </span>
          <span className="body-sm text-[var(--color-mute)]">
            {n.recipient?.phone || n.recipient?.email || "No contact"}
          </span>
          {n.recipient?.role && (
            <span className="caption-sm text-[var(--color-mute)] capitalize">
              Role: {n.recipient.role.replace("_", " ")}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col">
          <span className="body-sm text-[var(--color-ink)] font-mono flex items-center gap-1">
            {n.channel === "email" ? (
              <AnimatedMail size={14} className="text-blue-600" />
            ) : n.channel === "sms" ? (
              <AnimatedPhone size={14} className="text-indigo-600" />
            ) : (
              <AnimatedMessageSquare size={14} className="text-[#25D366]" />
            )}
            {n.channel}
          </span>
          {(n.email_message_id || n.whatsapp_message_id) && (
            <span className="caption-sm font-mono text-[var(--color-mute)] truncate max-w-[150px]">
              {n.email_message_id || n.whatsapp_message_id}
            </span>
          )}
          {n.sent_at && (
            <span className="caption-sm text-[var(--color-mute)]">
              {new Date(n.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-col gap-1">
          {getStatusBadge(n.status)}
          {n.error_message && (
            <span
              className="caption-sm text-[var(--color-error-deep)] max-w-[180px] truncate"
              title={n.error_message}
            >
              {n.error_message}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            title="Preview Notification"
            onClick={() => onPreview(n)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-sm)] body-sm text-[var(--color-body)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] transition-colors border border-[var(--color-hairline)]"
          >
            <AnimatedEye size={14} /> Preview
          </button>

          {isAdmin && n.status === "failed" && (
            <Button
              variant="primary-sm"
              size="sm"
              title="Resend notification"
              onClick={() => onResend(n.id)}
              loading={resendingId === n.id}
              icon={<AnimatedRotateCw size={14} className={resendingId === n.id ? "animate-spin" : ""} />}
            >
              Resend
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
