/**
 * ServiceCentric Shared Utilities — Date Formatting
 * Enforces explicit DD-MM-YYYY rendering on both server (Node.js) and client environments without hydration mismatches.
 */

export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  let date: Date;
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    if (!cleanStr) return '—';

    // Check YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    const isoParts = cleanStr.split('T')[0].split('-');
    if (isoParts.length === 3 && isoParts[0].length === 4) {
      const year = parseInt(isoParts[0], 10);
      const month = parseInt(isoParts[1], 10) - 1;
      const day = parseInt(isoParts[2], 10);
      date = new Date(year, month, day);
    } else {
      // Check DD-MM-YYYY or DD/MM/YYYY
      const dmParts = cleanStr.split(/[/-]/);
      if (dmParts.length === 3 && dmParts[0].length <= 2 && dmParts[2].length === 4) {
        const day = parseInt(dmParts[0], 10);
        const month = parseInt(dmParts[1], 10) - 1;
        const year = parseInt(dmParts[2], 10);
        date = new Date(year, month, day);
      } else {
        date = new Date(cleanStr);
      }
    }
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatDisplayDate(dateInput: string | Date | null | undefined): string {
  return formatDate(dateInput);
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  let date: Date;
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    const isoParts = cleanStr.split('T')[0].split('-');
    if (isoParts.length === 3 && isoParts[0].length === 4 && !cleanStr.includes('T')) {
      const year = parseInt(isoParts[0], 10);
      const month = parseInt(isoParts[1], 10) - 1;
      const day = parseInt(isoParts[2], 10);
      date = new Date(year, month, day);
    } else {
      date = new Date(cleanStr);
    }
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year}, ${hours}:${minutes}`;
}

/**
 * Formats an exact timestamp (e.g. log entry / audit timestamp) in 12-hour AM/PM format.
 * Format: "DD-MM-YYYY, hh:mm:ss A" (e.g. "02-09-2026, 04:35:18 PM")
 * When includeSeconds is false: "DD-MM-YYYY, hh:mm A" (e.g. "02-09-2026, 04:35 PM")
 */
export function formatExactTimestamp(
  dateInput: string | Date | null | undefined,
  includeSeconds: boolean = true
): string {
  if (!dateInput) return '—';
  let date: Date;
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    if (!cleanStr) return '—';
    date = new Date(cleanStr);
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  let rawHours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const period = rawHours >= 12 ? 'PM' : 'AM';
  let hours = rawHours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');

  if (includeSeconds) {
    return `${day}-${month}-${year}, ${hoursStr}:${minutes}:${seconds} ${period}`;
  }
  return `${day}-${month}-${year}, ${hoursStr}:${minutes} ${period}`;
}

/**
 * Splits an exact timestamp into separate Time and Date strings.
 * Format: { time: "06:15:24 PM", date: "02-09-2026" } or null if invalid.
 */
export function splitExactTimestamp(
  dateInput: string | Date | null | undefined,
  includeSeconds: boolean = true
): { time: string; date: string } | null {
  if (!dateInput) return null;
  let date: Date;
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    if (!cleanStr) return null;
    date = new Date(cleanStr);
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return null;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  let rawHours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const period = rawHours >= 12 ? 'PM' : 'AM';
  let hours = rawHours % 12;
  if (hours === 0) hours = 12;
  const hoursStr = String(hours).padStart(2, '0');

  const time = includeSeconds
    ? `${hoursStr}:${minutes}:${seconds} ${period}`
    : `${hoursStr}:${minutes} ${period}`;
  const dateStr = `${day}-${month}-${year}`;

  return { time, date: dateStr };
}



export function formatTimeAgo(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  let date: Date;
  if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(date);
}

/**
 * Formats a date into an ultra-compact relative time representation.
 * Examples: "1min", "10min", "1h", "20h", "1d", "7d", "1m", "10m", "1y".
 */
export function formatTinyRelativeTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '—';
  let date: Date;
  if (typeof dateInput === 'string') {
    const cleanStr = dateInput.trim();
    if (!cleanStr) return '—';
    date = new Date(cleanStr);
  } else {
    date = dateInput;
  }
  if (isNaN(date.getTime())) return '—';

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffMin < 1) return '1min';
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 30) return `${diffDay}d`;
  if (diffMonth < 12) return `${diffMonth}m`;
  return `${diffYear}y`;
}

/**
 * Formats any raw time input (e.g. "06:00:00", "18:00:00", "18:30", "6:00", "06:00 AM")
 * into user-friendly 12-hour format with AM/PM (e.g. "06:00 AM", "06:00 PM").
 */
export function formatTo12Hour(timeStr?: string | null): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim().toUpperCase();
  if (!trimmed) return '';

  // Already formatted with AM/PM (e.g. "06:00 AM", "6:00PM", "010:030 AM", "06:00:00 AM")
  const ampmMatch = trimmed.match(/^(\d{1,3}):(\d{1,3})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    const rawH = parseInt(ampmMatch[1], 10);
    const rawM = parseInt(ampmMatch[2], 10);
    const p = ampmMatch[3].toUpperCase();
    const h = isNaN(rawH) ? 0 : rawH;
    const m = isNaN(rawM) ? 0 : rawM;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
  }

  // 24-hour format (e.g. "06:00:00", "18:00:00", "18:30", "6:00", "010:030")
  const match24 = trimmed.match(/^(\d{1,3}):(\d{1,3})(?::\d{2})?$/);
  if (match24) {
    let hours = parseInt(match24[1], 10);
    const rawM = parseInt(match24[2], 10);
    const minutes = isNaN(rawM) ? 0 : rawM;
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
  }

  return trimmed;
}

/**
 * Formats a start and end time range in 12-hour AM/PM format (e.g. "06:00 AM — 06:00 PM").
 */
export function formatShiftTimingRange(startStr?: string | null, endStr?: string | null): string {
  const s = formatTo12Hour(startStr) || '06:00 AM';
  const e = formatTo12Hour(endStr) || '02:00 PM';
  return `${s} — ${e}`;
}

/**
 * Formats a start and end time range in compact 12-hour AM/PM format for tables/exports (e.g. "06:00AM-06:00PM").
 */
export function formatCompactTiming(startStr?: string | null, endStr?: string | null): string {
  const formattedStart = formatTo12Hour(startStr) || '06:00 AM';
  const formattedEnd = formatTo12Hour(endStr) || '02:00 PM';
  return `${formattedStart.replace(/\s+/g, '')}-${formattedEnd.replace(/\s+/g, '')}`;
}

export interface ShiftTimingComputation {
  startDateTime: Date | null;
  endDateTime: Date | null;
  resolvedStartDate: string;
  resolvedEndDate: string;
  resolvedRangeFormatted: string; // e.g. "31 Aug 08:00 PM → 01 Sep 06:00 AM"
  durationHours: number;
  durationMinutes: number;
  durationFormatted: string; // e.g. "10h 00m"
  isOvernight: boolean;
  overtimeHours: number;
  normalWorkingHours: number;
  breakHours: number;
  isValid: boolean;
  errorMessage: string | null;
  isFutureEnd?: boolean;
}

/**
 * Adds days to a YYYY-MM-DD date string.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const parts = dateStr.split('T')[0].split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parses time string (e.g. "08:00 AM", "05:30 PM", "17:00") into minutes from midnight (0..1439).
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const match = str.match(/^(\d{1,3}):(\d{1,3})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];

  if (period) {
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}

/**
 * Parses date string (YYYY-MM-DD) and 12/24-hour time string (e.g. "08:00 PM") into a local Date object.
 */
export function parseDateTimeToDate(dateStr?: string | null, timeStr?: string | null): Date | null {
  if (!dateStr || !timeStr) return null;
  const dParts = dateStr.split('T')[0].split('-').map(Number);
  if (dParts.length < 3 || isNaN(dParts[0]) || isNaN(dParts[1]) || isNaN(dParts[2])) return null;

  const tTrimmed = timeStr.trim().toUpperCase();
  const match = tTrimmed.match(/^(\d{1,3}):(\d{1,3})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];

  if (period) {
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  }

  return new Date(dParts[0], dParts[1] - 1, dParts[2], hours, minutes, 0, 0);
}

/**
 * Formats a resolved shift datetime range for secondary display.
 * e.g. "31 Aug 08:00 PM → 01 Sep 06:00 AM" or "31 Aug 06:00 AM → 31 Aug 02:00 PM"
 */
export function formatResolvedRange(
  startDateStr: string,
  startTimeStr: string,
  endDateStr: string,
  endTimeStr: string
): string {
  const formatShortDate = (dStr: string) => {
    const parts = dStr.split('T')[0].split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      const day = d.getDate();
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      return `${day} ${month}`;
    }
    return formatDate(dStr);
  };

  const sDate = formatShortDate(startDateStr);
  const eDate = formatShortDate(endDateStr);
  const sTime = formatTo12Hour(startTimeStr) || '06:00 AM';
  const eTime = formatTo12Hour(endTimeStr) || '02:00 PM';

  return `${sDate} ${sTime} → ${eDate} ${eTime}`;
}

/**
 * Computes shift duration, overnight flag, overtime hours, normal working hours,
 * automatically derives End Date for overnight shifts (when End Time < Start Time),
 * and validates that Start Time and End Time are not identical.
 */
export function computeShiftTiming(params: {
  startDate?: string | null;
  logDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  manualOvertime?: number;
  disallowFutureEnd?: boolean;
  currentTimestamp?: number;
}): ShiftTimingComputation {
  const { startDate, logDate, startTime, endDate, endTime, manualOvertime } = params;
  const effectiveStartDate = startDate || logDate || new Date().toISOString().split('T')[0];

  if (!startTime || !endTime) {
    return {
      startDateTime: null,
      endDateTime: null,
      resolvedStartDate: effectiveStartDate,
      resolvedEndDate: effectiveStartDate,
      resolvedRangeFormatted: '',
      durationHours: 0,
      durationMinutes: 0,
      durationFormatted: '0h 00m',
      isOvernight: false,
      overtimeHours: 0,
      normalWorkingHours: 0,
      breakHours: 1.0,
      isValid: false,
      errorMessage: 'Start time and end time are required.',
    };
  }

  const sMins = parseTimeToMinutes(startTime);
  const eMins = parseTimeToMinutes(endTime);

  if (sMins === null || eMins === null) {
    return {
      startDateTime: null,
      endDateTime: null,
      resolvedStartDate: effectiveStartDate,
      resolvedEndDate: effectiveStartDate,
      resolvedRangeFormatted: '',
      durationHours: 0,
      durationMinutes: 0,
      durationFormatted: '0h 00m',
      isOvernight: false,
      overtimeHours: 0,
      normalWorkingHours: 0,
      breakHours: 1.0,
      isValid: false,
      errorMessage: 'Invalid time format.',
    };
  }

  // Edge case: Same Start Time and End Time (e.g. 08:00 AM -> 08:00 AM)
  if (sMins === eMins && (!endDate || endDate === effectiveStartDate)) {
    const startDateTime = parseDateTimeToDate(effectiveStartDate, startTime);
    return {
      startDateTime,
      endDateTime: startDateTime,
      resolvedStartDate: effectiveStartDate,
      resolvedEndDate: effectiveStartDate,
      resolvedRangeFormatted: formatResolvedRange(effectiveStartDate, startTime, effectiveStartDate, endTime),
      durationHours: 0,
      durationMinutes: 0,
      durationFormatted: '0h 00m',
      isOvernight: false,
      overtimeHours: 0,
      normalWorkingHours: 0,
      breakHours: 1.0,
      isValid: false,
      errorMessage: 'Start time and end time cannot be identical.',
    };
  }

  // Automatically derive End Date if not explicitly passed or if matching start date
  let effectiveEndDate = endDate || effectiveStartDate;
  let isOvernight = false;

  if (!endDate || endDate === effectiveStartDate) {
    if (eMins < sMins) {
      // Overnight shift: moves to next calendar day
      effectiveEndDate = addDaysToDateStr(effectiveStartDate, 1);
      isOvernight = true;
    } else {
      // Same-day shift
      effectiveEndDate = effectiveStartDate;
      isOvernight = false;
    }
  } else {
    // Explicit endDate passed
    isOvernight = effectiveEndDate !== effectiveStartDate;
  }

  const startDateTime = parseDateTimeToDate(effectiveStartDate, startTime);
  const endDateTime = parseDateTimeToDate(effectiveEndDate, endTime);

  if (!startDateTime || !endDateTime) {
    return {
      startDateTime,
      endDateTime,
      resolvedStartDate: effectiveStartDate,
      resolvedEndDate: effectiveEndDate,
      resolvedRangeFormatted: '',
      durationHours: 0,
      durationMinutes: 0,
      durationFormatted: '0h 00m',
      isOvernight,
      overtimeHours: 0,
      normalWorkingHours: 0,
      breakHours: 1.0,
      isValid: false,
      errorMessage: 'Invalid date or time format.',
    };
  }

  const diffMs = endDateTime.getTime() - startDateTime.getTime();
  if (diffMs <= 0) {
    return {
      startDateTime,
      endDateTime,
      resolvedStartDate: effectiveStartDate,
      resolvedEndDate: effectiveEndDate,
      resolvedRangeFormatted: formatResolvedRange(effectiveStartDate, startTime, effectiveEndDate, endTime),
      durationHours: 0,
      durationMinutes: 0,
      durationFormatted: '0h 00m',
      isOvernight,
      overtimeHours: 0,
      normalWorkingHours: 0,
      breakHours: 1.0,
      isValid: false,
      errorMessage: 'End time must be after start time.',
    };
  }

  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  const durationFormatted = `${hours}h ${String(mins).padStart(2, '0')}m`;
  const durationHours = Math.round((diffMinutes / 60) * 10) / 10;

  const breakHours = 1.0;
  const autoOvertime = Math.max(0, Math.round((durationHours - (8.0 + breakHours)) * 10) / 10);
  const overtimeHours = manualOvertime !== undefined && !isNaN(manualOvertime) ? manualOvertime : autoOvertime;
  const normalWorkingHours = Math.max(0, Math.round((durationHours - overtimeHours - breakHours) * 10) / 10);

  if (diffMinutes > 24 * 60) {
    return {
      startDateTime,
      endDateTime,
      resolvedStartDate: effectiveStartDate,
      resolvedEndDate: effectiveEndDate,
      resolvedRangeFormatted: formatResolvedRange(effectiveStartDate, startTime, effectiveEndDate, endTime),
      durationHours,
      durationMinutes: diffMinutes,
      durationFormatted,
      isOvernight,
      overtimeHours,
      normalWorkingHours,
      breakHours,
      isValid: false,
      errorMessage: 'Shift cannot exceed 24 hours.',
    };
  }

  const nowMs = params.currentTimestamp || Date.now();
  const isFutureEnd = Boolean(endDateTime && endDateTime.getTime() > nowMs);

  if (params.disallowFutureEnd && isFutureEnd) {
    return {
      startDateTime,
      endDateTime,
      resolvedStartDate: effectiveStartDate,
      resolvedEndDate: effectiveEndDate,
      resolvedRangeFormatted: formatResolvedRange(effectiveStartDate, startTime, effectiveEndDate, endTime),
      durationHours,
      durationMinutes: diffMinutes,
      durationFormatted,
      isOvernight,
      overtimeHours,
      normalWorkingHours,
      breakHours,
      isValid: false,
      errorMessage: 'Cannot log before shift end.',
      isFutureEnd: true,
    };
  }

  return {
    startDateTime,
    endDateTime,
    resolvedStartDate: effectiveStartDate,
    resolvedEndDate: effectiveEndDate,
    resolvedRangeFormatted: formatResolvedRange(effectiveStartDate, startTime, effectiveEndDate, endTime),
    durationHours,
    durationMinutes: diffMinutes,
    durationFormatted,
    isOvernight,
    overtimeHours,
    normalWorkingHours,
    breakHours,
    isValid: true,
    errorMessage: null,
    isFutureEnd,
  };
}

/**
 * Validates whether a shift end datetime is in the future.
 * Optionally allows a small grace period (in minutes) for network lag / clock skew.
 */
export function isShiftEndInFuture(
  endDateTime: Date | null | undefined,
  graceMinutes: number = 0
): boolean {
  if (!endDateTime) return false;
  return endDateTime.getTime() > Date.now() + graceMinutes * 60 * 1000;
}

/**
 * Checks whether two half-open datetime intervals [start1, end1) and [start2, end2) overlap.
 * Exact handover where end1 === start2 returns false (no overlap, valid handover).
 */
export function checkIntervalOverlap(
  start1: Date | null,
  end1: Date | null,
  start2: Date | null,
  end2: Date | null
): boolean {
  if (!start1 || !end1 || !start2 || !end2) return false;
  return Math.max(start1.getTime(), start2.getTime()) < Math.min(end1.getTime(), end2.getTime());
}

/**
 * Finds the latest machine hour log recorded for a machine by its end datetime.
 */
export function findLatestMachineLogTimeline(
  logs: any[],
  machineId: string,
  excludeLogId?: string
): {
  latestLog: any | null;
  endDateTime: Date | null;
  formattedEndTime: string;
  formattedEndDate: string;
  formattedRange: string;
} {
  if (!logs || logs.length === 0 || !machineId) {
    return {
      latestLog: null,
      endDateTime: null,
      formattedEndTime: '',
      formattedEndDate: '',
      formattedRange: '',
    };
  }

  const machineLogs = logs.filter(
    (l) => l.machine_id === machineId && (!excludeLogId || l.id !== excludeLogId)
  );

  if (machineLogs.length === 0) {
    return {
      latestLog: null,
      endDateTime: null,
      formattedEndTime: '',
      formattedEndDate: '',
      formattedRange: '',
    };
  }

  let latestLog: any = null;
  let latestEndMs = -1;
  let latestEndDateObj: Date | null = null;

  for (const log of machineLogs) {
    let endDateObj: Date | null = null;
    if (log.end_datetime) {
      endDateObj = new Date(log.end_datetime);
    } else if (log.log_date && log.end_time) {
      const isOvernight = log.start_time && log.end_time && parseTimeToMinutes(log.end_time)! <= parseTimeToMinutes(log.start_time)!;
      const targetDate = log.end_date || (isOvernight ? addDaysToDateStr(log.log_date, 1) : log.log_date);
      endDateObj = parseDateTimeToDate(targetDate, log.end_time);
    }

    if (endDateObj && !isNaN(endDateObj.getTime())) {
      if (endDateObj.getTime() > latestEndMs) {
        latestEndMs = endDateObj.getTime();
        latestLog = log;
        latestEndDateObj = endDateObj;
      }
    }
  }

  if (!latestLog || !latestEndDateObj) {
    return {
      latestLog: machineLogs[0],
      endDateTime: null,
      formattedEndTime: '',
      formattedEndDate: '',
      formattedRange: '',
    };
  }

  const formattedEndTime = formatTo12Hour(latestLog.end_time) || latestEndDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedEndDate = formatDate(latestLog.end_date || latestLog.log_date || latestEndDateObj);
  const startT = formatTo12Hour(latestLog.start_time) || '06:00 AM';
  const formattedRange = `${startT} — ${formattedEndTime}`;

  return {
    latestLog,
    endDateTime: latestEndDateObj,
    formattedEndTime,
    formattedEndDate,
    formattedRange,
  };
}

export interface BreakdownDurationComputation {
  durationFormatted: string; // e.g. "55min", "3h:55min", "2h"
  fullBreakdownString: string; // e.g. "02:30 PM - 03:25 PM (55min)", "02:30 PM - 06:25 PM (3h:55min)"
  hours: number;
  minutes: number;
  totalMinutes: number;
  durationDecimalHours: number; // e.g. 0.92, 3.92
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Computes breakdown duration, formatted label, and timestamp range between Start Time and End Time.
 * Formats:
 * - When < 60 mins: "(55min)" -> "02:30 PM - 03:25 PM (55min)"
 * - When >= 60 mins with minutes: "(3h:55min)" -> "02:30 PM - 06:25 PM (3h:55min)"
 * - When exact hours: "(2h)" -> "02:30 PM - 04:30 PM (2h)"
 * Supports overnight breakdowns crossing midnight safely.
 */
export function computeBreakdownDuration(
  startTime?: string | null,
  endTime?: string | null
): BreakdownDurationComputation {
  if (!startTime || !endTime) {
    return {
      durationFormatted: '',
      fullBreakdownString: '',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      durationDecimalHours: 0,
      isValid: false,
      errorMessage: 'Breakdown start time and end time are required.',
    };
  }

  const sMins = parseTimeToMinutes(startTime);
  const eMins = parseTimeToMinutes(endTime);

  if (sMins === null || eMins === null) {
    return {
      durationFormatted: '',
      fullBreakdownString: '',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      durationDecimalHours: 0,
      isValid: false,
      errorMessage: 'Invalid breakdown time format.',
    };
  }

  if (sMins === eMins) {
    return {
      durationFormatted: '0min',
      fullBreakdownString: '',
      hours: 0,
      minutes: 0,
      totalMinutes: 0,
      durationDecimalHours: 0,
      isValid: false,
      errorMessage: 'Breakdown start time and end time cannot be identical.',
    };
  }

  // Handle standard interval and overnight interval (crossing midnight)
  let totalMinutes = eMins - sMins;
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationDecimalHours = Math.round((totalMinutes / 60) * 100) / 100;

  let durationFormatted = '';
  if (hours === 0) {
    durationFormatted = `${minutes}min`;
  } else if (minutes === 0) {
    durationFormatted = `${hours}h`;
  } else {
    durationFormatted = `${hours}h:${minutes}min`;
  }

  const formattedStart = formatTo12Hour(startTime) || startTime.trim();
  const formattedEnd = formatTo12Hour(endTime) || endTime.trim();
  const fullBreakdownString = `${formattedStart} - ${formattedEnd} (${durationFormatted})`;

  return {
    durationFormatted,
    fullBreakdownString,
    hours,
    minutes,
    totalMinutes,
    durationDecimalHours,
    isValid: true,
  };
}

/**
 * Parses breakdown string or remarks to extract start time, end time, and duration formatted text.
 * Matches:
 * - "02:30 PM - 03:25 PM (55min)"
 * - "[Breakdown Duration: 02:30 PM - 03:25 PM (55min)]"
 * - "02:30Pm-03:25pm(55min)"
 * - Legacy format "[Breakdown Duration: 2h 30m]"
 */
export function parseBreakdownString(rawString?: string | null): {
  startTime?: string;
  endTime?: string;
  durationText?: string;
  durationFormatted?: string;
  fullBreakdownString?: string;
} | null {
  if (!rawString) return null;
  const clean = rawString.trim();

  // Pattern 1: Range with parentheses e.g. "02:30 PM - 03:25 PM (55min)" or with "[Breakdown Duration: ...]"
  const rangeMatch = clean.match(
    /(?:\[Breakdown(?:\s+Duration)?:\s*)?(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*\(([^)]+)\)\]?/i
  );
  if (rangeMatch) {
    const startTime = formatTo12Hour(rangeMatch[1]) || rangeMatch[1].trim();
    const endTime = formatTo12Hour(rangeMatch[2]) || rangeMatch[2].trim();
    const durationFormatted = rangeMatch[3].trim();
    return {
      startTime,
      endTime,
      durationText: durationFormatted,
      durationFormatted,
      fullBreakdownString: `${startTime} - ${endTime} (${durationFormatted})`,
    };
  }

  // Pattern 2: Legacy format e.g. "[Breakdown Duration: 2h 30m]" or "Breakdown (2h 30m)"
  const legacyMatch = clean.match(
    /(?:\[Breakdown(?:\s+Duration)?:\s*|Breakdown\s*\()?\s*(\d+h(?:\s*\d+m)?|\d+m)\)?\]?/i
  );
  if (legacyMatch) {
    return {
      durationText: legacyMatch[1].trim(),
      durationFormatted: legacyMatch[1].trim(),
      fullBreakdownString: legacyMatch[1].trim(),
    };
  }

  return null;
}
