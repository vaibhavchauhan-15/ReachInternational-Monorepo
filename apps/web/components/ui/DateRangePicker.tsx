"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { formatDate } from "@reachinternational/utils";
import { useDynamicDropdownPosition } from "@/lib/hooks/useDynamicDropdownPosition";
import { AnimatedX } from "./animated-icons";
import { Button } from "./Button";

export interface DateRange {
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
  label?: React.ReactNode;
  labelClassName?: string;
  count?: number;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  align?: "left" | "right";
  className?: string;
  allowAnyPast?: boolean;
  allowAnyFuture?: boolean;
  maxDaysOld?: number;
  allowFutureDays?: number;
  helperText?: string;
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

export function DateRangePicker({
  value,
  onChange,
  label,
  labelClassName = "block text-[11px] sm:text-xs font-semibold text-[var(--color-ink)]",
  count,
  required = false,
  placeholder = "Select date range...",
  disabled = false,
  align = "left",
  className = "",
  allowAnyPast = true,
  allowAnyFuture = true,
  maxDaysOld = 90,
  allowFutureDays = 0,
  helperText,
}: DateRangePickerProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Today reference at midnight
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const todayStr = useMemo(() => formatToYMD(today), [today]);

  // Temporary selection state while interacting with the calendar popover
  const [tempStartDate, setTempStartDate] = useState<string>(value?.startDate || "");
  const [tempEndDate, setTempEndDate] = useState<string>(value?.endDate || "");
  const [hoverDate, setHoverDate] = useState<string>("");

  // Sync internal temp states when value prop changes externally
  useEffect(() => {
    if (value) {
      setTempStartDate(value.startDate || "");
      setTempEndDate(value.endDate || "");
    }
  }, [value?.startDate, value?.endDate]);

  // Minimum allowed date at midnight
  const minDate = useMemo(() => {
    if (allowAnyPast) return new Date(1990, 0, 1);
    const d = new Date(today);
    d.setDate(d.getDate() - maxDaysOld);
    return d;
  }, [today, maxDaysOld, allowAnyPast]);

  // Maximum allowed future date at midnight
  const maxFutureDate = useMemo(() => {
    if (allowAnyFuture) return new Date(2050, 11, 31);
    const d = new Date(today);
    d.setDate(d.getDate() + allowFutureDays);
    return d;
  }, [today, allowFutureDays, allowAnyFuture]);

  // Month currently in view on calendar
  const [viewDate, setViewDate] = useState<Date>(() => {
    const initial = value?.startDate ? parseYMD(value.startDate) : today;
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  // Sync view month when value changes externally
  useEffect(() => {
    if (value?.startDate) {
      const parsed = parseYMD(value.startDate);
      setViewDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  }, [value?.startDate]);

  const { mounted, position, isPositioned, updatePosition } = useDynamicDropdownPosition({
    isOpen: isCalendarOpen,
    triggerRef,
    popoverRef,
    onClose: () => {
      // Revert unapplied temporary state on outside dismissal
      setTempStartDate(value?.startDate || "");
      setTempEndDate(value?.endDate || "");
      setHoverDate("");
      setIsCalendarOpen(false);
    },
    align,
    minWidth: 320,
    maxHeightCap: 380,
    matchTriggerWidth: false,
  });

  // Close calendar popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCalendarOpen) {
        setTempStartDate(value?.startDate || "");
        setTempEndDate(value?.endDate || "");
        setHoverDate("");
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCalendarOpen, value]);

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
        isToday: dStr === todayStr,
        diffDays,
      });
    }

    return days;
  }, [viewDate, today, todayStr, maxDaysOld, allowFutureDays, allowAnyPast, allowAnyFuture]);

  // Date selection click handler
  const handleSelectDate = (dateStr: string) => {
    // If no start date or both start and end are already selected, start a new selection
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      setTempStartDate(dateStr);
      setTempEndDate("");
      setHoverDate("");
    } else if (tempStartDate && !tempEndDate) {
      // Second click: completing the range
      if (dateStr < tempStartDate) {
        // Earlier date clicked -> reset start to this date
        setTempStartDate(dateStr);
        setTempEndDate("");
        setHoverDate("");
      } else {
        // Valid end date selected -> complete range and fire change
        setTempEndDate(dateStr);
        setHoverDate("");
        onChange({ startDate: tempStartDate, endDate: dateStr });
        setTimeout(() => {
          setIsCalendarOpen(false);
        }, 180);
      }
    }
  };

  const handleApplyCustom = () => {
    if (tempStartDate && tempEndDate) {
      onChange({ startDate: tempStartDate, endDate: tempEndDate });
      setIsCalendarOpen(false);
    }
  };

  const handleClear = () => {
    setTempStartDate("");
    setTempEndDate("");
    setHoverDate("");
    onChange({ startDate: "", endDate: "" });
  };

  const handleOpenToggle = () => {
    if (disabled) return;
    const nextState = !isCalendarOpen;
    if (nextState) {
      setTempStartDate(value?.startDate || "");
      setTempEndDate(value?.endDate || "");
      setHoverDate("");
      if (value?.startDate) {
        const p = parseYMD(value.startDate);
        setViewDate(new Date(p.getFullYear(), p.getMonth(), 1));
      }
      updatePosition();
    }
    setIsCalendarOpen(nextState);
  };

  // Day count calculation for active value
  const diffDaysCount = useMemo(() => {
    if (!value?.startDate || !value?.endDate) return null;
    const s = parseYMD(value.startDate);
    const e = parseYMD(value.endDate);
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [value?.startDate, value?.endDate]);
  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* ========================================================================= */}
      {/* COMPACT INPUT DROPDOWN TRIGGER                                            */}
      {/* ========================================================================= */}
      <div>
        {label && (
          <div className="flex items-center justify-between mb-1">
            <label className={labelClassName}>
              {label}
              {required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>
            {count !== undefined && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas-subtle)] text-[var(--color-mute)] font-extrabold">
                {count} Total
              </span>
            )}
          </div>
        )}

        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={handleOpenToggle}
          className={`w-full px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl border bg-[var(--color-canvas)] text-xs font-bold text-[var(--color-ink)] flex items-center justify-between transition-all cursor-pointer shadow-2xs min-h-[42px] ${
            isCalendarOpen
              ? "border-sky-500 ring-2 ring-sky-500/20 bg-[var(--color-canvas-elevated)]"
              : "border-[var(--color-hairline)] hover:border-sky-500/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          aria-expanded={isCalendarOpen}
          aria-haspopup="dialog"
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <Calendar className="h-4 w-4 text-sky-500 shrink-0" />
            {value?.startDate && value?.endDate ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="truncate font-extrabold text-[var(--color-ink)]">
                  {formatDate(value.startDate)}
                </span>
                <span className="text-[var(--color-mute)] font-medium text-[11px] shrink-0">
                  to
                </span>
                <span className="truncate font-extrabold text-[var(--color-ink)]">
                  {formatDate(value.endDate)}
                </span>
                {diffDaysCount !== null && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shrink-0 ml-1">
                    {diffDaysCount} Day{diffDaysCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[var(--color-mute)] font-medium truncate">
                {placeholder}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
            {value?.startDate && value?.endDate && !disabled && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="p-1 rounded-md hover:bg-[var(--color-canvas-subtle)] text-[var(--color-mute)] hover:text-rose-500 transition-colors"
                title="Clear date range"
              >
                <AnimatedX size={13} />
              </span>
            )}
            <ChevronDown
              size={16}
              className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
                isCalendarOpen ? "rotate-180 text-sky-500" : ""
              }`}
            />
          </div>
        </button>
      </div>

      {helperText && (
        <p className="text-[10px] text-[var(--color-mute)] mt-1 font-medium">
          {helperText}
        </p>
      )}

      {/* ========================================================================= */}
      {/* DATE RANGE CALENDAR POPOVER (PORTALED WITH DYNAMIC VIEWPORT POSITIONING)   */}
      {/* ========================================================================= */}
      {mounted && createPortal(
        <AnimatePresence onExitComplete={() => setHoverDate("")}>
          {isCalendarOpen && isPositioned && (
            <motion.div
              ref={popoverRef}
              key="daterange-picker-popover"
              initial={{
                opacity: 0,
                scale: 0.97,
                y: position.placement === "top" ? 6 : -6,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.97,
                y: position.placement === "top" ? 4 : -4,
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
                transformOrigin: position.placement === "top" ? "bottom center" : "top center",
              }}
              className="rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl overflow-hidden flex flex-col backdrop-blur-md"
              role="dialog"
              aria-label="Date Range Picker Calendar"
            >
              {/* Month Header & Switcher Navigation */}
              <div className="p-2 sm:p-2.5 border-b border-[var(--color-hairline)] flex items-center justify-between bg-[var(--color-canvas-elevated)] shrink-0">
                <button
                  type="button"
                  disabled={!canGoPrevMonth}
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  className={`p-1 rounded-lg border border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-all cursor-pointer ${
                    !canGoPrevMonth ? "opacity-30 cursor-not-allowed hover:bg-transparent" : ""
                  }`}
                >
                  <ChevronLeft size={15} />
                </button>

                <div className="text-center">
                  <span className="text-xs sm:text-[13px] font-extrabold text-[var(--color-ink)]">
                    {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={!canGoNextMonth}
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  className={`p-1 rounded-lg border border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-all cursor-pointer ${
                    !canGoNextMonth ? "opacity-30 cursor-not-allowed hover:bg-transparent" : ""
                  }`}
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              <div
                className="overflow-y-auto flex-1 min-h-0 custom-scrollbar"
                onMouseLeave={() => setHoverDate("")}
              >
                {/* Weekday Column Headers */}
                <div className="grid grid-cols-7 gap-0 px-2 pt-1.5 text-center">
                  {WEEKDAY_NAMES.map((name) => (
                    <span
                      key={name}
                      className="text-[10px] font-mono font-extrabold text-[var(--color-mute)] uppercase tracking-wider py-0.5"
                    >
                      {name}
                    </span>
                  ))}
                </div>

                {/* Month Grid Cells with Connected Range Styling */}
                <div className="grid grid-cols-7 gap-y-0.5 gap-x-0 px-2 pb-2 pt-0.5">
                  {calendarDays.map((cell) => {
                    const isCellDisabled = !cell.isSelectable;
                    const dStr = cell.dateStr;

                    // Effective range boundaries (including provisional hover)
                    const effStart = tempStartDate;
                    const effEnd =
                      tempEndDate ||
                      (hoverDate && hoverDate >= tempStartDate ? hoverDate : "");

                    const isStart = Boolean(effStart && dStr === effStart);
                    const isEnd = Boolean(effEnd && dStr === effEnd);
                    const isInRange = Boolean(effStart && effEnd && dStr > effStart && dStr < effEnd);
                    const isSingleDay = Boolean(isStart && isEnd);

                    const dayOfWeek = cell.date.getDay(); // 0 is Sun, 6 is Sat
                    const isSunday = dayOfWeek === 0;
                    const isSaturday = dayOfWeek === 6;

                    // Conditional class synthesis for continuous ribbons
                    let rangeClasses = "";
                    if (isSingleDay) {
                      rangeClasses =
                        "bg-sky-600 text-white font-extrabold shadow-md rounded-xl ring-2 ring-sky-500/30 z-10 scale-105";
                    } else if (isStart) {
                      rangeClasses =
                        "bg-sky-600 text-white font-extrabold shadow-md rounded-l-xl rounded-r-none ring-2 ring-sky-500/30 z-10";
                    } else if (isEnd) {
                      rangeClasses =
                        "bg-sky-600 text-white font-extrabold shadow-md rounded-r-xl rounded-l-none ring-2 ring-sky-500/30 z-10";
                    } else if (isInRange) {
                      rangeClasses = `bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold rounded-none ${
                        isSunday ? "rounded-l-lg" : ""
                      } ${isSaturday ? "rounded-r-lg" : ""}`;
                    } else if (isCellDisabled) {
                      rangeClasses = "text-[var(--color-mute)] opacity-20 cursor-not-allowed rounded-xl";
                    } else {
                      rangeClasses =
                        "text-[var(--color-ink)] font-bold hover:bg-sky-500/20 hover:text-sky-600 dark:hover:text-sky-400 rounded-xl cursor-pointer";
                    }

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        disabled={isCellDisabled}
                        onClick={() => handleSelectDate(cell.dateStr)}
                        onMouseEnter={() => {
                          if (tempStartDate && !tempEndDate && cell.isSelectable) {
                            setHoverDate(cell.dateStr);
                          }
                        }}
                        title={
                          isCellDisabled
                            ? cell.diffDays < 0
                              ? "Future dates are disabled"
                              : "Date out of range"
                            : cell.isToday
                            ? "Today"
                            : `${cell.diffDays} day${cell.diffDays === 1 ? "" : "s"} ago`
                        }
                        className={`relative h-7 sm:h-7.5 w-full text-xs flex flex-col items-center justify-center transition-colors ${rangeClasses} ${
                          !cell.isCurrentMonth && !isStart && !isEnd && !isInRange ? "opacity-30" : ""
                        }`}
                      >
                        <span className="leading-none select-none">{cell.dayNumber}</span>
                        {/* Today dot indicator */}
                        {cell.isToday && !isStart && !isEnd && (
                          <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calendar Footer Info & Action CTAs */}
              <div className="p-2 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 flex items-center justify-between text-xs shrink-0">
                <button
                  type="button"
                  onClick={handleClear}
                  className="font-bold text-[11px] text-[var(--color-mute)] hover:text-rose-500 cursor-pointer flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-[var(--color-canvas-subtle)]"
                >
                  <RotateCcw className="h-3 w-3" /> Clear
                </button>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost-sm"
                    size="sm"
                    onClick={() => {
                      setTempStartDate(value?.startDate || "");
                      setTempEndDate(value?.endDate || "");
                      setHoverDate("");
                      setIsCalendarOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary-sm"
                    size="sm"
                    disabled={!tempStartDate || !tempEndDate}
                    onClick={handleApplyCustom}
                  >
                    Apply Range
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
