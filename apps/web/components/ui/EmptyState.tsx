import React, { ReactNode } from "react";
import { Search, SlidersHorizontal, Wifi, ShieldCheck } from "@/components/icons";
import { AnimatedInbox } from "./animated-icons";
import { Button } from "./Button";

export type EmptyStateVariant = "empty" | "no-results" | "filtered" | "offline" | "unauthorized";

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
  className?: string;
}

const DEFAULT_TITLES: Record<EmptyStateVariant, string> = {
  empty: "No Records Found",
  "no-results": "No Results Found",
  filtered: "No Matches Found",
  offline: "You're Offline",
  unauthorized: "Access Denied",
};

export function EmptyState({
  variant = "empty",
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
  className = "",
}: EmptyStateProps) {
  const displayTitle = title || DEFAULT_TITLES[variant] || "No Data Available";

  const renderIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case "no-results":
        return <Search className="h-6 w-6 text-[var(--color-mute)]" aria-hidden="true" />;
      case "filtered":
        return <SlidersHorizontal className="h-6 w-6 text-[var(--color-mute)]" aria-hidden="true" />;
      case "offline":
        return <Wifi className="h-6 w-6 text-[var(--color-warning-deep,#b45309)] dark:text-amber-400" aria-hidden="true" />;
      case "unauthorized":
        return <ShieldCheck className="h-6 w-6 text-rose-600 dark:text-rose-400" aria-hidden="true" />;
      case "empty":
      default:
        return <AnimatedInbox size={24} />;
    }
  };

  return (
    <div
      role="status"
      className={`group interactive-parent flex flex-col items-center justify-center gap-3 text-center ${
        compact ? "py-8" : "py-16"
      } ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-hairline-soft-surface,#f5f5f5)] dark:bg-[#1f1f1f] text-[var(--color-mute,#737373)] transition-transform duration-200">
        {renderIcon()}
      </div>

      <h3 className="heading-md text-[var(--color-ink,#171717)] dark:text-[#fafafa]">
        {displayTitle}
      </h3>

      {description && (
        <p className="body-md text-[var(--color-body,#404040)] dark:text-[#a3a3a3] max-w-sm">
          {description}
        </p>
      )}

      {(action || actionLabel || secondaryActionLabel) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {actionLabel && onAction && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAction}
              className="border-[var(--color-hairline,#ebebeb)] dark:border-[#262626]"
            >
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}