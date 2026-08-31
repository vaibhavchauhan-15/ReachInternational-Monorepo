"use client";

import React from "react";
import {
  AnimatedInfo,
  AnimatedCheckCircle2,
  AnimatedAlertTriangle,
  AnimatedXCircle,
  AnimatedX,
} from "./animated-icons";

export type AlertVariant = "info" | "success" | "warning" | "error" | "neutral";

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function Alert({
  variant = "info",
  title,
  children,
  icon,
  onDismiss,
  action,
  className = "",
}: AlertProps) {
  const variantConfig = {
    info: {
      icon: <AnimatedInfo size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />,
      container:
        "border-sky-500/25 bg-sky-500/[0.06] text-sky-950 dark:text-sky-100",
      titleColor: "text-sky-900 dark:text-sky-200",
    },
    success: {
      icon: (
        <AnimatedCheckCircle2
          size={16}
          className="text-emerald-600 dark:text-emerald-400 shrink-0"
        />
      ),
      container:
        "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-950 dark:text-emerald-100",
      titleColor: "text-emerald-900 dark:text-emerald-200",
    },
    warning: {
      icon: (
        <AnimatedAlertTriangle
          size={16}
          className="text-amber-600 dark:text-amber-400 shrink-0"
        />
      ),
      container:
        "border-amber-500/25 bg-amber-500/[0.06] text-amber-950 dark:text-amber-100",
      titleColor: "text-amber-900 dark:text-amber-200",
    },
    error: {
      icon: (
        <AnimatedXCircle
          size={16}
          className="text-rose-600 dark:text-rose-400 shrink-0"
        />
      ),
      container:
        "border-rose-500/25 bg-rose-500/[0.06] text-rose-950 dark:text-rose-100",
      titleColor: "text-rose-900 dark:text-rose-200",
    },
    neutral: {
      icon: <AnimatedInfo size={16} className="text-[var(--color-ink)] shrink-0" />,
      container:
        "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)]",
      titleColor: "text-[var(--color-ink)]",
    },
  };

  const config = variantConfig[variant];

  return (
    <div
      role="alert"
      className={`relative w-full rounded-xl border p-3 sm:p-3.5 flex items-start gap-3 text-xs leading-relaxed shadow-2xs transition-all ${config.container} ${className}`}
    >
      <div className="pt-0.5">{icon || config.icon}</div>

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={`font-semibold mb-0.5 text-xs sm:text-[13px] ${config.titleColor}`}>
            {title}
          </h4>
        )}
        <div className="opacity-90">{children}</div>
        {action && <div className="mt-2 flex items-center gap-2">{action}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity cursor-pointer shrink-0"
          aria-label="Dismiss alert"
        >
          <AnimatedX size={14} />
        </button>
      )}
    </div>
  );
}
