"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, ChevronDown, RotateCcw, ArrowRight } from "lucide-react";
import { AnimatedX } from "./animated-icons";
import { Button } from "./Button";

export interface DateRange {
  startDate: string; // "YYYY-MM-DD"
  endDate: string; // "YYYY-MM-DD"
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  align?: "left" | "right";
  className?: string;
}

// Helpers
function formatToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateRangePicker({
  value,
  onChange,
  label,
  placeholder = "Select date range...",
  disabled = false,
  align = "left",
  className = "",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [startDate, setStartDate] = useState(value?.startDate || "");
  const [endDate, setEndDate] = useState(value?.endDate || "");

  useEffect(() => {
    if (value) {
      setStartDate(value.startDate);
      setEndDate(value.endDate);
    }
  }, [value]);

  // Click outside dismissal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const presets = [
    {
      label: "Today",
      getRange: () => {
        const d = formatToYMD(today);
        return { startDate: d, endDate: d };
      },
    },
    {
      label: "Yesterday",
      getRange: () => {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        const d = formatToYMD(y);
        return { startDate: d, endDate: d };
      },
    },
    {
      label: "Last 7 Days",
      getRange: () => {
        const past = new Date(today);
        past.setDate(past.getDate() - 6);
        return { startDate: formatToYMD(past), endDate: formatToYMD(today) };
      },
    },
    {
      label: "Last 30 Days",
      getRange: () => {
        const past = new Date(today);
        past.setDate(past.getDate() - 29);
        return { startDate: formatToYMD(past), endDate: formatToYMD(today) };
      },
    },
    {
      label: "This Month",
      getRange: () => {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: formatToYMD(first), endDate: formatToYMD(today) };
      },
    },
  ];

  const handleApplyPreset = (preset: typeof presets[0]) => {
    const range = preset.getRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    onChange(range);
    setIsOpen(false);
  };

  const handleApplyCustom = () => {
    if (startDate && endDate) {
      onChange({ startDate, endDate });
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStartDate("");
    setEndDate("");
    onChange({ startDate: "", endDate: "" });
  };

  const displayText = useMemo(() => {
    if (value?.startDate && value?.endDate) {
      if (value.startDate === value.endDate) return value.startDate;
      return `${value.startDate} – ${value.endDate}`;
    }
    return placeholder;
  }, [value, placeholder]);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full min-h-[42px] sm:min-h-[44px] px-3.5 rounded-lg border text-xs sm:text-[13px] font-medium text-[var(--color-ink)] flex items-center justify-between transition-all shadow-2xs ${
          isOpen
            ? "border-sky-500 ring-2 ring-sky-500/15 bg-[var(--color-canvas)]"
            : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="h-4 w-4 text-sky-500 shrink-0" />
          <span className={`truncate ${value?.startDate ? "font-semibold text-[var(--color-ink)]" : "text-[var(--color-mute)]"}`}>
            {displayText}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {value?.startDate && !disabled && (
            <span
              role="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-rose-500 transition-colors"
              title="Clear date range"
            >
              <AnimatedX size={13} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-[var(--color-mute)] transition-transform duration-200 ${
              isOpen ? "rotate-180 text-sky-500" : ""
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-50 top-full mt-1.5 w-full sm:w-[340px] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-2xl space-y-3 backdrop-blur-md animate-in fade-in zoom-in-95 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="text-[11px] font-mono font-bold text-[var(--color-mute)] uppercase tracking-wider">
            PRESET RANGES
          </div>

          {/* Preset Buttons Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-2.5 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-600 text-xs font-medium text-[var(--color-ink)] transition-all cursor-pointer text-center truncate"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t border-[var(--color-hairline)] pt-3 space-y-2">
            <div className="text-[11px] font-mono font-bold text-[var(--color-mute)] uppercase tracking-wider">
              CUSTOM RANGE
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
              <div>
                <label className="text-[10px] font-semibold text-[var(--color-mute)] block mb-0.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[var(--color-mute)] block mb-0.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost-sm"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary-sm"
                size="sm"
                disabled={!startDate || !endDate}
                onClick={handleApplyCustom}
              >
                Apply Range
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
