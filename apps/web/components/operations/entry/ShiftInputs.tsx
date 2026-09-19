"use client";

import React from "react";
import { Zap } from "lucide-react";
import { CustomDatePicker, CustomTimePicker } from "@/components/ui";

interface ShiftInputsProps {
  logDate: string;
  onLogDateChange: (val: string) => void;
  startTime: string;
  endTime: string;
  onStartTimeChange: (val: string) => void;
  onEndTimeChange: (val: string) => void;
  overtimeHours: string;
  onOvertimeChange: (val: string) => void;
  shiftDurationHours?: number;
}

export function ShiftInputs({
  logDate,
  onLogDateChange,
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  overtimeHours,
  onOvertimeChange,
  shiftDurationHours,
}: ShiftInputsProps) {
  const overtimePresets = ["0", "1", "2", "4"];

  return (
    <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[var(--color-mute)] font-mono">
          SHIFT TIMING
        </span>

        {shiftDurationHours !== undefined && shiftDurationHours > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-mute)]">
            Duration: <strong className="text-[var(--color-ink)]">{shiftDurationHours.toFixed(1)} hrs</strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Date Picker */}
        <div>
          <CustomDatePicker
            label="Log Date"
            value={logDate}
            onChange={onLogDateChange}
            maxDaysOld={7}
            allowFutureDays={0}
            required
          />
        </div>

        {/* Start Time */}
        <div>
          <CustomTimePicker
            label="Start Time"
            value={startTime}
            onChange={onStartTimeChange}
            required
          />
        </div>

        {/* End Time */}
        <div>
          <CustomTimePicker
            label="End Time"
            value={endTime}
            onChange={onEndTimeChange}
            required
          />
        </div>
      </div>

      {/* Overtime Controls: Unified single layout for both mobile & desktop */}
      <div className="pt-2.5 border-t border-[var(--color-hairline)] flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1.5 shrink-0">
          <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>Overtime (OT):</span>
        </label>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            {overtimePresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onOvertimeChange(preset)}
                className={`px-2 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  overtimeHours === preset
                    ? "bg-[var(--color-link)] text-white shadow-2xs font-bold"
                    : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] hover:text-[var(--color-ink)] border border-[var(--color-hairline)]"
                }`}
              >
                {preset}h
              </button>
            ))}
          </div>

          <div className="w-16 sm:w-20">
            <input
              type="number"
              step="0.5"
              min="0"
              max="16"
              value={overtimeHours}
              onChange={(e) => onOvertimeChange(e.target.value)}
              className="w-full h-8 px-1.5 text-center rounded border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] font-mono text-xs font-bold text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-link)]"
              placeholder="0"
              aria-label="Custom overtime hours"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
