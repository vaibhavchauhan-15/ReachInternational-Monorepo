"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface HMRInputsProps {
  startMeter: string;
  endMeter: string;
  onStartMeterChange: (val: string) => void;
  onEndMeterChange: (val: string) => void;
  runningHours: number;
  isStartMeterLocked?: boolean;
  onToggleLock?: () => void;
}

export function HMRInputs({
  startMeter,
  endMeter,
  onStartMeterChange,
  onEndMeterChange,
  runningHours,
  isStartMeterLocked = false,
  onToggleLock,
}: HMRInputsProps) {
  const startNum = parseFloat(startMeter) || 0;
  const endNum = parseFloat(endMeter) || 0;

  const isMeterRegressed = endMeter !== "" && endNum < startNum;
  const isOver24Hours = runningHours > 24;

  return (
    <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/50 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[var(--color-mute)] font-mono">
          HMR
        </span>

        {/* Dynamic Running Hours Chip */}
        <div
          className={`inline-flex items-center shrink-0 whitespace-nowrap px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
            isMeterRegressed
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 gap-1"
              : isOver24Hours
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 gap-1"
              : runningHours > 0
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border border-[var(--color-hairline)]"
          }`}
        >
          {isMeterRegressed ? (
            <>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>Invalid Meter</span>
            </>
          ) : isOver24Hours ? (
            <>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>&gt;24 hrs</span>
            </>
          ) : (
            <span>RT: {runningHours.toFixed(1)} hrs</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Start Meter */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1">
              Start Meter (HMR)
              <span className="text-rose-500">*</span>
            </label>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              name="start_meter_hmr"
              id="start_meter_hmr"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              value={startMeter}
              onChange={(e) => onStartMeterChange(e.target.value)}
              required
              className="w-full min-h-[44px] h-[44px] sm:h-10 px-3 rounded-lg border font-mono text-base sm:text-sm font-semibold transition-colors bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] focus:outline-none focus:ring-2 focus:ring-[var(--color-link)]"
              placeholder="0.0"
            />
          </div>
          <p className="text-[10px] text-[var(--color-mute)] mt-1">
            Auto-filled from last recorded data. Click to edit.
          </p>
        </div>

        {/* End Meter */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-[var(--color-ink)] flex items-center gap-1">
              End Meter (HMR)
              <span className="text-rose-500">*</span>
            </label>
            <span className="text-[10px] text-[var(--color-mute)] font-mono">
              Min: {startNum.toFixed(1)}
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min={startNum}
              name="end_meter_hmr"
              id="end_meter_hmr"
              autoComplete="off"
              data-lpignore="true"
              data-1p-ignore="true"
              value={endMeter}
              onChange={(e) => onEndMeterChange(e.target.value)}
              required
              className={`w-full min-h-[44px] h-[44px] sm:h-10 px-3 rounded-lg border font-mono text-base sm:text-sm font-bold transition-colors bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] ${
                isMeterRegressed
                  ? "border-rose-500 focus:ring-2 focus:ring-rose-500"
                  : "border-[var(--color-hairline)] focus:outline-none focus:ring-2 focus:ring-[var(--color-link)]"
              }`}
              placeholder={(startNum + 6.0).toFixed(1)}
            />
          </div>
          {isMeterRegressed && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
              End meter must be ≥ {startNum.toFixed(1)}.
            </p>
          )}
          {isOver24Hours && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
              Running hours cannot exceed 24h.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
