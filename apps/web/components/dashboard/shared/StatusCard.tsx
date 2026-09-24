"use client";

import React, { useRef } from "react";
import { Card } from "@/components/ui/Card";
import { CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export interface StatusCardProps {
  title: string;
  status: "success" | "pending" | "warning";
  label: string;
  description?: string;
  extra?: React.ReactNode;
  className?: string;
}

const statusConfig = {
  success: {
    bg: "bg-gradient-to-br from-emerald-500/10 via-emerald-500/[0.04] to-transparent dark:from-emerald-950/25 dark:via-emerald-950/10",
    border: "border-emerald-500/25 hover:border-emerald-500/40",
    accent: "from-emerald-500 via-emerald-400/60 to-transparent",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
    iconBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  pending: {
    bg: "bg-gradient-to-br from-amber-500/10 via-amber-500/[0.04] to-transparent dark:from-amber-950/25 dark:via-amber-950/10",
    border: "border-amber-500/25 hover:border-amber-500/40",
    accent: "from-amber-500 via-amber-400/60 to-transparent",
    text: "text-amber-700 dark:text-amber-300",
    icon: Clock,
    iconBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  warning: {
    bg: "bg-gradient-to-br from-rose-500/10 via-rose-500/[0.04] to-transparent dark:from-rose-950/25 dark:via-rose-950/10",
    border: "border-rose-500/25 hover:border-rose-500/40",
    accent: "from-rose-500 via-rose-400/60 to-transparent",
    text: "text-rose-700 dark:text-rose-300",
    icon: AlertTriangle,
    iconBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
};

export function StatusCard({
  title,
  status,
  label,
  description,
  extra,
  className = "",
}: StatusCardProps) {
  const iconRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
  const config = statusConfig[status];
  const Icon = config.icon;

  const handleMouseEnter = () => {
    iconRef.current?.startAnimation?.();
  };

  const handleMouseLeave = () => {
    iconRef.current?.stopAnimation?.();
  };

  return (
    <Card
      padding="none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden p-3.5 sm:p-4 md:p-5 flex flex-col justify-between h-full rounded-[var(--radius-md)] border transition-all duration-200 ${config.bg} ${config.border} ${className}`}
    >
      {/* Top Hairline Gradient Accent Bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${config.accent} rounded-t-[var(--radius-md)]`}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1.5 min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider">
            {title}
          </p>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 flex items-center justify-center rounded-full shrink-0 ${config.iconBg}`}>
              {React.isValidElement(Icon) ? (
                React.cloneElement(Icon as React.ReactElement<any>, {
                  ref: iconRef,
                  size: 16,
                  className: `w-4 h-4 shrink-0 ${config.iconColor}`,
                })
              ) : typeof Icon === "function" || (typeof Icon === "object" && Icon !== null) ? (
                (() => {
                  const IconComp = Icon as React.ComponentType<any>;
                  return <IconComp ref={iconRef} size={16} className={`w-4 h-4 shrink-0 ${config.iconColor}`} />;
                })()
              ) : null}
            </div>
            <span className={`text-sm sm:text-base md:text-lg font-bold ${config.text} leading-tight line-clamp-2 break-words`}>
              {label}
            </span>
          </div>
          {description && (
            <p className="text-[11px] sm:text-xs text-[var(--color-mute)] leading-relaxed mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>
        {extra && <div className="shrink-0">{extra}</div>}
      </div>
    </Card>
  );
}
