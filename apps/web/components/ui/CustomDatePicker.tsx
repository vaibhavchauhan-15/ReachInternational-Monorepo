"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Lock,
} from "lucide-react";
import { formatDate } from "@reachinternational/utils";
import { useDynamicDropdownPosition } from "@/lib/hooks/useDynamicDropdownPosition";
import { cn } from "@/lib/utils";

export interface CustomDatePickerProps {
  value: string; // Format: "YYYY-MM-DD"
  onChange: (dateStr: string) => void;
  maxDaysOld?: number; // Number of days in past allowed (default: 7)
  allowFutureDays?: number; // Number of days in future allowed (default: 0, set to 1 for shift end dates)
  allowAnyPast?: boolean; // When true, does not restrict past dates (useful for reports)
  allowAnyFuture?: boolean; // When true, does not restrict future dates
  showWindowBadge?: boolean; // Controls visibility of "Allowed: 7d window" badge
  showRelativeBadge?: boolean; // Controls visibility of relative badges like "Today", "Locked (>7d)"
  mode?: "input" | "inline"; // Preserved for backwards compatibility
  label?: React.ReactNode;
  labelClassName?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  helperText?: string;
  align?: "left" | "right" | "center";
  hideIcon?: boolean;
  showIcon?: boolean;
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

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Helper to format date object to YYYY-MM-DD
function formatToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Helper to parse YYYY-MM-DD string into local midnight Date
function parseYMD(dateStr?: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split("T")[0].split("-").map(Number);
  if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

// Tooltip classification for calendar cells
export type DayTooltipType = "today" | "tomorrow" | "yesterday" | "past" | "future" | "locked";

export interface DayTooltipInfo {
  type: DayTooltipType;
  badge: string;
  label: string;
  reason: string;
  isLocked: boolean;
}

export function getDayTooltip(
  cell: {
    date: Date;
    dateStr: string;
    dayNumber: number;
    diffDays: number;
    isSelectable: boolean;
    isToday: boolean;
  },
  maxDaysOld: number,
  allowFutureDays: number,
  allowAnyPast: boolean,
  allowAnyFuture: boolean
): DayTooltipInfo {
  const isLocked = !cell.isSelectable;
  const diffDays = cell.diffDays;

  if (isLocked) {
    if (diffDays < 0) {
      return {
        type: "locked",
        badge: "Locked",
        label: "Locked (Future)",
        reason: allowFutureDays === 1 ? "Only tomorrow is selectable" : "Future date locked",
        isLocked: true,
      };
    }
    return {
      type: "locked",
      badge: "Locked",
      label: "Locked",
      reason: `${diffDays} days ago (> ${maxDaysOld}d limit)`,
      isLocked: true,
    };
  }

  if (cell.isToday || diffDays === 0) {
    return {
      type: "today",
      badge: "Today",
      label: "Today",
      reason: "Current active date",
      isLocked: false,
    };
  }

  if (diffDays === -1) {
    return {
      type: "tomorrow",
      badge: "Tomorrow",
      label: "Tomorrow",
      reason: "Next day plan (+1d)",
      isLocked: false,
    };
  }

  if (diffDays === 1) {
    return {
      type: "yesterday",
      badge: "Yesterday",
      label: "Yesterday",
      reason: "1 day ago (-1d)",
      isLocked: false,
    };
  }

  if (diffDays >= 2 && diffDays <= 7) {
    return {
      type: "past",
      badge: `${diffDays}d ago`,
      label: `${diffDays} days ago`,
      reason: `${diffDays} days ago (-${diffDays}d)`,
      isLocked: false,
    };
  }

  if (diffDays > 7 && (allowAnyPast || diffDays <= maxDaysOld)) {
    return {
      type: "past",
      badge: `${diffDays}d ago`,
      label: `${diffDays} days ago`,
      reason: `${diffDays} days ago (-${diffDays}d)`,
      isLocked: false,
    };
  }

  if (diffDays < -1) {
    const ahead = Math.abs(diffDays);
    return {
      type: "future",
      badge: `+${ahead}d`,
      label: `${ahead} days ahead`,
      reason: `+${ahead} days plan`,
      isLocked: false,
    };
  }

  return {
    type: "past",
    badge: "Date",
    label: cell.dateStr,
    reason: "",
    isLocked: false,
  };
}

export function CustomDatePicker({
  value,
  onChange,
  maxDaysOld = 7,
  allowFutureDays = 0,
  allowAnyPast = false,
  allowAnyFuture = false,
  showWindowBadge = false,
  showRelativeBadge = true,
  label,
  labelClassName,
  required = false,
  placeholder = "Select date...",
  className = "",
  disabled = false,
  helperText,
  align,
  hideIcon = false,
  showIcon = false,
}: CustomDatePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Today reference at midnight
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const todayStr = useMemo(() => formatToYMD(today), [today]);

  // Minimum allowed date at midnight (today - maxDaysOld, or unbound when allowAnyPast)
  const minDate = useMemo(() => {
    if (allowAnyPast) return new Date(1990, 0, 1);
    const d = new Date(today);
    d.setDate(d.getDate() - maxDaysOld);
    return d;
  }, [today, maxDaysOld, allowAnyPast]);

  // Maximum allowed future date at midnight (today + allowFutureDays, or unbound when allowAnyFuture)
  const maxFutureDate = useMemo(() => {
    if (allowAnyFuture) return new Date(2050, 11, 31);
    const d = new Date(today);
    d.setDate(d.getDate() + allowFutureDays);
    return d;
  }, [today, allowFutureDays, allowAnyFuture]);

  // Month currently in view on calendar
  const [viewDate, setViewDate] = useState<Date>(() => {
    const initial = value ? parseYMD(value) : today;
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  // Sync view month when value changes externally (pure render-time state adjustment without cascading effect)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value) {
      const parsed = parseYMD(value);
      setViewDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  }

  const { mounted, position, isPositioned, portalTarget, updatePosition } = useDynamicDropdownPosition({
    isOpen: isCalendarOpen,
    triggerRef,
    popoverRef,
    onClose: () => setIsCalendarOpen(false),
    minWidth: 280,
    maxHeightCap: 400,
    matchTriggerWidth: false,
    align,
  });

  // Close calendar popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCalendarOpen) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCalendarOpen]);

  // Relative status of currently selected date
  const relativeBadge = useMemo(() => {
    if (!showRelativeBadge || !value) return null;
    const target = parseYMD(value);
    const diffTime = today.getTime() - target.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === -1) {
      return {
        label: "Tomorrow",
        colorClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
      };
    }
    if (diffDays === 0) {
      return {
        label: "Today",
        colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      };
    }
    if (diffDays === 1) {
      return {
        label: "Yesterday",
        colorClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20",
      };
    }
    if (allowAnyPast) {
      return null;
    }
    // Future side of the window (e.g. allowFutureDays={1} => tomorrow is the only future date)
    if (diffDays < -1) {
      const aheadDays = Math.abs(diffDays);
      if (!allowAnyFuture && aheadDays <= allowFutureDays) {
        return {
          label: `+${aheadDays}d`,
          colorClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
        };
      }
      return {
        label: "Locked",
        colorClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      };
    }
    if (diffDays > 1 && diffDays <= maxDaysOld) {
      return {
        label: `${diffDays}d ago`,
        colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      };
    }
    if (diffDays > maxDaysOld) {
      return {
        label: "Locked",
        colorClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      };
    }
    return {
      label: "Future",
      colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
    };
  }, [value, today, maxDaysOld, allowFutureDays, allowAnyFuture, showRelativeBadge, allowAnyPast]);

  // Month navigation handlers
  const canGoPrevMonth = useMemo(() => {
    if (allowAnyPast) return true;
    const prevMonthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth(), 0);
    return prevMonthEnd >= minDate;
  }, [viewDate, minDate, allowAnyPast]);

  const canGoNextMonth = useMemo(() => {
    if (allowAnyFuture) return true;
    const nextMonthStart = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    return nextMonthStart <= maxFutureDate;
  }, [viewDate, maxFutureDate, allowAnyFuture]);

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    if (!canGoNextMonth) return;
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Generate calendar days for the current viewDate
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isSelectable: boolean;
      isSelected: boolean;
      isToday: boolean;
      diffDays: number;
    }> = [];

    // 1. Previous month trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      const dStr = formatToYMD(d);
      const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      const isSelectable = (allowAnyFuture || diffDays >= -allowFutureDays) && (allowAnyPast || diffDays <= maxDaysOld);

      days.push({
        date: d,
        dateStr: dStr,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isSelectable,
        isSelected: dStr === value,
        isToday: dStr === todayStr,
        diffDays,
      });
    }

    // 2. Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dStr = formatToYMD(d);
      const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      const isSelectable = (allowAnyFuture || diffDays >= -allowFutureDays) && (allowAnyPast || diffDays <= maxDaysOld);

      days.push({
        date: d,
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: true,
        isSelectable,
        isSelected: dStr === value,
        isToday: dStr === todayStr,
        diffDays,
      });
    }

    // 3. Next month leading days (to fill 35 or 42 grid slots)
    const totalSlots = days.length <= 35 ? 35 : 42;
    const remainingSlots = totalSlots - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const d = new Date(year, month + 1, i);
      const dStr = formatToYMD(d);
      const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      const isSelectable = (allowAnyFuture || diffDays >= -allowFutureDays) && (allowAnyPast || diffDays <= maxDaysOld);

      days.push({
        date: d,
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isSelectable,
        isSelected: dStr === value,
        isToday: dStr === todayStr,
        diffDays,
      });
    }

    return days;
  }, [viewDate, value, today, todayStr, maxDaysOld, allowFutureDays, allowAnyPast, allowAnyFuture]);

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsCalendarOpen(false);
    setHoveredDate(null);
  };

  const handleOpenToggle = () => {
    if (disabled) return;
    const nextState = !isCalendarOpen;
    if (nextState) {
      updatePosition();
    } else {
      setHoveredDate(null);
    }
    setIsCalendarOpen(nextState);
  };

  const hoveredCell = useMemo(() => {
    if (!hoveredDate) return null;
    return calendarDays.find((c) => c.dateStr === hoveredDate) || null;
  }, [hoveredDate, calendarDays]);

  const hoveredTooltip = useMemo(() => {
    if (!hoveredCell) return null;
    return getDayTooltip(
      hoveredCell,
      maxDaysOld,
      allowFutureDays,
      allowAnyPast,
      allowAnyFuture
    );
  }, [hoveredCell, maxDaysOld, allowFutureDays, allowAnyPast, allowAnyFuture]);

  const formattedDisplayValue = useMemo(() => {
    if (!value) return placeholder;
    try {
      const parsed = parseYMD(value);
      return formatDate(parsed);
    } catch {
      return value;
    }
  }, [value, placeholder]);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* ========================================================================= */}
      {/* COMPACT INPUT DROPDOWN TRIGGER                                            */}
      {/* ========================================================================= */}
      <div>
        {label && (
          <div className="flex items-center justify-between mb-1">
            <label
              className={cn(
                "text-[13.5px] sm:text-xs font-semibold text-[var(--color-ink)] inline-flex items-center gap-1.5 min-w-0 leading-none",
                labelClassName
              )}
            >
              {!hideIcon && showIcon && typeof label === "string" && (
                <Calendar className="h-3.5 w-3.5 text-[var(--color-mute)] shrink-0" />
              )}
              {typeof label === "string" ? (
                <span className="truncate leading-none">{label}</span>
              ) : (
                label
              )}
              {required && (
                <span className="text-rose-500 font-semibold ml-0.5 shrink-0 select-none leading-none">
                  *
                </span>
              )}
            </label>
            {showWindowBadge && (
              <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold tracking-tight shrink-0">
                {allowAnyPast && allowAnyFuture
                  ? "Any date"
                  : `${allowAnyPast ? "Any past" : `${maxDaysOld}d back`} · ${allowAnyFuture ? "Any future" : `${allowFutureDays}d ahead`}`}
              </span>
            )}
          </div>
        )}

        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={handleOpenToggle}
          className={`w-full px-3.5 py-2.5 rounded-xl border bg-[var(--color-canvas)] text-sm font-semibold text-[var(--color-ink)] flex items-center justify-between motion-press cursor-pointer shadow-2xs min-h-[44px] ${
            isCalendarOpen
              ? "border-sky-500 ring-2 ring-sky-500/20 bg-[var(--color-canvas-elevated)]"
              : "border-[var(--color-hairline)] hover:border-sky-500/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-expanded={isCalendarOpen}
          aria-haspopup="dialog"
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <Calendar size={16} className="h-4 w-4 text-sky-500 shrink-0" />
            <span className="truncate font-bold font-mono text-sm text-[var(--color-ink)] leading-none">
              {formattedDisplayValue}
            </span>
            {relativeBadge && (
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 leading-none ${relativeBadge.colorClass}`}
              >
                {relativeBadge.label}
              </span>
            )}
          </div>

          <ChevronDown
            size={14}
            className={`h-3.5 w-3.5 text-[var(--color-mute)] shrink-0 transition-transform duration-200 ml-1.5 ${
              isCalendarOpen ? "rotate-180 text-sky-500" : ""
            }`}
          />
        </button>
      </div>

      {helperText && (
        <p className="text-xs text-[var(--color-mute)] mt-1 font-medium">
          {helperText}
        </p>
      )}

      {/* ========================================================================= */}
      {/* FULL MONTH CALENDAR POPOVER DIALOG (PORTALED WITH DYNAMIC VIEWPORT POS)   */}
      {/* ========================================================================= */}
      {mounted && portalTarget && createPortal(
        <AnimatePresence>
          {isCalendarOpen && isPositioned && (
            <motion.div
              ref={popoverRef}
              key="custom-datepicker-popover"
              initial={{
                opacity: 0,
                scale: shouldReduceMotion ? 1 : 0.97,
                y: shouldReduceMotion ? 0 : position.placement === "top" ? 6 : -6,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: shouldReduceMotion ? 1 : 0.97,
                y: shouldReduceMotion ? 0 : position.placement === "top" ? 4 : -4,
              }}
              transition={{
                duration: 0.16,
                ease: [0.16, 1, 0.3, 1],
              }}
              style={{
                position: "fixed",
                top: position.top !== undefined ? `${position.top}px` : "auto",
                bottom: position.bottom !== undefined ? `${position.bottom}px` : "auto",
                left: `${position.left}px`,
                width: `${position.width}px`,
                maxHeight: `${position.maxHeight}px`,
                zIndex: 99999,
                pointerEvents: "auto",
                transformOrigin: position.placement === "top" ? "bottom center" : "top center",
              }}
              className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl overflow-hidden flex flex-col backdrop-blur-md"
              role="dialog"
              aria-label="Date Picker Calendar"
            >
              {/* Month Header & Switcher Navigation */}
              <div className="p-3 border-b border-[var(--color-hairline)] flex items-center justify-between bg-[var(--color-canvas-elevated)] shrink-0">
                <button
                  type="button"
                  disabled={!canGoPrevMonth}
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  className={`motion-press-tight motion-press p-1.5 rounded-lg border border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] cursor-pointer ${
                    !canGoPrevMonth ? "opacity-30 cursor-not-allowed hover:bg-transparent" : ""
                  }`}
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="text-center">
                  <span className="text-xs sm:text-sm font-extrabold text-[var(--color-ink)]">
                    {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!canGoNextMonth}
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  className={`motion-press-tight motion-press p-1.5 rounded-lg border border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] cursor-pointer ${
                    !canGoNextMonth ? "opacity-30 cursor-not-allowed hover:bg-transparent" : ""
                  }`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="overflow-y-auto overscroll-contain flex-1 min-h-0">
                {/* Weekday Column Headers */}
                <div className="grid grid-cols-7 gap-1 px-2.5 pt-2.5 text-center">
                  {WEEKDAY_NAMES.map((name) => (
                    <span
                      key={name}
                      className="text-[10px] sm:text-[11px] font-mono font-extrabold text-[var(--color-mute)] uppercase tracking-wider py-0.5"
                    >
                      {name}
                    </span>
                  ))}
                </div>

                {/* Month Grid Cells */}
                <div
                  className="grid grid-cols-7 gap-1 p-2.5 relative"
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  {calendarDays.map((cell, idx) => {
                    const isCellDisabled = !cell.isSelectable;
                    const isSelected = cell.isSelected;
                    const isToday = cell.isToday;
                    const isHovered = hoveredDate === cell.dateStr;
                    const tooltip = getDayTooltip(
                      cell,
                      maxDaysOld,
                      allowFutureDays,
                      allowAnyPast,
                      allowAnyFuture
                    );

                    const colIdx = idx % 7;
                    const rowIdx = Math.floor(idx / 7);
                    const isTopRow = rowIdx < 2;
                    const horizontalClass =
                      colIdx === 0
                        ? "left-0"
                        : colIdx === 6
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2";

                    return (
                      <div
                        key={cell.dateStr}
                        className="relative flex items-center justify-center w-full"
                        onMouseEnter={() => setHoveredDate(cell.dateStr)}
                        onMouseLeave={() =>
                          setHoveredDate((curr) => (curr === cell.dateStr ? null : curr))
                        }
                      >
                        <button
                          type="button"
                          aria-disabled={isCellDisabled}
                          tabIndex={isCellDisabled ? -1 : 0}
                          onClick={() => {
                            if (isCellDisabled) {
                              setHoveredDate(cell.dateStr);
                              return;
                            }
                            handleSelectDate(cell.dateStr);
                          }}
                          onFocus={() => setHoveredDate(cell.dateStr)}
                          onBlur={() =>
                            setHoveredDate((curr) => (curr === cell.dateStr ? null : curr))
                          }
                          onTouchStart={() => setHoveredDate(cell.dateStr)}
                          title={`${tooltip.label} · ${cell.date.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}`}
                          className={`relative h-9 sm:h-9.5 w-full rounded-xl text-xs flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? "bg-sky-600 text-white font-extrabold shadow-md ring-2 ring-sky-500/30 scale-105 z-10"
                              : isCellDisabled
                              ? "text-[var(--color-mute)] opacity-25 cursor-not-allowed hover:bg-rose-500/10"
                              : "text-[var(--color-ink)] font-bold hover:bg-sky-500/15 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                          } ${!cell.isCurrentMonth && !isSelected ? "opacity-30" : ""}`}
                        >
                          <span className="leading-none">{cell.dayNumber}</span>
                          {/* Today subtle indicator dot */}
                          {isToday && !isSelected && (
                            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
                          )}
                          {/* Locked subtle indicator icon on disabled cells */}
                          {isCellDisabled && !isSelected && (
                            <span className="absolute bottom-0.5 right-1 opacity-40">
                              <Lock size={8} />
                            </span>
                          )}
                        </button>

                        {/* Floating Tooltip */}
                        {isHovered && (
                          <div
                            role="tooltip"
                            className={`absolute z-[80] pointer-events-none transition-all duration-150 animate-in fade-in-0 zoom-in-95 ${
                              isTopRow ? "top-full mt-1.5" : "bottom-full mb-1.5"
                            } ${horizontalClass} bg-neutral-900/95 dark:bg-neutral-100/95 text-white dark:text-neutral-900 border border-neutral-700/80 dark:border-neutral-300/80 px-2.5 py-1 rounded-lg shadow-2xl backdrop-blur-sm flex items-center gap-1.5 whitespace-nowrap select-none`}
                          >
                            {tooltip.isLocked ? (
                              <Lock size={11} className="text-rose-400 dark:text-rose-600 shrink-0" />
                            ) : (
                              <span
                                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                                  tooltip.type === "today"
                                    ? "bg-emerald-400 dark:bg-emerald-600"
                                    : tooltip.type === "tomorrow"
                                    ? "bg-indigo-400 dark:bg-indigo-600"
                                    : tooltip.type === "yesterday"
                                    ? "bg-sky-400 dark:bg-sky-600"
                                    : "bg-amber-400 dark:bg-amber-600"
                                }`}
                              />
                            )}
                            <span className="text-[11px] font-bold tracking-tight leading-none">
                              {tooltip.label}
                            </span>
                            <span className="text-[10px] opacity-70 font-mono font-medium leading-none">
                              · {cell.date.toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Calendar Footer Info & Reset */}
              <div className="p-2.5 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 flex items-center justify-between text-[10px] text-[var(--color-mute)] shrink-0 min-h-[38px]">
                {hoveredCell ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    {hoveredTooltip?.isLocked ? (
                      <Lock size={11} className="text-rose-500 shrink-0" />
                    ) : (
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          hoveredTooltip?.type === "today"
                            ? "bg-emerald-500"
                            : hoveredTooltip?.type === "tomorrow"
                            ? "bg-indigo-500"
                            : hoveredTooltip?.type === "yesterday"
                            ? "bg-sky-500"
                            : "bg-amber-500"
                        }`}
                      />
                    )}
                    <span className="font-bold text-[var(--color-ink)] truncate text-[11px]">
                      {hoveredTooltip?.label}
                    </span>
                    <span className="text-[10px] text-[var(--color-mute)] truncate hidden sm:inline">
                      · {hoveredTooltip?.reason}
                    </span>
                  </div>
                ) : (
                  <span className="font-medium flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Green dot: Today
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => handleSelectDate(todayStr)}
                  className="font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1 shrink-0 ml-auto"
                >
                  <RotateCcw className="h-3 w-3" /> Select Today
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        portalTarget
      )}
    </div>
  );
}
