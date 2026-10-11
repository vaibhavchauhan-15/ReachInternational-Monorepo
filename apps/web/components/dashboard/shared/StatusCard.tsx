"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CheckCircle2, Clock, AlertTriangle, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface StatusCardProps {
  title: string;
  status?: "success" | "pending" | "warning" | "info" | "default";
  label?: string;
  description?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string; size?: number | string; ref?: any }> | React.ReactNode;
  extra?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  monoValue?: boolean;
  children?: React.ReactNode;
}

const statusConfig = {
  default: {
    bg: "bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-canvas)]",
    border: "border-[var(--color-hairline)] hover:border-[var(--color-ink)]/25",
    text: "text-[var(--color-ink)]",
    icon: Clock,
    iconBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
    iconColor: "text-slate-600 dark:text-slate-400",
  },
  info: {
    bg: "bg-gradient-to-br from-sky-500/10 via-sky-500/[0.04] to-transparent dark:from-sky-950/25 dark:via-sky-950/10",
    border: "border-sky-500/25 hover:border-sky-500/40",
    text: "text-sky-700 dark:text-sky-300",
    icon: Info,
    iconBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  success: {
    bg: "bg-gradient-to-br from-emerald-500/10 via-emerald-500/[0.04] to-transparent dark:from-emerald-950/25 dark:via-emerald-950/10",
    border: "border-emerald-500/25 hover:border-emerald-500/40",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: CheckCircle2,
    iconBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  pending: {
    bg: "bg-gradient-to-br from-amber-500/10 via-amber-500/[0.04] to-transparent dark:from-amber-950/25 dark:via-amber-950/10",
    border: "border-amber-500/25 hover:border-amber-500/40",
    text: "text-amber-700 dark:text-amber-300",
    icon: Clock,
    iconBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  warning: {
    bg: "bg-gradient-to-br from-rose-500/10 via-rose-500/[0.04] to-transparent dark:from-rose-950/25 dark:via-rose-950/10",
    border: "border-rose-500/25 hover:border-rose-500/40",
    text: "text-rose-700 dark:text-rose-300",
    icon: AlertTriangle,
    iconBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
};

export function StatusCard({
  title,
  status = "default",
  label,
  description,
  icon: customIcon,
  extra,
  href,
  onClick,
  className = "",
  monoValue = false,
  children,
}: StatusCardProps) {
  const iconRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
  const config = statusConfig[status] || statusConfig.default;
  const Icon = customIcon || config.icon;
  const isInteractive = Boolean(href || onClick);

  const handleMouseEnter = () => {
    iconRef.current?.startAnimation?.();
  };

  const handleMouseLeave = () => {
    iconRef.current?.stopAnimation?.();
  };

  const renderIcon = () => {
    if (React.isValidElement(Icon)) {
      return React.cloneElement(Icon as React.ReactElement<any>, {
        ref: iconRef,
        size: 16,
        className: `w-4 h-4 shrink-0 ${config.iconColor}`,
      });
    }
    if (typeof Icon === "function" || (typeof Icon === "object" && Icon !== null)) {
      const IconComp = Icon as React.ComponentType<any>;
      return <IconComp ref={iconRef} size={16} className={`w-4 h-4 shrink-0 ${config.iconColor}`} />;
    }
    return null;
  };

  const cardContent = (
    <Card
      padding="none"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden p-3.5 sm:p-4 md:p-5 flex flex-col justify-between h-full rounded-[var(--radius-md)] border transition-all duration-200 ${
        isInteractive ? "hover:border-[var(--color-ink)]/30 hover:shadow-2xs active:scale-[0.99] cursor-pointer" : ""
      } ${config.bg} ${config.border} ${className}`}
    >
      {children && !label ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--color-hairline)]">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 flex items-center justify-center rounded-lg shrink-0 ${config.iconBg}`}>
                {renderIcon()}
              </div>
              <span className="text-xs font-semibold text-[var(--color-ink)] uppercase tracking-wider">
                {title}
              </span>
            </div>
            {extra && <div className="shrink-0">{extra}</div>}
          </div>
          <div className="pt-0.5">{children}</div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2.5">
          <div className="space-y-1.5 min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs font-semibold text-[var(--color-mute)] uppercase tracking-wider">
              {title}
            </p>
            {label && (
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full shrink-0 ${config.iconBg}`}>
                  {renderIcon()}
                </div>
                <span
                  className={`text-sm sm:text-base md:text-lg font-bold ${config.text} ${
                    monoValue ? "font-mono" : ""
                  } leading-tight line-clamp-2 break-words`}
                >
                  {label}
                </span>
              </div>
            )}
            {description && (
              <p className="text-[11px] sm:text-xs text-[var(--color-mute)] leading-relaxed mt-1 line-clamp-2">
                {description}
              </p>
            )}
            {children && <div className="mt-2.5 pt-2 border-t border-[var(--color-hairline)]/60">{children}</div>}
          </div>
          {extra && <div className="shrink-0">{extra}</div>}
        </div>
      )}
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
