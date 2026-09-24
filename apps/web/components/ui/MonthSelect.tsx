"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedCalendar,
  AnimatedChevronLeft,
  AnimatedChevronRight,
  AnimatedCheck,
} from "./animated-icons";
import { ChevronDown } from "lucide-react";

export interface MonthSelectProps {
  /** Formatted month string in YYYY-MM format, e.g. "2026-09" */
  value: string;
  /** Callback fired when a month is selected */
  onChange: (month: string) => void;
  /** Whether the selector is disabled or in pending transition */
  disabled?: boolean;
  /** Whether to show 1-click previous / next month navigation buttons */
  showQuickNav?: boolean;
  /** Min selectable year */
  minYear?: number;
  /** Max selectable year */
  maxYear?: number;
  /** Additional wrapper CSS classes */
  className?: string;
  /** Compact styling flag */
  compact?: boolean;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function MonthSelect({
  value,
  onChange,
  disabled = false,
  showQuickNav = true,
  minYear = 2024,
  maxYear = 2030,
  className = "",
  compact = false,
}: MonthSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse YYYY-MM
  const { year: currentYear, month: currentMonthIndex } = useMemo(() => {
    const parts = (value || "").split("-");
    const y = parts[0] ? parseInt(parts[0], 10) : new Date().getFullYear();
    const m = parts[1] ? parseInt(parts[1], 10) - 1 : new Date().getMonth();
    return {
      year: isNaN(y) ? new Date().getFullYear() : y,
      month: isNaN(m) || m < 0 || m > 11 ? new Date().getMonth() : m,
    };
  }, [value]);

  // Browse year in dropdown (independent of current selected value until clicked)
  const [prevCurrentYear, setPrevCurrentYear] = useState<number>(currentYear);
  const [browseYear, setBrowseYear] = useState<number>(currentYear);

  if (prevCurrentYear !== currentYear) {
    setPrevCurrentYear(currentYear);
    setBrowseYear(currentYear);
  }

  // Formatted display label (e.g. "September 2026")
  const displayLabel = useMemo(() => {
    const name = MONTH_NAMES[currentMonthIndex] || "Month";
    return `${name} ${currentYear}`;
  }, [currentMonthIndex, currentYear]);

  // Click outside to dismiss
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick, { passive: true });
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  // Escape key dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Quick navigation: Previous month
  const handlePrevMonth = useCallback(() => {
    if (disabled) return;
    let nextY = currentYear;
    let nextM = currentMonthIndex - 1;
    if (nextM < 0) {
      nextM = 11;
      nextY -= 1;
    }
    if (nextY >= minYear) {
      const formatted = `${nextY}-${String(nextM + 1).padStart(2, "0")}`;
      onChange(formatted);
    }
  }, [disabled, currentYear, currentMonthIndex, minYear, onChange]);

  // Quick navigation: Next month
  const handleNextMonth = useCallback(() => {
    if (disabled) return;
    let nextY = currentYear;
    let nextM = currentMonthIndex + 1;
    if (nextM > 11) {
      nextM = 0;
      nextY += 1;
    }
    if (nextY <= maxYear) {
      const formatted = `${nextY}-${String(nextM + 1).padStart(2, "0")}`;
      onChange(formatted);
    }
  }, [disabled, currentYear, currentMonthIndex, maxYear, onChange]);

  // Select a specific month
  const handleSelectMonth = useCallback(
    (monthIdx: number) => {
      const formatted = `${browseYear}-${String(monthIdx + 1).padStart(2, "0")}`;
      onChange(formatted);
      setIsOpen(false);
    },
    [browseYear, onChange]
  );

  // Jump to current real-world month
  const handleJumpToCurrentMonth = useCallback(() => {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    onChange(formatted);
    setBrowseYear(now.getFullYear());
    setIsOpen(false);
  }, [onChange]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center gap-1 ${isOpen ? "z-40" : "z-10"} ${className}`}
    >
      {/* Optional Quick Step: Previous Month Button */}
      {showQuickNav && (
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={disabled || (currentYear <= minYear && currentMonthIndex === 0)}
          className="h-11 sm:h-9 w-11 sm:w-9 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-all active:scale-95 cursor-pointer"
          title="Previous Month"
          aria-label="Previous Month"
        >
          <AnimatedChevronLeft size={14} className="text-[var(--color-mute)] hover:text-[var(--color-ink)]" />
        </button>
      )}

      {/* Main Trigger Dropdown Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={`inline-flex items-center justify-between gap-2 rounded-lg border text-xs font-semibold select-none shadow-xs transition-all cursor-pointer ${
          compact ? "h-8 px-2.5" : "h-11 sm:h-9 px-3"
        } ${
          isOpen
            ? "border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]/10 bg-[var(--color-canvas-elevated)] text-[var(--color-ink)]"
            : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2">
          <AnimatedCalendar size={14} className="text-[var(--color-mute)] shrink-0" />
          <span className="font-semibold tracking-tight whitespace-nowrap">{displayLabel}</span>
        </div>
        <ChevronDown
          size={13}
          className={`text-[var(--color-mute)] transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[var(--color-ink)]" : ""
          }`}
        />
      </button>

      {/* Optional Quick Step: Next Month Button */}
      {showQuickNav && (
        <button
          type="button"
          onClick={handleNextMonth}
          disabled={disabled || (currentYear >= maxYear && currentMonthIndex === 11)}
          className="h-11 sm:h-9 w-11 sm:w-9 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-xs transition-all active:scale-95 cursor-pointer"
          title="Next Month"
          aria-label="Next Month"
        >
          <AnimatedChevronRight size={14} className="text-[var(--color-mute)] hover:text-[var(--color-ink)]" />
        </button>
      )}

      {/* Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-1.5 z-50 w-[280px] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl backdrop-blur-md text-[var(--color-ink)] p-3 space-y-3"
          >
            {/* Header: Browse Year with Steppers */}
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-2.5">
              <button
                type="button"
                onClick={() => setBrowseYear((y) => Math.max(minYear, y - 1))}
                disabled={browseYear <= minYear}
                className="h-7 w-7 rounded-md border border-[var(--color-hairline)] hover:bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] flex items-center justify-center disabled:opacity-30 transition-colors cursor-pointer"
                title="Previous Year"
              >
                <AnimatedChevronLeft size={13} />
              </button>
              <span className="font-mono text-sm font-bold text-[var(--color-ink)] tracking-tight">
                {browseYear}
              </span>
              <button
                type="button"
                onClick={() => setBrowseYear((y) => Math.min(maxYear, y + 1))}
                disabled={browseYear >= maxYear}
                className="h-7 w-7 rounded-md border border-[var(--color-hairline)] hover:bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] flex items-center justify-center disabled:opacity-30 transition-colors cursor-pointer"
                title="Next Year"
              >
                <AnimatedChevronRight size={13} />
              </button>
            </div>

            {/* 12-Month Grid (3 cols x 4 rows) */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_SHORT.map((name, idx) => {
                const isSelected = browseYear === currentYear && idx === currentMonthIndex;
                const isThisCurrentMonth =
                  new Date().getFullYear() === browseYear && new Date().getMonth() === idx;

                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSelectMonth(idx)}
                    className={`relative py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center flex items-center justify-center gap-1 ${
                      isSelected
                        ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-xs"
                        : isThisCurrentMonth
                        ? "border border-sky-500/40 text-sky-600 dark:text-sky-400 hover:bg-[var(--color-canvas)]"
                        : "hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
                    }`}
                  >
                    <span>{name}</span>
                    {isSelected && <AnimatedCheck size={11} className="shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Footer: Jump to Current Month */}
            <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-mute)]">Quick period:</span>
              <button
                type="button"
                onClick={handleJumpToCurrentMonth}
                className="font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                Current Month
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
