"use client";

import { useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface FormSubmitButtonProps {
  isReady: boolean;
  loading: boolean;
  label?: string;
  loadingLabel?: string;
  missingCount?: number;
  missingMessage?: string;
  missingFields?: string[];
  hideWhenIncomplete?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Reusable Form Submission Button
 * 1. Remains non-responsive / disabled while mandatory inputs are incomplete.
 * 2. Displays specific missing input boxes tailored to the active user role.
 * 3. Enforces an instant submission lock to prevent duplicate network calls.
 * 4. Animates icons cleanly on hover via data-hover-parent.
 */
export function FormSubmitButton({
  isReady,
  loading,
  label = "Save & Submit",
  loadingLabel = "Submitting Request...",
  missingCount,
  missingMessage,
  missingFields,
  hideWhenIncomplete = false,
  variant = "primary",
  size = "lg",
  fullWidth = true,
  className = "",
  onClick,
}: FormSubmitButtonProps) {
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (!loading) {
      isSubmittingRef.current = false;
    }
  }, [loading]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isReady || loading || isSubmittingRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    isSubmittingRef.current = true;
    onClick?.(e);
  };

  const missingDescription = useMemo(() => {
    if (missingMessage) return missingMessage;
    if (missingFields && missingFields.length > 0) {
      if (missingFields.length <= 3) {
        return `Please fill: ${missingFields.join(", ")}`;
      }
      return `Please fill ${missingFields.length} required fields: ${missingFields.slice(0, 3).join(", ")} +${missingFields.length - 3} more`;
    }
    if (missingCount && missingCount > 0) {
      return `Please complete all mandatory fields (${missingCount} remaining)`;
    }
    return "Please complete all mandatory fields to proceed";
  }, [missingMessage, missingFields, missingCount]);

  // If user configured to completely hide until mandatory inputs are satisfied
  if (hideWhenIncomplete && !isReady && !loading) {
    return (
      <div className="py-2 flex items-center justify-center">
        <div
          data-hover-parent
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-hairline)]/60 text-[11px] sm:text-xs text-[var(--color-mute)] font-medium"
        >
          <AlertCircle size={13} className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>{missingDescription}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-1 w-full">
      {/* Helper chip when incomplete and button is visible but non-responsive */}
      {!isReady && !loading && (
        <div
          data-hover-parent
          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 transition-colors"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <AlertCircle size={13} className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">{missingDescription}</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200 shrink-0">
            Incomplete
          </span>
        </div>
      )}

      {/* When ready, subtle success chip */}
      {isReady && !loading && (
        <div
          data-hover-parent
          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 transition-colors"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 size={13} className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">All mandatory fields completed. Ready to submit.</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-200 shrink-0">
            Ready
          </span>
        </div>
      )}

      <Button
        type="submit"
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        loading={loading}
        disabled={loading || !isReady}
        onClick={handleClick}
        className={`h-11 sm:h-11.5 font-semibold text-xs sm:text-sm shadow-xs transition-all duration-200 ${
          !isReady || loading
            ? "cursor-not-allowed opacity-50 pointer-events-none select-none"
            : "hover:scale-[1.005] active:scale-[0.99] cursor-pointer"
        } ${className}`}
      >
        {loading ? loadingLabel : label}
      </Button>
    </div>
  );
}
