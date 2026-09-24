"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AnimatedCounter } from "@/components/ui/Motion";
import type { LucideIcon } from "lucide-react";

export interface KPICardProps {
  label: string;
  value: number | string;
  icon: LucideIcon | React.ComponentType<{ className?: string; size?: number | string; ref?: any }> | React.ReactNode;
  variant?: "default" | "warning" | "error" | "success" | "info";
  href?: string;
  subtitle?: string;
  trend?: {
    value: string | number;
    isUp: boolean;
  };
  className?: string;
}

const variantStyles = {
  default: {
    bg: "bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-canvas)]",
    border: "border-[var(--color-hairline)] hover:border-[var(--color-ink)]/25",
    accent: "from-slate-400/40 via-slate-400/20 to-transparent dark:from-slate-500/40 dark:via-slate-500/20",
    iconBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
    valueText: "text-[var(--color-ink)]",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-500/10 via-amber-500/[0.04] to-transparent dark:from-amber-950/25 dark:via-amber-950/10",
    border: "border-amber-500/25 hover:border-amber-500/45",
    accent: "from-amber-500 via-amber-400/60 to-transparent",
    iconBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25",
    valueText: "text-amber-700 dark:text-amber-300",
  },
  error: {
    bg: "bg-gradient-to-br from-rose-500/10 via-rose-500/[0.04] to-transparent dark:from-rose-950/25 dark:via-rose-950/10",
    border: "border-rose-500/25 hover:border-rose-500/45",
    accent: "from-rose-500 via-rose-400/60 to-transparent",
    iconBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25",
    valueText: "text-rose-700 dark:text-rose-300",
  },
  success: {
    bg: "bg-gradient-to-br from-emerald-500/10 via-emerald-500/[0.04] to-transparent dark:from-emerald-950/25 dark:via-emerald-950/10",
    border: "border-emerald-500/25 hover:border-emerald-500/45",
    accent: "from-emerald-500 via-emerald-400/60 to-transparent",
    iconBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25",
    valueText: "text-emerald-700 dark:text-emerald-300",
  },
  info: {
    bg: "bg-gradient-to-br from-sky-500/10 via-sky-500/[0.04] to-transparent dark:from-sky-950/25 dark:via-sky-950/10",
    border: "border-sky-500/25 hover:border-sky-500/45",
    accent: "from-sky-500 via-sky-400/60 to-transparent",
    iconBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25",
    valueText: "text-sky-700 dark:text-sky-300",
  },
};

export function KPICard({
  label,
  value,
  icon: Icon,
  variant = "default",
  href,
  subtitle,
  trend,
  className = "",
}: KPICardProps) {
  const iconRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
  const styles = variantStyles[variant];

  const handleMouseEnter = () => {
    iconRef.current?.startAnimation?.();
  };

  const handleMouseLeave = () => {
    iconRef.current?.stopAnimation?.();
  };

  const content = (
    <Card
      padding="none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden p-3.5 sm:p-4 md:p-5 flex flex-col justify-between h-full rounded-[var(--radius-md)] border transition-all duration-200 group ${
        href ? "hover:border-[var(--color-ink)]/30 hover:shadow-sm active:scale-[0.99] cursor-pointer" : ""
      } ${styles.bg} ${styles.border} ${className}`}
    >
      {/* Top Hairline Gradient Accent Bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${styles.accent} rounded-t-[var(--radius-md)]`}
        aria-hidden="true"
      />

      {/* Label and Icon Row — Optimized for Mobile & Desktop */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-2">
        <span className="flex-1 min-w-0 text-[11px] sm:text-xs md:text-sm font-medium text-[var(--color-mute)] leading-tight sm:leading-snug break-words line-clamp-2 min-h-[28px] sm:min-h-0">
          {label}
        </span>
        <div className={`w-8 h-8 flex items-center justify-center rounded-full shrink-0 ${styles.iconBg}`}>
          {React.isValidElement(Icon) ? (
            React.cloneElement(Icon as React.ReactElement<any>, {
              ref: iconRef,
              size: 16,
              className: "w-4 h-4 shrink-0",
            })
          ) : typeof Icon === "function" || (typeof Icon === "object" && Icon !== null) ? (
            // @ts-expect-error Icon can be component type
            <Icon ref={iconRef} size={16} className="w-4 h-4 shrink-0" />
          ) : null}
        </div>
      </div>

      {/* Value & Metadata */}
      <div className="mt-2.5 sm:mt-3">
        <div className={`text-xl sm:text-2xl md:text-3xl font-bold tracking-tight tabular-nums ${styles.valueText}`}>
          {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
        </div>

        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] md:text-xs text-[var(--color-mute)]">
            {trend && (
              <span className={trend.isUp ? "text-emerald-600 dark:text-emerald-400 font-semibold shrink-0" : "text-rose-600 dark:text-rose-400 font-semibold shrink-0"}>
                {trend.isUp ? "↑" : "↓"} {trend.value}
              </span>
            )}
            {subtitle && <span className="truncate">{subtitle}</span>}
          </div>
        )}
      </div>
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
        {content}
      </Link>
    );
  }

  return content;
}
