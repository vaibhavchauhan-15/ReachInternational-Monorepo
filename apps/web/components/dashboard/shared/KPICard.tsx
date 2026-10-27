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
  onClick?: () => void;
  active?: boolean;
  subtitle?: string;
  trend?: {
    value: string | number;
    isUp: boolean;
  };
  className?: string;
}

const variantStyles = {
  default: {
    bg: "bg-[var(--color-canvas-elevated)]",
    border: "border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30",
    iconBg: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
    valueText: "text-[var(--color-ink)]",
  },
  warning: {
    bg: "bg-gradient-to-br from-amber-500/[0.07] via-amber-500/[0.02] to-[var(--color-canvas-elevated)] dark:from-amber-950/25 dark:via-amber-950/10 dark:to-[var(--color-canvas-elevated)]",
    border: "border-amber-500/25 hover:border-amber-500/45",
    iconBg: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25",
    valueText: "text-amber-700 dark:text-amber-400",
  },
  error: {
    bg: "bg-gradient-to-br from-rose-500/[0.07] via-rose-500/[0.02] to-[var(--color-canvas-elevated)] dark:from-rose-950/25 dark:via-rose-950/10 dark:to-[var(--color-canvas-elevated)]",
    border: "border-rose-500/25 hover:border-rose-500/45",
    iconBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25",
    valueText: "text-rose-700 dark:text-rose-400",
  },
  success: {
    bg: "bg-gradient-to-br from-emerald-500/[0.07] via-emerald-500/[0.02] to-[var(--color-canvas-elevated)] dark:from-emerald-950/25 dark:via-emerald-950/10 dark:to-[var(--color-canvas-elevated)]",
    border: "border-emerald-500/25 hover:border-emerald-500/45",
    iconBg: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25",
    valueText: "text-emerald-700 dark:text-emerald-400",
  },
  info: {
    bg: "bg-gradient-to-br from-sky-500/[0.07] via-sky-500/[0.02] to-[var(--color-canvas-elevated)] dark:from-sky-950/25 dark:via-sky-950/10 dark:to-[var(--color-canvas-elevated)]",
    border: "border-sky-500/25 hover:border-sky-500/45",
    iconBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25",
    valueText: "text-sky-700 dark:text-sky-400",
  },
};

export function KPICard({
  label,
  value,
  icon: Icon,
  variant = "default",
  href,
  onClick,
  active,
  subtitle,
  trend,
  className = "",
}: KPICardProps) {
  const iconRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);
  const styles = variantStyles[variant] || variantStyles.default;

  const handleMouseEnter = () => {
    iconRef.current?.startAnimation?.();
  };

  const handleMouseLeave = () => {
    iconRef.current?.stopAnimation?.();
  };

  const isInteractive = Boolean(href || onClick);

  const content = (
    <Card
      padding="none"
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden p-3.5 sm:p-4 md:p-5 flex flex-col justify-between h-full rounded-[var(--radius-md)] border transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-link)] ${
        isInteractive
          ? "hover:border-[var(--color-ink)]/30 hover:shadow-whisper hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer motion-reduce:hover:translate-y-0"
          : ""
      } ${active ? "ring-2 ring-[var(--color-link)] border-[var(--color-link)]" : styles.border} ${styles.bg} ${className}`}
    >
      {/* Label and Icon Row — Optimized for Mobile, Tablet & Desktop */}
      <div className="flex items-start justify-between gap-2">
        <span className="flex-1 min-w-0 text-xs sm:text-xs md:text-sm font-medium text-[var(--color-mute)] leading-tight sm:leading-snug break-words line-clamp-2 min-h-[28px] sm:min-h-0">
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

      {/* Value, Trend & Subtitle */}
      <div className="mt-2.5 sm:mt-3">
        <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
          <div className={`text-xl sm:text-2xl md:text-3xl font-bold tracking-tight tabular-nums ${styles.valueText}`}>
            {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
          </div>
          {trend && (
            <span
              className={`inline-flex items-center text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded ${
                trend.isUp
                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                  : "text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20"
              }`}
            >
              {trend.isUp ? "↑" : "↓"} {trend.value}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] sm:text-xs text-[var(--color-mute)] mt-1 line-clamp-1 leading-normal">
            {subtitle}
          </p>
        )}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-link)] rounded-[var(--radius-md)]"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {content}
      </Link>
    );
  }

  return content;
}
