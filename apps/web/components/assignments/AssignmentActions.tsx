"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { AnimatedAlertCircle } from "@/components/ui/animated-icons";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AssignmentActionsProps {
  onCancel: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
  showDirtyNotice?: boolean;
  disabled?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  errorMessage?: string | null;
  className?: string;
}

export function AssignmentActions({
  onCancel,
  onSubmit,
  isSaving = false,
  isDirty = true,
  showDirtyNotice = false,
  disabled = false,
  submitLabel = "Save Assignments",
  cancelLabel = "Cancel",
  errorMessage,
  className,
}: AssignmentActionsProps) {
  const isButtonDisabled = disabled || isSaving;

  return (
    <div className={cn("space-y-3 pt-3 border-t border-[var(--color-hairline)]", className)}>
      {/* Inline Error Notice */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Unsaved Changes Indicator (hidden unless showDirtyNotice is explicitly true) */}
        {showDirtyNotice && isDirty ? (
          <div className="text-xs text-[var(--color-mute)]">
            <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs">
              <AnimatedAlertCircle size={14} className="shrink-0" />
              <span>Unsaved assignment modifications</span>
            </span>
          </div>
        ) : null}

        {/* Buttons (responsive grid on mobile, flex on desktop) */}
        <div
          className={cn(
            "grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-2",
            showDirtyNotice && isDirty ? "sm:ml-auto" : "sm:w-full sm:justify-end"
          )}
        >
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSaving}
            className="w-full sm:w-auto h-11 min-h-[44px] px-4 text-xs sm:text-sm font-medium justify-center cursor-pointer"
          >
            {cancelLabel}
          </Button>

          <Button
            type="button"
            variant="primary"
            loading={isSaving}
            disabled={isButtonDisabled}
            onClick={onSubmit}
            className={cn(
              "w-full sm:w-auto h-11 min-h-[44px] px-5 text-xs sm:text-sm font-semibold justify-center transition-all",
              isButtonDisabled
                ? "cursor-not-allowed opacity-50 hover:cursor-not-allowed"
                : "cursor-pointer"
            )}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
