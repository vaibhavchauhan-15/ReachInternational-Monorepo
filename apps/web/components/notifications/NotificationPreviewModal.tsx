"use client";

import { Modal, Badge, Button } from "@/components/ui";
import {
  AnimatedMessageSquare,
  AnimatedMail,
  AnimatedPhone,
  AnimatedCheckCircle,
  AnimatedAlertTriangle,
  AnimatedWrench,
  AnimatedUser,
  AnimatedCalendarClock,
} from "@/components/ui/animated-icons";
import type { NotificationWithDetails } from "@/lib/types/database";

interface NotificationPreviewModalProps {
  open: boolean;
  onClose: () => void;
  notification: NotificationWithDetails | null;
}

function getChannelTheme(channel?: string) {
  const ch = (channel || "").toLowerCase();
  if (ch.includes("whatsapp")) {
    return {
      icon: AnimatedMessageSquare,
      bg: "bg-[#25D366]",
      text: "text-[#25D366]",
      title: "WhatsApp Dispatch Payload",
      badge: "WhatsApp Cloud API",
    };
  }
  if (ch.includes("sms")) {
    return {
      icon: AnimatedPhone,
      bg: "bg-indigo-600",
      text: "text-indigo-600",
      title: "SMS Dispatch Payload",
      badge: "Twilio SMS API",
    };
  }
  return {
    icon: AnimatedMail,
    bg: "bg-blue-600",
    text: "text-blue-600",
    title: "Email Dispatch Payload",
    badge: "SendGrid v3 API",
  };
}

export function NotificationPreviewModal({ open, onClose, notification }: NotificationPreviewModalProps) {
  if (!notification) return null;

  const machineCode = notification.machine?.machine_code || "MCH-XXXX";
  const machineName = notification.machine?.machine_name || "Industrial Machine";
  const customerName = notification.machine?.customer_name || "Valued Client";
  const recipientName = notification.recipient?.full_name || "Technician / Admin";
  const recipientContact = notification.recipient?.email || notification.recipient?.phone || notification.machine?.customer_mobile || "N/A";

  const isSummary =
    notification.alert_type === "daily_summary" || notification.alert_type === "engineer_summary";

  const summaryPayload = (notification.payload as { subject?: string; html?: string; text?: string } | null) ?? null;

  const alertTypeTitle =
    notification.alert_type === "daily_summary"
      ? "Daily Operations Summary"
      : notification.alert_type === "engineer_summary"
      ? "Engineer Daily Summary"
      : notification.alert_type === "today"
      ? "Service Due Today"
      : notification.alert_type === "tomorrow"
      ? "Service Due Tomorrow"
      : "Service Overdue Notice";

  const theme = getChannelTheme(notification.channel);
  const ChannelIcon = theme.icon;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={theme.title}
      description="Preview the automated message dispatch payload sent to the recipient."
      size="md"
    >
      <div className="flex flex-col gap-4 sm:gap-6">
        {/* Recipient & Channel Info Bar */}
        <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)]">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${theme.bg} text-white shrink-0 shadow-xs`}>
              <ChannelIcon size={20} />
            </div>
            <div className="min-w-0">
              <p className="label-sm text-[var(--color-ink)] font-bold truncate">{recipientName}</p>
              <p className="body-sm text-[var(--color-mute)] truncate">{recipientContact} • {theme.badge}</p>
            </div>
          </div>
          <Badge variant={notification.status === "sent" ? "success" : notification.status === "failed" ? "error" : "warning"}>
            {notification.status.toUpperCase()}
          </Badge>
        </div>

        {/* Realistic Chat / Message Payload Bubble */}
        <div className="rounded-xl bg-[#efeae2] dark:bg-[#111b21] p-3.5 sm:p-4 border border-black/10 dark:border-white/10 shadow-inner">
          <div className="flex justify-center mb-3">
            <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded bg-white/70 dark:bg-black/40 text-black/60 dark:text-white/60">
              {theme.badge} • {notification.alert_date}
            </span>
          </div>

          {isSummary && summaryPayload?.html ? (
            <div className="w-full mx-auto bg-white dark:bg-[#1e293b] text-slate-800 dark:text-slate-100 rounded-xl p-0 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <span className={`font-bold ${theme.text} text-xs sm:text-sm truncate`}>
                  {isSummary ? "📋 " : "🚨 REACH INTERNATIONAL Alert: "}{alertTypeTitle}
                </span>
              </div>
              <div className="text-[11px] leading-relaxed max-h-[420px] overflow-y-auto">
                {/* Rendered HTML email body — the exact content sent to the recipient */}
                <div
                  className="summary-email-preview"
                  dangerouslySetInnerHTML={{ __html: summaryPayload.html }}
                />
              </div>
              <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900/50">
                <span className="font-mono truncate max-w-[46%]">
                  ID: {notification.email_message_id || "msg_summary"}
                </span>
                <span className="flex items-center gap-1 text-[10px]">
                  {notification.sent_at
                    ? new Date(notification.sent_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Pending"}
                  {notification.status === "sent" && <AnimatedCheckCircle size={12} className="text-emerald-500" />}
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full sm:max-w-[92%] mx-auto bg-white dark:bg-[#202c33] text-slate-800 dark:text-slate-100 rounded-xl p-3.5 shadow-sm text-sm border-l-4 border-blue-500 relative">
              <div className={`font-bold ${theme.text} text-xs sm:text-sm mb-1 flex items-center justify-between`}>
                <span>🚨 REACH INTERNATIONAL Alert: {alertTypeTitle}</span>
              </div>

              <p className="mt-2 text-xs sm:text-sm leading-relaxed">
                Hello <span className="font-semibold">{recipientName}</span>,
              </p>

              <p className="mt-2 text-xs sm:text-sm leading-relaxed">
                This is an automated maintenance notification for machine <span className="font-mono font-bold">{machineCode}</span> ({machineName}).
              </p>

              <div className="my-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <AnimatedWrench size={14} className="text-slate-500 shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-200">Machine:</span> {machineCode} ({machineName})
                </div>
                <div className="flex items-center gap-2">
                  <AnimatedUser size={14} className="text-slate-500 shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-200">Client:</span> {customerName}
                </div>
                <div className="flex items-center gap-2">
                  <AnimatedCalendarClock size={14} className="text-slate-500 shrink-0" />
                  <span className="font-medium text-slate-700 dark:text-slate-200">Due Date:</span> {notification.alert_date}
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300">
                Please inspect the machine and record your service details on REACH INTERNATIONAL portal.
              </p>

              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                <span className="font-mono truncate max-w-[180px]">ID: {notification.email_message_id || notification.whatsapp_message_id || "msg_live_dispatch"}</span>
                <div className="flex items-center gap-1 text-[#53bdeb]">
                  <span>{notification.sent_at ? new Date(notification.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Pending"}</span>
                  {notification.status === "sent" && <AnimatedCheckCircle size={12} className="text-emerald-500" />}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Provider Response — delivery verification audit */}
        {notification.provider_response && (
          <div className="p-3 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-700 dark:text-slate-300 text-xs">
            <div className="flex items-center gap-2 font-semibold mb-1.5">
              <AnimatedCheckCircle size={16} className="shrink-0 text-emerald-500" /> Provider Delivery Response
            </div>
            <pre className="font-mono text-[10px] leading-relaxed break-all whitespace-pre-wrap max-h-40 overflow-y-auto">
              {JSON.stringify(notification.provider_response, null, 2)}
            </pre>
          </div>
        )}

        {/* Failure Callout if Failed */}
        {notification.status === "failed" && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs">
            <div className="flex items-center gap-2 font-semibold mb-1">
              <AnimatedAlertTriangle size={16} className="shrink-0" /> Dispatch Failure Reason
            </div>
            <p className="font-mono text-[11px] leading-relaxed break-all">{notification.error_message || "API Gateway returned non-200 status code during dispatch."}</p>
            <p className="mt-1 text-[10px] opacity-80">Retry count: {notification.retry_count}</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="secondary" onClick={onClose} className="w-full sm:w-auto">
            Close Preview
          </Button>
        </div>
      </div>
    </Modal>
  );
}
