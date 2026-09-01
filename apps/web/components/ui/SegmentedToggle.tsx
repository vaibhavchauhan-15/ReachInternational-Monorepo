"use client";

import React, { useId } from "react";
import { motion } from "framer-motion";

export interface SegmentedToggleItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number | string;
  badge?: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

export type SegmentedToggleSize = "sm" | "md" | "lg";

export interface SegmentedToggleProps<T extends string = string> {
  items: SegmentedToggleItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Optional layoutId prefix for Framer Motion spring transition */
  layoutIdPrefix?: string;
  size?: SegmentedToggleSize;
  /** If true, forces full width on all viewports */
  fullWidth?: boolean;
  /** If true (default), automatically adapts to equal-width grid on mobile and inline-flex on desktop */
  responsive?: boolean;
  className?: string;
  itemClassName?: string;
  ariaLabel?: string;
}

const sizeStyles: Record<
  SegmentedToggleSize,
  {
    container: string;
    item: string;
    text: string;
    icon: number;
    badge: string;
  }
> = {
  sm: {
    container: "p-0.5 sm:p-1 rounded-lg sm:rounded-xl",
    item: "py-1 px-1.5 sm:py-1.5 sm:px-3 rounded-md sm:rounded-lg min-h-[34px] sm:min-h-[36px]",
    text: "text-[11px] sm:text-xs font-semibold tracking-tight sm:tracking-normal",
    icon: 13,
    badge: "text-[9px] sm:text-[10px] px-1 py-0.1",
  },
  md: {
    container: "p-1 sm:p-1.5 rounded-xl sm:rounded-2xl",
    item: "py-1.5 px-2 sm:py-2.5 sm:px-4 rounded-lg sm:rounded-xl min-h-[38px] sm:min-h-[42px]",
    text: "text-xs sm:text-sm font-semibold sm:font-bold tracking-tight sm:tracking-normal",
    icon: 14,
    badge: "text-[9px] sm:text-xs px-1 sm:px-1.5 py-0.2",
  },
  lg: {
    container: "p-1 sm:p-2 rounded-xl sm:rounded-2xl",
    item: "py-2 px-3 sm:py-3 sm:px-5 rounded-lg sm:rounded-xl min-h-[42px] sm:min-h-[46px]",
    text: "text-xs sm:text-base font-bold",
    icon: 16,
    badge: "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5",
  },
};

export function SegmentedToggle<T extends string = string>({
  items,
  value,
  onChange,
  layoutIdPrefix,
  size = "md",
  fullWidth = false,
  responsive = true,
  className = "",
  itemClassName = "",
  ariaLabel,
}: SegmentedToggleProps<T>) {
  const autoId = useId();
  const effectiveLayoutId = `${layoutIdPrefix || "segmented-toggle"}-${autoId}`;
  const config = sizeStyles[size];

  // Derive responsive grid columns for mobile based on item count (up to 4)
  const mobileColsClass =
    items.length === 2
      ? "grid-cols-2"
      : items.length === 3
      ? "grid-cols-3"
      : items.length === 4
      ? "grid-cols-4"
      : "grid-flow-col auto-cols-max overflow-x-auto";

  const containerLayoutClass = fullWidth
    ? `w-full grid ${mobileColsClass} sm:grid sm:${mobileColsClass}`
    : responsive
    ? `w-full grid ${mobileColsClass} sm:w-auto sm:inline-flex sm:items-center sm:gap-1.5`
    : `inline-flex items-center gap-1.5`;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel || "Segmented navigation toggle"}
      className={`relative self-start bg-neutral-100 dark:bg-neutral-900/90 border border-neutral-200/80 dark:border-neutral-800 shadow-inner select-none transition-colors ${config.container} ${containerLayoutClass} ${className}`}
    >
      {items.map((item) => {
        const isActive = item.id === value;

        return (
          <motion.button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            aria-disabled={item.disabled}
            type="button"
            disabled={item.disabled}
            title={item.title}
            whileTap={item.disabled ? undefined : { scale: 0.98 }}
            onClick={() => {
              if (!item.disabled && item.id !== value) {
                onChange(item.id);
              }
            }}
            className={`relative flex items-center justify-center transition-colors cursor-pointer text-center select-none ${
              config.item
            } ${config.text} ${
              isActive
                ? "text-sky-600 dark:text-sky-400 font-extrabold"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-medium hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
            } ${item.disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""} ${itemClassName}`}
          >
            {isActive && (
              <motion.div
                layoutId={effectiveLayoutId}
                className="absolute inset-0 bg-white dark:bg-neutral-800 shadow-xs border border-neutral-200/90 dark:border-neutral-700/80 rounded-lg sm:rounded-xl z-0 pointer-events-none"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}

            <span className="relative z-10 flex items-center justify-center gap-1 sm:gap-1.5 leading-none max-w-full px-1 sm:px-2 min-w-0">
              {item.icon && (
                <span className="shrink-0 flex items-center justify-center">
                  {item.icon}
                </span>
              )}

              <span className="truncate">{item.label}</span>

              {item.badge}

              {item.count !== undefined && (
                <span
                  className={`ml-1 rounded-full font-mono font-bold shrink-0 border ${
                    config.badge
                  } ${
                    isActive
                      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25"
                      : "bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-300/60 dark:border-neutral-700/60"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
