"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Clock } from "lucide-react";
import { AnimatedAlertTriangle } from "./animated-icons";
import { SegmentedToggle, type SegmentedToggleItem } from "./SegmentedToggle";


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
  helperText?: string;
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
  helperText,
}: CustomTimePickerProps) {
  // Parse initial state from value prop
  const parsed = useMemo(() => parseTimeString(value), [value]);

  const [hour, setHour] = useState<string>(parsed.hour);
  const [minute, setMinute] = useState<string>(parsed.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);
  const [touched, setTouched] = useState<boolean>(false);

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

    const hasError = Boolean(hourErr || minuteErr);
    const errorMessage = externalError || hourErr || minuteErr || null;

    return {
      hourError: hourErr,
      minuteError: minuteErr,
      hasError,
      errorMessage,
    };
  }, [hour, minute, required, touched, externalError]);

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
  const amPmItems = useMemo<SegmentedToggleItem<"AM" | "PM">[]>(
    () => [
      { id: "AM", label: "AM", disabled },
      { id: "PM", label: "PM", disabled },
    ],
    [disabled]
  );

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    setTouched(true);
    setPeriod(newPeriod);
    emitFormattedTime(hour, minute, newPeriod);
  };

  return (
    <div className={`relative w-full ${className}`}>
      {label && (
        <label
          className={
            labelClassName ||
            "block text-[11px] sm:text-xs font-semibold text-[var(--color-ink)] mb-1 flex items-center gap-1.5"
          }
        >
          <Clock className={`h-3.5 w-3.5 ${iconColor}`} />
          <span>{label}</span>
          {required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
        </label>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Hours Input */}
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={hour}
            onChange={handleHourChange}
            onBlur={handleHourBlur}
            disabled={disabled}
            placeholder="08"
            aria-label="Hours (1-12)"
            className={`w-full h-10 px-1.5 sm:px-2 text-center font-mono text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl border bg-[var(--color-canvas)] text-[var(--color-ink)] transition-all shadow-2xs focus:outline-none focus:ring-2 ${
              validation.hourError
                ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                : "border-[var(--color-hairline)] focus:ring-sky-500/20 focus:border-sky-500 dark:focus:ring-sky-400/20 dark:focus:border-sky-400"
            }`}
          />
        </div>

        {/* Colon Separator */}
        <span className="font-mono text-sm sm:text-base font-bold text-[var(--color-mute)] select-none shrink-0">
          :
        </span>

        {/* Minutes Input (Optional, Treated as 00 if left blank) */}
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={minute}
            onChange={handleMinuteChange}
            onBlur={handleMinuteBlur}
            disabled={disabled}
            placeholder="00"
            aria-label="Minutes (0-60, optional)"
            className={`w-full h-10 px-1.5 sm:px-2 text-center font-mono text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl border bg-[var(--color-canvas)] text-[var(--color-ink)] transition-all shadow-2xs focus:outline-none focus:ring-2 ${
              validation.minuteError
                ? "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500"
                : "border-[var(--color-hairline)] focus:ring-sky-500/20 focus:border-sky-500 dark:focus:ring-sky-400/20 dark:focus:border-sky-400"
            }`}
          />
        </div>

        {/* Reused Canonical SegmentedToggle for AM / PM */}
        <div className="shrink-0 flex items-center">
          <SegmentedToggle<"AM" | "PM">
            size="sm"
            responsive={false}
            items={amPmItems}
            value={period}
            onChange={handlePeriodChange}
            layoutIdPrefix={`timepicker-ampm-${timePickerId}`}
            ariaLabel="Select AM or PM period"
            className="h-10 flex items-center justify-center p-0.5 rounded-lg sm:rounded-xl shadow-2xs border border-[var(--color-hairline)] shrink-0"
            itemClassName="min-h-[34px] px-2 sm:px-3 text-[11px] sm:text-xs font-bold"
          />
        </div>
      </div>

      {/* Inline Validation Error Message */}
      {validation.errorMessage && (
        <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1 mt-1 animate-in fade-in duration-150">
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

