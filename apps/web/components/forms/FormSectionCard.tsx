"use client";

import { ReactNode } from "react";
import { Check } from "lucide-react";

export interface FormSectionCardProps {
  stepNumber: number | string;
  title: string;
  description?: string;
  isMandatory?: boolean;
  isCompleted?: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Reusable Form Section Container
 * Clearly displays section step number, title, Mandatory vs Optional status badge,
 * and dynamic Completion checkmark.
 */
export function FormSectionCard({
  stepNumber,
  title,
  description,
  isMandatory = true,
  isCompleted = false,
  headerAction,
  children,
  className = "",
}: FormSectionCardProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 p-3 sm:p-4 space-y-2.5 sm:space-y-3 transition-colors ${
        isCompleted ? "border-emerald-500/30 dark:border-emerald-500/20" : ""
      } ${className}`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between pb-2 border-b border-[var(--color-hairline)] gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold shrink-0 transition-colors ${
              isCompleted
                ? "bg-emerald-500 text-white"
                : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
            }`}
          >
            {isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : stepNumber}
          </span>
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

          {/* Completed Checkmark Badge */}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Check className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Completed</span>
            </span>
          )}

          {/* Mandatory vs Optional Badge */}
          {isMandatory ? (
            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              Mandatory
            </span>
          ) : (
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
