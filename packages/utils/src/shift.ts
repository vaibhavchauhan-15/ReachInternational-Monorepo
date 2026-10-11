/**
 * Reach International Shared Utilities — Operator Default Shift Resolver
 * Deterministically resolves and pre-selects the operator's assigned or roster shift.
 */

import { parseTimeToMinutes, formatTo12Hour } from './date';

export interface ShiftMatchTarget {
  code: string;
  name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  raw_start_time?: string | null;
  raw_end_time?: string | null;
  [key: string]: any;
}

export interface OperatorShiftContextMeta {
  assigned_shift_code?: string | null;
  operator?: {
    shift_code?: string | null;
    shift_start?: string | null;
    shift_end?: string | null;
    raw_shift_start?: string | null;
    raw_shift_end?: string | null;
    [key: string]: any;
  } | null;
  [key: string]: any;
}

/**
 * Resolves operator's default shift from context and available shift options:
 * 1. Direct code equality match against assigned_shift_code or operator.shift_code
 * 2. Normalized code match (e.g., "Shift S1" matches "S1")
 * 3. Shift name match
 * 4. Exact / closest start time match within 180 minutes of operator profile shift_start
 * 5. Fallback to first available shift
 */
export function resolveDefaultOperatorShift<T extends ShiftMatchTarget = ShiftMatchTarget>(
  context: OperatorShiftContextMeta | null | undefined,
  availableShifts: readonly T[]
): T | undefined {
  if (!availableShifts || availableShifts.length === 0) return undefined;
  const shifts: T[] = availableShifts as T[];
  if (!context) return shifts[0];

  const assignedCode = (context.assigned_shift_code || context.operator?.shift_code || '').trim();

  // 1. Direct code equality match
  if (assignedCode) {
    const direct = shifts.find(
      (s) => s.code.trim().toUpperCase() === assignedCode.toUpperCase()
    );
    if (direct) return direct;

    const cleanAssigned = assignedCode.replace(/^shift\s+/i, '').trim().toUpperCase();
    const normalized = shifts.find(
      (s) => s.code.replace(/^shift\s+/i, '').trim().toUpperCase() === cleanAssigned
    );
    if (normalized) return normalized;

    const nameMatch = shifts.find(
      (s) => s.name?.toUpperCase().includes(assignedCode.toUpperCase())
    );
    if (nameMatch) return nameMatch;
  }

  // 2. Start Time Match against operator's raw_shift_start or shift_start
  const opStartStr = context.operator?.raw_shift_start || context.operator?.shift_start;
  if (opStartStr) {
    const opMinutes = parseTimeToMinutes(opStartStr);
    if (opMinutes !== null) {
      let closestShift: T | undefined;
      let minDistance = Infinity;

      for (const s of shifts) {
        const sTime = s.raw_start_time || s.start_time;
        const sMinutes = parseTimeToMinutes(sTime);
        if (sMinutes !== null) {
          const diff = Math.abs(opMinutes - sMinutes);
          const circularDist = Math.min(diff, 1440 - diff);
          if (circularDist < minDistance) {
            minDistance = circularDist;
            closestShift = s;
          }
        }
      }

      if (closestShift && minDistance <= 180) {
        return closestShift;
      }
    }
  }

  return shifts[0];
}

/**
 * Returns formatted shift title (e.g. "Shift S1", "Shift A").
 */
export function getShiftDisplayTitle(sc: { code: string; name?: string | null }): string {
  const code = (sc.code || "").trim();
  if (/^shift\s+/i.test(code)) {
    return code;
  }
  return `Shift ${code}`;
}

/**
 * Extracts a concise human-readable shift name / subtitle from the client-defined shift.
 * E.g.
 * - "Shift A (Morning)" -> "Morning"
 * - "Shift B (Evening)" -> "Evening"
 * - "Shift C (Night)" -> "Night"
 * - "Morning Shift" -> "Morning Shift"
 * - "General Shift" -> "General Shift"
 * - "Shift A" -> ""
 */
export function getShiftSubtitle(sc: { code: string; name?: string | null }): string {
  if (!sc.name) return "";
  const name = sc.name.trim();
  const code = sc.code.trim();

  // If name has parenthesized clarification, extract it (e.g. "Shift A (Morning)" -> "Morning")
  const parenMatch = name.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1]?.trim()) {
    return parenMatch[1].trim();
  }

  // If name starts with "Shift <code|name>", strip "Shift <code>" prefix
  const stripped = name.replace(new RegExp(`^shift\\s*${code}\\s*[:\\-•]?\\s*`, "i"), "").trim();
  if (stripped && stripped.toLowerCase() !== code.toLowerCase()) {
    return stripped;
  }

  return name.toLowerCase() === `shift ${code}`.toLowerCase() || name.toLowerCase() === code.toLowerCase()
    ? ""
    : name;
}

/**
 * Calculates working hours for an individual shift log.
 */
export function calculateShiftWorkingHours(log: {
  normal_working_hours?: number | string | null;
  overtime_hours?: number | string | null;
  start_time?: string | null;
  end_time?: string | null;
  shift_scheduled_minutes?: number | string | null;
  running_hours?: number | string | null;
  [key: string]: any;
}): number {
  if (log.normal_working_hours != null && Number(log.normal_working_hours) > 0) {
    const normal = Number(log.normal_working_hours);
    const ot = Number(log.overtime_hours || 0);
    return normal + ot;
  }
  if (log.start_time && log.end_time) {
    const sParts = String(log.start_time).split(":").map(Number);
    const eParts = String(log.end_time).split(":").map(Number);
    if (!isNaN(sParts[0]) && !isNaN(eParts[0])) {
      const sMin = sParts[0] * 60 + (sParts[1] || 0);
      let eMin = eParts[0] * 60 + (eParts[1] || 0);
      if (eMin <= sMin) {
        if (eParts[0] === 23 && (eParts[1] || 0) === 59) {
          eMin = 1440;
        } else {
          eMin += 1440;
        }
      }
      return (eMin - sMin) / 60;
    }
  }
  if (log.shift_scheduled_minutes != null && Number(log.shift_scheduled_minutes) > 0) {
    return Number(log.shift_scheduled_minutes) / 60;
  }
  return Number(log.running_hours || 0);
}

/**
 * Computes the total effective duration (in decimal hours) of a shift window,
 * taking into account start time, end time, shift template metadata (scheduled/normal minutes),
 * and manual overtime.
 * Robustly handles:
 * - 12-hour AM/PM formats ("06:00 AM", "02:00 PM")
 * - 24-hour formats with/without seconds ("06:00:00", "14:00:00", "06:00", "14:00")
 * - Cross-midnight / overnight shifts
 * - Overtime inclusion
 * - Fallback to shift template norm (e.g. 480 minutes = 8 hours)
 */
export function calculateEffectiveShiftDurationHours(params: {
  startTime?: string | null;
  endTime?: string | null;
  scheduledMinutes?: number | null;
  normalMinutes?: number | null;
  overtimeHours?: number | string | null;
}): number {
  const { startTime, endTime, scheduledMinutes, normalMinutes, overtimeHours } = params;
  let baseHours = 0;

  if (startTime && endTime) {
    const sMins = parseTimeToMinutes(startTime);
    const eMins = parseTimeToMinutes(endTime);
    if (sMins !== null && eMins !== null) {
      let diff = eMins - sMins;
      if (diff < 0) diff += 24 * 60;
      baseHours = Math.round((diff / 60) * 10) / 10;
    }
  }

  if (baseHours <= 0) {
    if (scheduledMinutes != null && Number(scheduledMinutes) > 0) {
      baseHours = Math.round((Number(scheduledMinutes) / 60) * 10) / 10;
    } else if (normalMinutes != null && Number(normalMinutes) > 0) {
      baseHours = Math.round((Number(normalMinutes) / 60) * 10) / 10;
    }
  }

  // Default to 8.0h standard shift if still unresolvable
  if (baseHours <= 0) {
    baseHours = 8.0;
  }

  const ot = typeof overtimeHours === "string" ? parseFloat(overtimeHours) : Number(overtimeHours || 0);
  const safeOt = !isNaN(ot) && ot > 0 ? ot : 0;

  return Math.max(0, Math.round((baseHours + safeOt) * 10) / 10);
}

export interface ClientShiftPresetItem {
  code: string;
  name: string;
  startTime: string; // "06:00:00"
  endTime: string;   // "14:00:00"
  scheduledMinutes: number;
  normalMinutes: number;
  crossesMidnight: boolean;
  displayOrder: number;
}

export interface ClientShiftPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  shifts: ClientShiftPresetItem[];
}

export const CLIENT_SHIFT_PRESETS: ClientShiftPreset[] = [
  {
    id: "three_8h",
    name: "Three 8-Hour Shifts [A, B, C]",
    badge: "3 Shifts • 24h Coverage",
    description: "Standard continuous 24-hour plant & site operations across three 8-hour shift windows.",
    shifts: [
      {
        code: "A",
        name: "Shift A (Morning)",
        startTime: "06:00:00",
        endTime: "14:00:00",
        scheduledMinutes: 480,
        normalMinutes: 480,
        crossesMidnight: false,
        displayOrder: 1,
      },
      {
        code: "B",
        name: "Shift B (Evening)",
        startTime: "14:00:00",
        endTime: "22:00:00",
        scheduledMinutes: 480,
        normalMinutes: 480,
        crossesMidnight: false,
        displayOrder: 2,
      },
      {
        code: "C",
        name: "Shift C (Night)",
        startTime: "22:00:00",
        endTime: "06:00:00",
        scheduledMinutes: 480,
        normalMinutes: 480,
        crossesMidnight: true,
        displayOrder: 3,
      },
    ],
  },
  {
    id: "two_12h",
    name: "Two 12-Hour Shifts [Day, Night]",
    badge: "2 Shifts • 24h Heavy Site",
    description: "Heavy civil & remote site roster with 8h base work + 4h scheduled built-in overtime.",
    shifts: [
      {
        code: "DAY",
        name: "Day Shift (12h)",
        startTime: "08:00:00",
        endTime: "20:00:00",
        scheduledMinutes: 720,
        normalMinutes: 480,
        crossesMidnight: false,
        displayOrder: 1,
      },
      {
        code: "NIGHT",
        name: "Night Shift (12h)",
        startTime: "20:00:00",
        endTime: "08:00:00",
        scheduledMinutes: 720,
        normalMinutes: 480,
        crossesMidnight: true,
        displayOrder: 2,
      },
    ],
  },
  {
    id: "two_8h",
    name: "Two 8-Hour Shifts [A, B]",
    badge: "2 Shifts • 16h Operations",
    description: "Dual-shift coverage for urban sites and daytime production without overnight sound emissions.",
    shifts: [
      {
        code: "A",
        name: "Shift A (Morning)",
        startTime: "06:00:00",
        endTime: "14:00:00",
        scheduledMinutes: 480,
        normalMinutes: 480,
        crossesMidnight: false,
        displayOrder: 1,
      },
      {
        code: "B",
        name: "Shift B (Evening)",
        startTime: "14:00:00",
        endTime: "22:00:00",
        scheduledMinutes: 480,
        normalMinutes: 480,
        crossesMidnight: false,
        displayOrder: 2,
      },
    ],
  },
  {
    id: "single_general",
    name: "Single General Shift [General]",
    badge: "1 Shift • 8h–9h General",
    description: "Standard daytime commercial & workshop schedule with 1-hour lunch break.",
    shifts: [
      {
        code: "GEN",
        name: "General Shift (Day)",
        startTime: "09:00:00",
        endTime: "18:00:00",
        scheduledMinutes: 540,
        normalMinutes: 480,
        crossesMidnight: false,
        displayOrder: 1,
      },
    ],
  },
  {
    id: "none",
    name: "Custom (No Preset)",
    badge: "Manual Setup",
    description: "Start without pre-configured shifts. Manually define custom shift codes and timings later.",
    shifts: [],
  },
];

export const DEFAULT_CLIENT_SHIFT_PRESET_ID = "three_8h";

export function getClientShiftPresetById(id?: string | null): ClientShiftPreset | undefined {
  if (!id) return undefined;
  return CLIENT_SHIFT_PRESETS.find((p) => p.id === id);
}

/**
 * Sanitizes and cleans operational shift log errors into short, human-readable titles and messages.
 * Replaces cryptic database exceptions like:
 * "Cannot log before shift end. (end_dt=2026-10-11 14:00:00+05:30, now=2026-10-11 10:55:51.30018+05:30)"
 * with clean, meaningful instructions:
 * { title: 'Shift In Progress', message: 'Shift has not ended yet. Logs can be submitted after shift ends.' }
 */
export function parseOperationalErrorMessage(
  err: any,
  context?: {
    endTime?: string;
    startMeter?: number;
    endMeter?: number;
    assignedShifts?: string[];
  }
): { title: string; message: string } {
  const rawMsg = (err?.message || err?.details || (typeof err === 'string' ? err : '')).trim();
  const lower = rawMsg.toLowerCase();
  const formattedEnd = context?.endTime ? formatTo12Hour(context.endTime) || context.endTime : null;

  // 1. Shift End Future Guard
  if (
    lower.includes('cannot log before shift end') ||
    lower.includes('end_dt=') ||
    lower.includes('future shift end') ||
    lower.includes('shift end timestamp') ||
    lower.includes('shift is in progress')
  ) {
    return {
      title: 'Shift In Progress',
      message: formattedEnd
        ? `Shift has not ended yet. Logs can be submitted after ${formattedEnd}.`
        : 'Shift has not ended yet. Logs can be submitted after shift ends.',
    };
  }

  // 2. Meter Regression (End < Start)
  if (
    lower.includes('cannot be less than start meter') ||
    lower.includes('chk_machine_hour_logs_meter_range') ||
    lower.includes('must be ≥ start meter') ||
    lower.includes('end meter must be')
  ) {
    const startStr = context?.startMeter !== undefined ? `${context.startMeter.toFixed(1)}` : 'start meter';
    return {
      title: 'Invalid Meter Reading',
      message: `Ending meter reading cannot be less than starting meter (${startStr}).`,
    };
  }

  // 3. Exceeds 24 Hours
  if (lower.includes('cannot exceed 24 hours') || lower.includes('exceed 24h')) {
    return {
      title: 'Operating Limit Exceeded',
      message: 'Operating hours cannot exceed 24 hours in a single shift.',
    };
  }

  // 4. Overlapping / Conflict
  if (lower.includes('overlap') || lower.includes('overlapping') || lower.includes('tstzrange')) {
    return {
      title: 'Shift Time Conflict',
      message: 'This equipment already has a log recorded for this time window.',
    };
  }

  // 5. Breakdown duration exceeds shift
  if (
    lower.includes('breakdown duration') ||
    lower.includes('cannot exceed total shift duration') ||
    lower.includes('cannot exceed shift')
  ) {
    return {
      title: 'Invalid Breakdown Time',
      message: 'Breakdown duration cannot exceed total shift hours.',
    };
  }

  // 6. Unassigned Shift
  if (
    lower.includes('assigned to shift') ||
    lower.includes('unassigned shift') ||
    lower.includes('please select your assigned shift')
  ) {
    const shiftsStr = context?.assignedShifts && context.assignedShifts.length > 0
      ? `Shift ${context.assignedShifts.join(', ')}`
      : 'your assigned shift';
    return {
      title: 'Unassigned Shift',
      message: `You are assigned to ${shiftsStr}. Please select your assigned shift.`,
    };
  }

  // 7. Machine inactive or in maintenance
  if (lower.includes('maintenance or decommissioned') || lower.includes('inactive')) {
    return {
      title: 'Equipment Unavailable',
      message: 'This equipment is currently inactive or under maintenance.',
    };
  }

  // 8. Unauthorized operator
  if (lower.includes('unauthorized operator') || err?.code === '42501') {
    return {
      title: 'Unauthorized Action',
      message: 'You are not authorized to submit logs for this equipment.',
    };
  }

  // 9. Client mismatch
  if (lower.includes('client id does not match') || err?.code === '23503') {
    return {
      title: 'Site Mismatch',
      message: 'Equipment is not deployed at the selected client site.',
    };
  }

  // 10. Date older than 7 days
  if (lower.includes('previous 7 days') || lower.includes('older than 7 days')) {
    return {
      title: 'Date Window Locked',
      message: 'Shift logs cannot be submitted for dates older than 7 days.',
    };
  }

  // 11. Duplicate key (idempotency)
  if (lower.includes('duplicate key') || err?.code === '23505') {
    return {
      title: 'Already Recorded',
      message: 'This shift log has already been recorded in the system.',
    };
  }

  // 12. Network / connection drop
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('network error') ||
    lower.includes('timeout') ||
    lower.includes('connection')
  ) {
    return {
      title: 'Network Disconnected',
      message: 'Connection dropped. Shift log saved offline and will auto-sync.',
    };
  }

  // 13. Clean any remaining raw Postgres/DB error
  const clean = rawMsg
    .replace(/^error:\s*/i, '')
    .replace(/\(sqlstate\s+\w+\)/i, '')
    .replace(/context:[\s\S]*/i, '')
    .replace(/where:[\s\S]*/i, '')
    .replace(/detail:[\s\S]*/i, '')
    .trim();

  return {
    title: 'Submission Error',
    message: clean || 'Failed to submit shift log. Please verify details and try again.',
  };
}


