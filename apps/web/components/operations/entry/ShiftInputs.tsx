"use client";

import React, { useState, useEffect } from "react";
import { Clock, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CustomDatePicker, CustomTimePicker } from "@/components/ui";
import type { ClientShiftCode } from "@reachinternational/types";
import { formatTo12Hour } from "@reachinternational/utils";
import { ShiftCardSelector, getShiftDisplayTitle } from "./ShiftCardSelector";
export { ShiftCardSelector, formatCompactTime, formatCompactShiftRange, getShiftDisplayTitle, getShiftSubtitle } from "./ShiftCardSelector";

export const DEFAULT_CLIENT_SHIFTS: ClientShiftCode[] = [
  {
    id: "default-s1",
    client_id: "",
    code: "S1",
    name: "Shift S1",
    start_time: "06:00 AM",
    end_time: "02:00 PM",
    raw_start_time: "06:00 AM",
    raw_end_time: "02:00 PM",
    scheduled_minutes: 480,
    normal_minutes: 480,
    crosses_midnight: false,
    display_order: 1,
    is_active: true,
  },
  {
    id: "default-s2",
    client_id: "",
    code: "S2",
    name: "Shift S2",
    start_time: "02:00 PM",
    end_time: "10:00 PM",
    raw_start_time: "02:00 PM",
    raw_end_time: "10:00 PM",
    scheduled_minutes: 480,
    normal_minutes: 480,
    crosses_midnight: false,
    display_order: 2,
    is_active: true,
  },
  {
    id: "default-s3",
    client_id: "",
    code: "S3",
    name: "Shift S3",
    start_time: "10:00 PM",
    end_time: "06:00 AM",
    raw_start_time: "10:00 PM",
    raw_end_time: "06:00 AM",
    scheduled_minutes: 480,
    normal_minutes: 480,
    crosses_midnight: true,
    display_order: 3,
    is_active: true,
  },
];

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
  shiftCodes?: ClientShiftCode[];
  selectedShiftCode?: string;
  onSelectShiftCode?: (code: string) => void;
  assignedShiftCodes?: string[];
  todayLoggedShiftCodes?: string[];
  todayLogs?: Array<{
    shift_code: string;
    start_meter: number;
    end_meter: number;
    running_hours: number;
  }>;
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
  shiftCodes = [],
  selectedShiftCode,
  onSelectShiftCode,
  assignedShiftCodes = [],
  todayLoggedShiftCodes = [],
  todayLogs = [],
}: ShiftInputsProps) {
  // Manual time pickers toggled via mode switcher
  const [showManualTimes, setShowManualTimes] = useState(false);

  const effectiveShiftCodes =
    shiftCodes && shiftCodes.length > 0 ? shiftCodes : DEFAULT_CLIENT_SHIFTS;

  const activeShift = effectiveShiftCodes.find((s) => {
    const sNorm = s.code.replace(/^shift\s+/i, "").trim().toUpperCase();
    const selNorm = (selectedShiftCode || "").replace(/^shift\s+/i, "").trim().toUpperCase();
    return s.code.toUpperCase() === (selectedShiftCode || "").toUpperCase() || sNorm === selNorm;
  });

  const handlePickShift = (sc: ClientShiftCode) => {
    if (onSelectShiftCode) {
      onSelectShiftCode(sc.code);
    }
    const s = formatTo12Hour(sc.start_time || sc.raw_start_time);
    if (s) onStartTimeChange(s);
    const e = formatTo12Hour(sc.end_time || sc.raw_end_time);
    if (e) onEndTimeChange(e);

    // If shift has built-in OT, auto-fill default OT; otherwise reset to 0 to prevent manual OT leaking
    const defaultOtHours = sc.default_ot_minutes && sc.default_ot_minutes > 0
      ? (sc.default_ot_minutes / 60).toString()
      : "0";
    onOvertimeChange(defaultOtHours);
  };

  // Ensure an operational shift is selected by default if available or if currently selected code is invalid.
  // Prioritize operator's assigned shift code if available.
  useEffect(() => {
    if (!effectiveShiftCodes || effectiveShiftCodes.length === 0 || !onSelectShiftCode) return;

    if (!selectedShiftCode) {
      const preferred = assignedShiftCodes && assignedShiftCodes.length > 0
        ? effectiveShiftCodes.find(s => assignedShiftCodes.some(c => c.toUpperCase() === s.code.toUpperCase()))
        : null;
      handlePickShift(preferred || effectiveShiftCodes[0]);
      return;
    }

    const hasMatch = effectiveShiftCodes.some((s) => {
      const sNorm = s.code.replace(/^shift\s+/i, "").trim().toUpperCase();
      const selNorm = (selectedShiftCode || "").replace(/^shift\s+/i, "").trim().toUpperCase();
      return s.code.toUpperCase() === (selectedShiftCode || "").toUpperCase() || (selNorm !== "" && sNorm === selNorm);
    });

    if (!hasMatch) {
      const preferred = assignedShiftCodes && assignedShiftCodes.length > 0
        ? effectiveShiftCodes.find(s => assignedShiftCodes.some(c => c.toUpperCase() === s.code.toUpperCase()))
        : null;
      handlePickShift(preferred || effectiveShiftCodes[0]);
    }
  }, [selectedShiftCode, effectiveShiftCodes, onSelectShiftCode, assignedShiftCodes]);

  const isCurrentShiftUnassigned = Boolean(
    activeShift &&
    assignedShiftCodes &&
    assignedShiftCodes.length > 0 &&
    !assignedShiftCodes.some(
      (c) => c.replace(/^shift\s*/i, "").trim().toUpperCase() === activeShift.code.replace(/^shift\s*/i, "").trim().toUpperCase()
    )
  );

  const isCurrentShiftLogged = Boolean(
    activeShift &&
    todayLoggedShiftCodes.some(
      (c) =>
        c.toUpperCase() === activeShift.code.toUpperCase() ||
        c.replace(/^shift\s*/i, "").trim().toUpperCase() ===
          activeShift.code.replace(/^shift\s*/i, "").trim().toUpperCase()
    )
  );

  return (
    <div className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/50 space-y-3">
      {/* Top Section Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-[var(--color-mute)] font-mono">
            {showManualTimes ? "Manual Entry" : "Shift"}
          </span>
          {!showManualTimes && activeShift && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              {getShiftDisplayTitle(activeShift)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowManualTimes(!showManualTimes)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors cursor-pointer border min-h-[32px] sm:min-h-[28px] ${
              showManualTimes
                ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20 hover:bg-sky-500/20"
                : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border-[var(--color-hairline)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)]/30"
            }`}
            title={showManualTimes ? "Switch to shift selection" : "Enter times manually"}
            aria-label={showManualTimes ? "Switch to shift selection" : "Enter times manually"}
            aria-pressed={showManualTimes}
          >
            <SlidersHorizontal size={12} className="shrink-0" />
            <span>{showManualTimes ? "Shift Mode" : "Manual"}</span>
          </button>

          {shiftDurationHours !== undefined && shiftDurationHours > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-[var(--color-mute)]">
              <span className="hidden sm:inline">Duration: </span>
              <strong className="text-[var(--color-ink)]">{shiftDurationHours.toFixed(1)} hrs</strong>
            </span>
          )}
        </div>
      </div>

      {/* Main Responsive Layout: DatePicker is in column 1, Shift cards or Manual pickers in columns 2-3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-start">
        {/* Date Picker (Column 1 on desktop) */}
        <div className="sm:col-span-1 min-w-0">
          <CustomDatePicker
            label="Select Date"
            value={logDate}
            onChange={onLogDateChange}
            maxDaysOld={7}
            allowFutureDays={0}
            required
            showWindowBadge={false}
          />
        </div>

        {/* Dynamic Shift Selector / Manual Time Pickers Slot (Columns 2-3 on desktop) */}
        <div className="sm:col-span-2 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {!showManualTimes ? (
              <motion.div
                key="shift-selection-view"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: "easeInOut" }}
                className="flex flex-col"
              >
                <label className="block text-[13px] sm:text-[13.5px] font-semibold text-[var(--color-ink)] mb-1 flex items-center gap-1.5 min-w-0">
                  <Clock size={15} className="h-[15px] w-[15px] text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="truncate">Select Shift</span>
                  <span className="text-rose-500 font-semibold ml-0.5 shrink-0 select-none leading-none">*</span>
                </label>
                <ShiftCardSelector
                  shiftCodes={effectiveShiftCodes}
                  selectedCode={selectedShiftCode}
                  onSelect={handlePickShift}
                  todayLoggedShiftCodes={todayLoggedShiftCodes}
                  todayLogs={todayLogs}
                />
                {isCurrentShiftLogged && (
                  <div className="mt-1.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Already logged for today.</span>
                  </div>
                )}
                {isCurrentShiftUnassigned && (
                  <p className="mt-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>Assigned to Shift {assignedShiftCodes.join(", ")} only.</span>
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="manual-times-view"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: "easeInOut" }}
                className="flex flex-col"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <CustomTimePicker
                    label="Start Time"
                    value={startTime}
                    onChange={onStartTimeChange}
                    toggleLayout="side-by-side"
                    required
                  />
                  <CustomTimePicker
                    label="End Time"
                    value={endTime}
                    onChange={onEndTimeChange}
                    toggleLayout="side-by-side"
                    required
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
