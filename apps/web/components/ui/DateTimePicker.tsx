"use client";

import React from "react";
import { CustomDatePicker } from "./CustomDatePicker";
import { CustomTimePicker } from "./CustomTimePicker";

export interface DateTimePickerProps {
  dateValue: string; // "YYYY-MM-DD"
  timeValue: string; // "HH:MM AM/PM"
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  label?: React.ReactNode;
  labelClassName?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  maxDaysOld?: number;
  allowFutureDays?: number;
  datePlaceholder?: string;
  timePlaceholder?: string;
  iconColor?: string;
  align?: "left" | "right";
  helperText?: string;
}

export function DateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  label,
  labelClassName = "block text-[11px] sm:text-xs font-semibold text-[var(--color-ink)] mb-1",
  required = false,
  disabled = false,
  className = "",
  maxDaysOld = 7,
  allowFutureDays = 0,
  datePlaceholder = "Select date...",
  timePlaceholder = "Select time...",
  iconColor,
  align = "left",
  helperText,
}: DateTimePickerProps) {
  return (
    <div className={`flex flex-col w-full ${className}`}>
      {label && (
        <div className="flex items-center justify-between mb-1">
          {typeof label === "string" ? (
            <label className={labelClassName}>
              {label}
              {required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
            </label>
          ) : (
            <div className="flex items-center">
              {label}
              {required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
        <CustomDatePicker
          value={dateValue}
          onChange={onDateChange}
          disabled={disabled}
          placeholder={datePlaceholder}
          maxDaysOld={maxDaysOld}
          allowFutureDays={allowFutureDays}
          align={align}
        />
        <CustomTimePicker
          value={timeValue}
          onChange={onTimeChange}
          disabled={disabled}
          placeholder={timePlaceholder}
          iconColor={iconColor}
        />
      </div>

      {helperText && (
        <span className="text-[10px] text-[var(--color-mute)] mt-1">{helperText}</span>
      )}
    </div>
  );
}
