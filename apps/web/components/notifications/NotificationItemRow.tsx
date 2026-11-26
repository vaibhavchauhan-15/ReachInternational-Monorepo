"use client";

import React, { memo } from "react";
import type { NotificationItem } from "@reachinternational/types";
import {
  formatNotificationTimeIST,
  getNotificationCategoryVisual,
} from "@reachinternational/utils";
import { resolveNotificationNav } from "@reachinternational/permissions";
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Wrench,
  FileText,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationItemRowProps {
  item: NotificationItem;
  userRole?: string;
  onItemClick: (item: NotificationItem, targetUrl?: string) => void;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "breakdown":
    case "maintenance":
      return <Wrench className="h-4 w-4 text-amber-500 shrink-0" />;
    case "shift_reminder":
      return <Clock className="h-4 w-4 text-sky-500 shrink-0" />;
    case "approvals":
    case "approval":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "security":
      return <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />;
    case "payroll":
    case "rfq":
      return <FileText className="h-4 w-4 text-indigo-500 shrink-0" />;
    case "system":
    default:
      return <Bell className="h-4 w-4 text-slate-500 shrink-0" />;
  }
}

export const NotificationItemRow = memo(function NotificationItemRow({
  item,
  userRole,
  onItemClick,
}: NotificationItemRowProps) {
  const isUnread = !item.read_at;
  const visual = getNotificationCategoryVisual(item.category);
  const timeFormatted = formatNotificationTimeIST(item.created_at);

  const navTarget = resolveNotificationNav(
    item.route_key,
    item.route_params,
    userRole
  );

  const handleClick = () => {
    onItemClick(item, navTarget.webHref);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex items-start gap-3 p-3.5 border-b border-[var(--color-hairline)] transition-colors cursor-pointer text-left select-none",
        isUnread
          ? "bg-sky-50/60 dark:bg-sky-950/20 hover:bg-sky-50 dark:hover:bg-sky-950/30"
          : "bg-transparent hover:bg-[var(--color-hairline-soft-surface)]"
      )}
      aria-label={`${item.title}, ${timeFormatted}. ${isUnread ? "Unread." : "Read."}`}
    >
      {/* Category Icon Container */}
      <div
        className={cn(
          "relative flex items-center justify-center h-8.5 w-8.5 rounded-lg shrink-0 mt-0.5 border border-[var(--color-hairline)]",
          isUnread
            ? "bg-[var(--color-canvas-elevated)] shadow-2xs"
            : "bg-[var(--color-canvas)] text-[var(--color-mute)]"
        )}
      >
        {getCategoryIcon(item.category)}
        {/* Unread Indicator Dot */}
        {isUnread && (
          <span
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-sky-500 ring-2 ring-[var(--color-canvas)]"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          {/* Category Pill */}
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase",
              isUnread
                ? "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300"
                : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)]"
            )}
          >
            {visual.label}
          </span>

          {/* High / Critical Priority Badge */}
          {item.priority === "critical" && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400">
              <AlertTriangle className="h-2.5 w-2.5" />
              Urgent
            </span>
          )}
          {item.priority === "high" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
              Important
            </span>
          )}

          {/* Timestamp */}
          <span className="ml-auto text-[11px] text-[var(--color-mute)] font-mono shrink-0">
            {timeFormatted}
          </span>
        </div>

        {/* Title */}
        <h4
          className={cn(
            "text-xs leading-snug truncate",
            isUnread
              ? "font-semibold text-[var(--color-ink)]"
              : "font-medium text-[var(--color-ink)] opacity-85"
          )}
        >
          {item.title}
        </h4>

        {/* Body (Zero-PII compliant text) */}
        {item.body ? (
          <p className="text-[11px] text-[var(--color-mute)] line-clamp-2 mt-0.5 leading-relaxed">
            {item.body}
          </p>
        ) : null}
      </div>

      {/* Deep-link chevron indicator if webHref exists */}
      {navTarget.webHref && (
        <div className="flex items-center self-center pl-1 text-[var(--color-mute)] group-hover:text-[var(--color-ink)] group-hover:translate-x-0.5 transition-all shrink-0">
          <ChevronRight className="h-4 w-4" />
        </div>
      )}
    </div>
  );
});
