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
  align?: "left" | "right";
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

export function CustomDatePicker({
  value,
  onChange,
  maxDaysOld = 7,
  allowFutureDays = 0,
  allowAnyPast = false,
  allowAnyFuture = false,
  showWindowBadge = true,
  showRelativeBadge = true,
  label,
  labelClassName = "block text-[11px] sm:text-xs font-semibold text-[var(--color-ink)]",
  required = false,
  placeholder = "Select date...",
  className = "",
  disabled = false,
  helperText,
  align = "left",
}: CustomDatePickerProps) {
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

  // Sync view month when value changes externally
  useEffect(() => {
    if (value) {
      const parsed = parseYMD(value);
      setViewDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  }, [value]);

  const { mounted, position, isPositioned, updatePosition } = useDynamicDropdownPosition({
    isOpen: isCalendarOpen,
    triggerRef,
    popoverRef,
    onClose: () => setIsCalendarOpen(false),
    minWidth: 280,
    maxHeightCap: 400,
    matchTriggerWidth: false,
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
    if (diffDays > 1 && diffDays <= maxDaysOld) {
      return {
        label: `${diffDays}d ago`,
        colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      };
    }
    if (diffDays > maxDaysOld) {
      return {
        label: "Locked (>7d)",
        colorClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      };
    }
    return {
      label: "Future",
      colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
    };
  }, [value, today, maxDaysOld, showRelativeBadge, allowAnyPast]);

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
  };

  const handleOpenToggle = () => {
    if (disabled) return;
    const nextState = !isCalendarOpen;
    if (nextState) {
      updatePosition();
    }
    setIsCalendarOpen(nextState);
  };

  const formattedDisplayValue = useMemo(() => {
    if (!value) return placeholder;
    try {
      const parsed = parseYMD(value);
      return formatDate(parsed);
    } catch (e) {
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
            <label className={labelClassName}>
              {label}
              {required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>
            {showWindowBadge && (
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold tracking-tight shrink-0">
                <span className="hidden xs:inline">Allowed: </span>7d window
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
            <span className="truncate font-extrabold text-[var(--color-ink)]">
              {formattedDisplayValue}
            </span>
            {relativeBadge && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${relativeBadge.colorClass}`}
              >
                {relativeBadge.label}
              </span>
            )}
          </div>

          <ChevronDown
            size={16}
            className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ml-1.5 ${
              isCalendarOpen ? "rotate-180 text-sky-500" : ""
            }`}
          />
        </button>
      </div>

      {helperText && (
        <p className="text-[10px] text-[var(--color-mute)] mt-1 font-medium">
          {helperText}
        </p>
      )}

      {/* ========================================================================= */}
      {/* FULL MONTH CALENDAR POPOVER DIALOG (PORTALED WITH DYNAMIC VIEWPORT POS)   */}
      {/* ========================================================================= */}
      {mounted && createPortal(
        <AnimatePresence>
          {isCalendarOpen && isPositioned && (
            <motion.div
              ref={popoverRef}
              key="custom-datepicker-popover"
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
              aria-label="Date Picker Calendar"
            >
              {/* Month Header & Switcher Navigation */}
              <div className="p-3 border-b border-[var(--color-hairline)] flex items-center justify-between bg-[var(--color-canvas-elevated)] shrink-0">
                <button
                  type="button"
                  disabled={!canGoPrevMonth}
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  className={`p-1.5 rounded-lg border border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-all cursor-pointer ${
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
                  className={`p-1.5 rounded-lg border border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-all cursor-pointer ${
                    !canGoNextMonth ? "opacity-30 cursor-not-allowed hover:bg-transparent" : ""
                  }`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 min-h-0 custom-scrollbar">
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
                <div className="grid grid-cols-7 gap-1 p-2.5">
                  {calendarDays.map((cell) => {
                    const isCellDisabled = !cell.isSelectable;
                    const isSelected = cell.isSelected;
                    const isToday = cell.isToday;

                    return (
                      <button
                        key={cell.dateStr}
                        type="button"
                        disabled={isCellDisabled}
                        onClick={() => handleSelectDate(cell.dateStr)}
                        title={
                          isCellDisabled
                            ? cell.diffDays < 0
                              ? "Future dates are disabled"
                              : "Dates older than 7 days are locked"
                            : cell.isToday
                            ? "Today"
                            : `${cell.diffDays} day${cell.diffDays === 1 ? "" : "s"} ago`
                        }
                        className={`relative h-8 sm:h-9 w-full rounded-xl text-xs flex flex-col items-center justify-center transition-all ${
                          isSelected
                            ? "bg-sky-600 text-white font-extrabold shadow-md ring-2 ring-sky-500/30 scale-105 z-10"
                            : isCellDisabled
                            ? "text-[var(--color-mute)] opacity-20 cursor-not-allowed"
                            : "text-[var(--color-ink)] font-bold hover:bg-sky-500/15 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                        } ${!cell.isCurrentMonth && !isSelected ? "opacity-30" : ""}`}
                      >
                        <span className="leading-none">{cell.dayNumber}</span>
                        {/* Today subtle indicator dot */}
                        {isToday && !isSelected && (
                          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calendar Footer Info & Reset */}
              <div className="p-2.5 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 flex items-center justify-between text-[10px] text-[var(--color-mute)] shrink-0">
                <span className="font-medium flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Green dot: Today
                </span>

                <button
                  type="button"
                  onClick={() => handleSelectDate(todayStr)}
                  className="font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" /> Select Today
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
