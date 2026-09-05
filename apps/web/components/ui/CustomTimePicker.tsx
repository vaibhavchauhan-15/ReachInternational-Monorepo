"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Clock } from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedAlertTriangle } from "./animated-icons";
import { cn } from "@/lib/utils";

export interface CustomTimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  onErrorChange?: (hasError: boolean) => void;
  label?: React.ReactNode;
  labelClassName?: string;
  required?: boolean;
  placeholder?: string;
  iconColor?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
  isInvalid?: boolean;
  hideErrorMessage?: boolean;
  helperText?: string;
  /** Layout orientation for the AM/PM toggle. Defaults to "horizontal" for polished, legible tap targets. */
  toggleOrientation?: "horizontal" | "vertical";
}

export type TimeInputProps = CustomTimePickerProps;

/**
 * Parses any incoming time string into { hour: string, minute: string, period: "AM" | "PM" }
 */
function parseTimeString(timeStr?: string | null): {
  hour: string;
  minute: string;
  period: "AM" | "PM";
} {
  if (!timeStr || !timeStr.trim()) {
    return { hour: "", minute: "", period: "AM" };
  }

  const clean = timeStr.trim().toUpperCase();

  // Match 12-hour with AM/PM (e.g. "08:00 AM", "010:030 AM", "8:30PM", "8:00")
  const ampmMatch = clean.match(/^(\d{1,3}):(\d{1,3})(?::\d{2})?\s*(AM|PM)?$/i);
  if (ampmMatch) {
    const rawH = parseInt(ampmMatch[1], 10);
    const rawM = parseInt(ampmMatch[2], 10);
    const p = (ampmMatch[3] || "AM").toUpperCase() as "AM" | "PM";

    let hStr = "";
    if (!isNaN(rawH)) {
      if (rawH >= 1 && rawH <= 12) {
        hStr = String(rawH).padStart(2, "0");
      } else {
        hStr = String(rawH);
      }
    }

    let mStr = "00";
    if (!isNaN(rawM)) {
      if (rawM >= 0 && rawM <= 60) {
        mStr = String(rawM).padStart(2, "0");
      } else {
        mStr = String(rawM);
      }
    }

    return { hour: hStr, minute: mStr, period: p === "PM" ? "PM" : "AM" };
  }

  // Match 24-hour format (e.g. "14:30", "06:00:00")
  const match24 = clean.match(/^(\d{1,3}):(\d{1,3})(?::\d{2})?$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const rawM = parseInt(match24[2], 10);
    const period: "AM" | "PM" = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return {
      hour: String(hours).padStart(2, "0"),
      minute: String(isNaN(rawM) ? 0 : rawM).padStart(2, "0"),
      period,
    };
  }

  return { hour: "", minute: "", period: "AM" };
}

export function CustomTimePicker({
  value,
  onChange,
  onErrorChange,
  label,
  labelClassName,
  required = false,
  iconColor = "text-sky-500",
  className = "",
  disabled = false,
  error: externalError,
  isInvalid = false,
  hideErrorMessage = false,
  helperText,
  toggleOrientation = "horizontal",
}: CustomTimePickerProps) {
  // Parse initial state from value prop
  const parsed = useMemo(() => parseTimeString(value), [value]);

  const [hour, setHour] = useState<string>(parsed.hour);
  const [minute, setMinute] = useState<string>(parsed.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);
  const [touched, setTouched] = useState<boolean>(false);

  const hourInputRef = useRef<HTMLInputElement>(null);
  const minuteInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state if external value changes
  useEffect(() => {
    const current = parseTimeString(value);
    setHour(current.hour);
    setMinute(current.minute);
    setPeriod(current.period);
  }, [value]);

  // Validation logic
  const validation = useMemo(() => {
    const trimmedH = hour.trim();
    const trimmedM = minute.trim();

    let hourErr: string | null = null;
    let minuteErr: string | null = null;

    if (!trimmedH) {
      if (required || touched) {
        hourErr = "Hour is required (1–12)";
      }
    } else {
      const hNum = parseInt(trimmedH, 10);
      if (isNaN(hNum) || hNum < 1 || hNum > 12) {
        hourErr = "Hour must be between 1 and 12";
      }
    }

    if (trimmedM !== "") {
      const mNum = parseInt(trimmedM, 10);
      if (isNaN(mNum) || mNum < 0 || mNum > 60) {
        minuteErr = "Minutes must be between 0 and 60";
      }
    }

    const hasInternalError = Boolean(hourErr || minuteErr);
    const hasError = hasInternalError || Boolean(externalError) || Boolean(isInvalid);
    const errorMessage = (!hideErrorMessage && (externalError || hourErr || minuteErr)) || null;

    return {
      hourError: hourErr,
      minuteError: minuteErr,
      hasError,
      errorMessage,
    };
  }, [hour, minute, required, touched, externalError, isInvalid, hideErrorMessage]);

  // Notify parent of error state changes
  useEffect(() => {
    onErrorChange?.(validation.hasError);
  }, [validation.hasError, onErrorChange]);

  // Trigger onChange when inputs are valid
  const emitFormattedTime = useCallback(
    (newHour: string, newMinute: string, newPeriod: "AM" | "PM") => {
      const trimmedH = newHour.trim();
      const trimmedM = newMinute.trim();

      if (!trimmedH) {
        onChange("");
        return;
      }

      const hNum = parseInt(trimmedH, 10);
      if (isNaN(hNum) || hNum < 1 || hNum > 12) {
        return;
      }

      let mNum = 0;
      if (trimmedM !== "") {
        mNum = parseInt(trimmedM, 10);
        if (isNaN(mNum) || mNum < 0 || mNum > 60) {
          return;
        }
      }

      const formattedH = String(hNum).padStart(2, "0");
      const formattedM = String(mNum).padStart(2, "0");
      const formattedTime = `${formattedH}:${formattedM} ${newPeriod}`;
      onChange(formattedTime);
    },
    [onChange]
  );

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTouched(true);
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "");

    if (digits === "") {
      setHour("");
      emitFormattedTime("", minute, period);
      return;
    }

    let sanitized = digits;
    // Automatically sanitize 3+ digits with leading zero (e.g. "010" -> "10", "030" -> "30", "008" -> "8")
    if (digits.length > 2 && digits.startsWith("0")) {
      const parsedNum = parseInt(digits, 10);
      sanitized = isNaN(parsedNum) ? "" : String(parsedNum);
    } else if (digits.length > 2) {
      const parsedNum = parseInt(digits, 10);
      if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 12) {
        sanitized = String(parsedNum);
      } else {
        sanitized = digits.slice(-2);
      }
    }

    setHour(sanitized);
    emitFormattedTime(sanitized, minute, period);

    // Ergonomic auto-advance: if 2 digits entered and valid (e.g. "08", "12"), advance focus to minute input
    if (sanitized.length === 2) {
      const num = parseInt(sanitized, 10);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        setTimeout(() => {
          minuteInputRef.current?.focus();
          minuteInputRef.current?.select();
        }, 10);
      }
    }
  };

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ":" || e.key === "Enter" || (e.key === "ArrowRight" && hour.length > 0)) {
      e.preventDefault();
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTouched(true);
      const curr = parseInt(hour, 10) || 12;
      const next = curr >= 12 ? 1 : curr + 1;
      const padded = String(next).padStart(2, "0");
      setHour(padded);
      emitFormattedTime(padded, minute, period);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setTouched(true);
      const curr = parseInt(hour, 10) || 1;
      const prev = curr <= 1 ? 12 : curr - 1;
      const padded = String(prev).padStart(2, "0");
      setHour(padded);
      emitFormattedTime(padded, minute, period);
    }
  };

  const handleHourBlur = () => {
    setTouched(true);
    const trimmedH = hour.trim();
    if (trimmedH) {
      const hNum = parseInt(trimmedH, 10);
      if (!isNaN(hNum)) {
        if (hNum >= 1 && hNum <= 12) {
          const padded = String(hNum).padStart(2, "0");
          setHour(padded);
          emitFormattedTime(padded, minute, period);
        } else {
          setHour(String(hNum));
          emitFormattedTime(String(hNum), minute, period);
        }
      }
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTouched(true);
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, "");

    if (digits === "") {
      setMinute("");
      emitFormattedTime(hour, "", period);
      return;
    }

    let sanitized = digits;
    // Automatically sanitize 3+ digits with leading zero (e.g. "030" -> "30", "010" -> "10", "005" -> "5")
    if (digits.length > 2 && digits.startsWith("0")) {
      const parsedNum = parseInt(digits, 10);
      sanitized = isNaN(parsedNum) ? "" : String(parsedNum);
    } else if (digits.length > 2) {
      const parsedNum = parseInt(digits, 10);
      if (!isNaN(parsedNum) && parsedNum >= 0 && parsedNum <= 60) {
        sanitized = String(parsedNum);
      } else {
        sanitized = digits.slice(-2);
      }
    }

    setMinute(sanitized);
    emitFormattedTime(hour, sanitized, period);
  };

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && minute === "") {
      e.preventDefault();
      hourInputRef.current?.focus();
      hourInputRef.current?.select();
    } else if (e.key === "ArrowLeft" && (e.currentTarget.selectionStart === 0 || minute === "")) {
      e.preventDefault();
      hourInputRef.current?.focus();
      hourInputRef.current?.select();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setTouched(true);
      const curr = parseInt(minute, 10) || 0;
      const next = (curr + 5) % 60;
      const padded = String(next).padStart(2, "0");
      setMinute(padded);
      emitFormattedTime(hour, padded, period);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setTouched(true);
      const curr = parseInt(minute, 10) || 0;
      const prev = (curr - 5 + 60) % 60;
      const padded = String(prev).padStart(2, "0");
      setMinute(padded);
      emitFormattedTime(hour, padded, period);
    }
  };

  const handleMinuteBlur = () => {
    setTouched(true);
    const trimmedM = minute.trim();
    if (trimmedM === "") {
      setMinute("00");
      emitFormattedTime(hour, "00", period);
    } else {
      const mNum = parseInt(trimmedM, 10);
      if (!isNaN(mNum)) {
        if (mNum >= 0 && mNum <= 60) {
          const padded = String(mNum).padStart(2, "0");
          setMinute(padded);
          emitFormattedTime(hour, padded, period);
        } else {
          setMinute(String(mNum));
          emitFormattedTime(hour, String(mNum), period);
        }
      }
    }
  };

  const timePickerId = React.useId();

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    setTouched(true);
    setPeriod(newPeriod);
    emitFormattedTime(hour, minute, newPeriod);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      e.target === containerRef.current ||
      (e.target as HTMLElement).classList.contains("time-cluster-area")
    ) {
      if (!hour) {
        hourInputRef.current?.focus();
        hourInputRef.current?.select();
      } else {
        minuteInputRef.current?.focus();
        minuteInputRef.current?.select();
      }
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      {label && (
        <label
          className={
            labelClassName ||
            "block text-[11px] sm:text-xs font-semibold text-[var(--color-ink)] mb-1 flex items-center gap-1.5 min-w-0"
          }
        >
          <Clock className={`h-3.5 w-3.5 ${iconColor} shrink-0`} />
          <span className="truncate">{label}</span>
          {required && <span className="text-rose-500 font-bold ml-0.5 shrink-0">*</span>}
        </label>
      )}

      {/* Unified Cohesive Time Picker Shell */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={cn(
          "group relative flex items-center justify-between w-full min-h-[38px] sm:min-h-[42px] h-9.5 sm:h-[42px] px-2.5 sm:px-3.5 rounded-xl border bg-[var(--color-canvas)] text-[var(--color-ink)] transition-all shadow-2xs cursor-text",
          "focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 dark:focus-within:ring-sky-400/20 dark:focus-within:border-sky-400",
          validation.hasError || Boolean(externalError)
            ? "border-rose-500 focus-within:ring-rose-500/20 focus-within:border-rose-500 dark:border-rose-500"
            : "border-[var(--color-hairline)] hover:border-neutral-300 dark:hover:border-neutral-700",
          disabled && "opacity-50 pointer-events-none bg-neutral-100 dark:bg-neutral-900 cursor-not-allowed"
        )}
      >
        {/* Left: Digital Time Input Cluster */}
        <div className="time-cluster-area flex items-center gap-0.5 sm:gap-1 min-w-0">
          {/* Hours Input */}
          <input
            ref={hourInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={hour}
            onChange={handleHourChange}
            onKeyDown={handleHourKeyDown}
            onBlur={handleHourBlur}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            placeholder="08"
            aria-label="Hours (1-12)"
            className="w-7 xs:w-7.5 sm:w-8 h-7 sm:h-8 p-0 text-center font-mono text-xs sm:text-sm font-bold rounded-lg bg-transparent hover:bg-neutral-200/50 dark:hover:bg-neutral-800/70 focus:bg-neutral-200/60 dark:focus:bg-neutral-800 text-[var(--color-ink)] focus:outline-none transition-colors select-all"
          />

          {/* Colon Separator */}
          <span className="font-mono text-xs sm:text-sm font-bold text-[var(--color-mute)] select-none px-0.25 opacity-70 shrink-0">
            :
          </span>

          {/* Minutes Input */}
          <input
            ref={minuteInputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={minute}
            onChange={handleMinuteChange}
            onKeyDown={handleMinuteKeyDown}
            onBlur={handleMinuteBlur}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            placeholder="00"
            aria-label="Minutes (0-60, optional)"
            className="w-7 xs:w-7.5 sm:w-8 h-7 sm:h-8 p-0 text-center font-mono text-xs sm:text-sm font-bold rounded-lg bg-transparent hover:bg-neutral-200/50 dark:hover:bg-neutral-800/70 focus:bg-neutral-200/60 dark:focus:bg-neutral-800 text-[var(--color-ink)] focus:outline-none transition-colors select-all"
          />
        </div>

        {/* Right: Sleek Polished AM/PM Segmented Toggle */}
        <div className="shrink-0 ml-1 sm:ml-2">
          <div
            role="tablist"
            aria-label="Select AM or PM period"
            className={cn(
              "relative p-0.5 border border-neutral-200/80 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 shadow-inner select-none transition-colors",
              toggleOrientation === "vertical"
                ? "inline-flex flex-col gap-0.5 rounded-xl"
                : "inline-flex items-center gap-0.5 h-7 sm:h-8 rounded-full"
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={period === "AM"}
              disabled={disabled}
              onClick={() => handlePeriodChange("AM")}
              className={cn(
                "relative text-[10px] xs:text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer select-none leading-none z-10 flex items-center justify-center",
                toggleOrientation === "vertical"
                  ? "w-full py-1 px-1.5 rounded-lg"
                  : "h-full min-w-[28px] xs:min-w-[32px] sm:min-w-[36px] px-2 sm:px-2.5 rounded-full",
                period === "AM"
                  ? "text-white font-extrabold"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-bold"
              )}
            >
              {period === "AM" && (
                <motion.div
                  layoutId={`ampm-active-${timePickerId}`}
                  className={cn(
                    "absolute inset-0 bg-sky-600 dark:bg-sky-500 shadow-2xs -z-10",
                    toggleOrientation === "vertical" ? "rounded-lg" : "rounded-full"
                  )}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              AM
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={period === "PM"}
              disabled={disabled}
              onClick={() => handlePeriodChange("PM")}
              className={cn(
                "relative text-[10px] xs:text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer select-none leading-none z-10 flex items-center justify-center",
                toggleOrientation === "vertical"
                  ? "w-full py-1 px-1.5 rounded-lg"
                  : "h-full min-w-[28px] xs:min-w-[32px] sm:min-w-[36px] px-2 sm:px-2.5 rounded-full",
                period === "PM"
                  ? "text-white font-extrabold"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-bold"
              )}
            >
              {period === "PM" && (
                <motion.div
                  layoutId={`ampm-active-${timePickerId}`}
                  className={cn(
                    "absolute inset-0 bg-sky-600 dark:bg-sky-500 shadow-2xs -z-10",
                    toggleOrientation === "vertical" ? "rounded-lg" : "rounded-full"
                  )}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              PM
            </button>
          </div>
        </div>
      </div>

      {/* Inline Validation Error Message */}
      {validation.errorMessage && (
        <p className="text-[10px] sm:text-[11px] text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1 mt-1 animate-in fade-in duration-150">
          <AnimatedAlertTriangle size={12} className="shrink-0 text-rose-500" />
          <span>{validation.errorMessage}</span>
        </p>
      )}

      {helperText && !validation.errorMessage && (
        <span className="text-[10px] text-[var(--color-mute)] mt-1 block">
          {helperText}
        </span>
      )}
    </div>
  );
}

export const TimeInput = CustomTimePicker;


