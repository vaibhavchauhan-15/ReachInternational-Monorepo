import React from "react";
import Link from "next/link";
import type { DashboardAlert } from "@reachinternational/types";
import { AlertCircle, AlertTriangle, Info, ArrowUpRight, CheckCircle2 } from "lucide-react";

interface AlertWidgetProps {
  alerts: DashboardAlert[];
  title?: string;
  showCount?: boolean;
  className?: string;
}

const severityConfig = {
  critical: {
    bg: "bg-gradient-to-r from-rose-500/10 via-rose-500/[0.04] to-transparent dark:from-rose-950/30 dark:via-rose-950/15",
    border: "border-rose-500/25 hover:border-rose-500/40",
    text: "text-rose-900 dark:text-rose-200",
    descText: "text-rose-700/80 dark:text-rose-300/80",
    icon: AlertCircle,
    iconBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  warning: {
    bg: "bg-gradient-to-r from-amber-500/10 via-amber-500/[0.04] to-transparent dark:from-amber-950/30 dark:via-amber-950/15",
    border: "border-amber-500/25 hover:border-amber-500/40",
    text: "text-amber-900 dark:text-amber-200",
    descText: "text-amber-700/80 dark:text-amber-300/80",
    icon: AlertTriangle,
    iconBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  success: {
    bg: "bg-gradient-to-r from-emerald-500/10 via-emerald-500/[0.04] to-transparent dark:from-emerald-950/30 dark:via-emerald-950/15",
    border: "border-emerald-500/25 hover:border-emerald-500/40",
    text: "text-emerald-900 dark:text-emerald-200",
    descText: "text-emerald-700/80 dark:text-emerald-300/80",
    icon: CheckCircle2,
    iconBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  info: {
    bg: "bg-gradient-to-r from-sky-500/10 via-sky-500/[0.04] to-transparent dark:from-sky-950/30 dark:via-sky-950/15",
    border: "border-sky-500/25 hover:border-sky-500/40",
    text: "text-sky-900 dark:text-sky-200",
    descText: "text-sky-700/80 dark:text-sky-300/80",
    icon: Info,
    iconBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
};

export function AlertWidget({
  alerts,
  title = "Alert",
  showCount = false,
  className = "",
}: AlertWidgetProps) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {title && (
        <h2 className="text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider">
          {title}{showCount ? ` (${alerts.length})` : ""}
        </h2>
      )}
      <div className="space-y-2">
        {alerts.map((alert) => {
          const config = severityConfig[alert.severity] || severityConfig.info;
          const Icon = config.icon;

          const content = (
            <div
              key={alert.id}
              className={`flex items-start justify-between gap-2.5 p-3 sm:p-3.5 md:p-4 rounded-[var(--radius-md)] border transition-all duration-200 ${config.bg} ${config.border} ${
                alert.actionUrl ? "hover:border-[var(--color-ink)]/30 hover:shadow-sm cursor-pointer" : ""
              }`}
            >
              <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                <div className={`p-1.5 rounded-lg shrink-0 ${config.iconBg}`}>
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${config.iconColor}`} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h4 className={`text-xs sm:text-sm font-semibold leading-tight ${config.text}`}>
                    {alert.title}
                  </h4>
                  {alert.description && (
                    <p className={`text-[11px] sm:text-xs mt-1 line-clamp-2 ${config.descText}`}>
                      {alert.description}
                    </p>
                  )}
                </div>
              </div>

              {alert.actionUrl && (
                <div className="shrink-0 flex items-center text-xs font-medium text-[var(--color-ink)] gap-1 pt-1">
                  <span className="hidden sm:inline">View</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );

          if (alert.actionUrl) {
            return (
              <Link key={alert.id} href={alert.actionUrl} className="block">
                {content}
              </Link>
            );
          }

          return <div key={alert.id}>{content}</div>;
        })}
      </div>
    </div>
  );
}
