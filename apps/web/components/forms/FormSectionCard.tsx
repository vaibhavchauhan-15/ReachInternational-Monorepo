"use client";

import { ReactNode } from "react";
import { Check } from "lucide-react";

export interface FormSectionCardProps {
  stepNumber: number | string;
  title: string;
  description?: string;
  icon?: ReactNode;
  isMandatory?: boolean;
  isCompleted?: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Reusable Form Section Container
 * Displays section step number, optional icon, title, completion checkmark,
 * and card-level hover micro-interaction via data-hover-parent.
 */
export function FormSectionCard({
  stepNumber,
  title,
  description,
  icon,
  isMandatory = true,
  isCompleted = false,
  headerAction,
  children,
  className = "",
}: FormSectionCardProps) {
  return (
    <div
      data-hover-parent
      className={`rounded-xl border bg-[var(--color-canvas)]/60 p-3 sm:p-4 space-y-2.5 sm:space-y-3 transition-all duration-200 ${
        isCompleted
          ? "border-emerald-500 dark:border-emerald-400/80 shadow-[0_0_0_1px_rgba(16,185,129,0.35)] dark:shadow-[0_0_0_1px_rgba(52,211,153,0.3)]"
          : "border-[var(--color-hairline)]"
      } ${className}`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)] gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Step Number Indicator — Always preserves step number */}
          <span
            className={`flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold shrink-0 transition-colors ${
              isCompleted
                ? "bg-emerald-500 text-white"
                : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20"
            }`}
          >
            {stepNumber}
          </span>

          {/* Section Icon if provided */}
          {icon && (
            <span className="shrink-0 flex items-center justify-center">
              {icon}
            </span>
          )}

          <div className="min-w-0">
            <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] truncate">
              {title}
            </h3>
            {description && (
              <p className="text-[10px] sm:text-[11px] text-[var(--color-mute)] truncate">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right Badges & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {headerAction}

          {/* Completed Green Tick Badge (icon only, no redundant text) */}
          {isCompleted && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0"
              title="Section Completed"
              aria-label="Completed"
            >
              <Check className="w-3 h-3 stroke-[2.5]" />
            </span>
          )}

          {/* Optional Badge only when explicitly non-mandatory */}
          {!isMandatory && (
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-semibold bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/20">
              Optional
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div>{children}</div>
    </div>
  );
}
