"use client";

import React from "react";
import { Lock, Unlock, AlertTriangle } from "lucide-react";

interface HMRInputsProps {
  startMeter: string;
  endMeter: string;
  onStartMeterChange: (val: string) => void;
  onEndMeterChange: (val: string) => void;
  runningHours: number;
  isStartMeterLocked: boolean;
  onToggleLock: () => void;
}

export function HMRInputs({
  startMeter,
  endMeter,
  onStartMeterChange,
  onEndMeterChange,
  runningHours,
  isStartMeterLocked,
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
          <span className="sm:hidden">HMR</span>
          <span className="hidden sm:inline">Hour Meter Readings (HMR)</span>
        </span>

        {/* Dynamic Running Hours Chip */}
        <div
          className={`inline-flex items-center shrink-0 px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-mono font-bold transition-colors ${
            isMeterRegressed
              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20 gap-1.5"
              : isOver24Hours
              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20 gap-1.5"
              : runningHours > 0
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border border-[var(--color-hairline)]"
          }`}
        >
          {isMeterRegressed ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Invalid Meter</span>
            </>
          ) : isOver24Hours ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
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
            <button
              type="button"
              onClick={onToggleLock}
              className="text-[10px] text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
              title={isStartMeterLocked ? "Click to unlock and edit start meter" : "Click to lock start meter"}
            >
              {isStartMeterLocked ? (
                <>
                  <Lock className="h-3 w-3 text-emerald-500" />
                  <span>Synced</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3 text-amber-500" />
                  <span>Manual</span>
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              value={startMeter}
              onChange={(e) => onStartMeterChange(e.target.value)}
              disabled={isStartMeterLocked}
              required
              className={`w-full h-10 px-3 rounded-lg border font-mono text-sm font-semibold transition-colors ${
                isStartMeterLocked
                  ? "bg-[var(--color-canvas)] text-[var(--color-mute)] border-[var(--color-hairline)] cursor-not-allowed"
                  : "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] focus:outline-none focus:ring-2 focus:ring-[var(--color-link)]"
              }`}
              placeholder="0.0"
            />
          </div>
          <p className="text-[10px] text-[var(--color-mute)] mt-1">
            {isStartMeterLocked ? "Locked to last recorded meter reading." : "Manually adjusted starting meter."}
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
              value={endMeter}
              onChange={(e) => onEndMeterChange(e.target.value)}
              required
              className={`w-full h-10 px-3 rounded-lg border font-mono text-sm font-bold transition-colors bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] ${
                isMeterRegressed
                  ? "border-rose-500 focus:ring-2 focus:ring-rose-500"
                  : "border-[var(--color-hairline)] focus:outline-none focus:ring-2 focus:ring-[var(--color-link)]"
              }`}
              placeholder={(startNum + 6.0).toFixed(1)}
            />
          </div>
          {isMeterRegressed && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 font-medium">
              Ending meter cannot be less than starting meter ({startNum.toFixed(1)}).
            </p>
          )}
          {isOver24Hours && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
              Running hours cannot exceed 24.0 hours for a single shift.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
