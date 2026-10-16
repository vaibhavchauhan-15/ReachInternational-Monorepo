/**
 * Shift Overlap & Time Range Interval Calculations
 * Determines shift minute intervals across midnight boundaries and verifies collision/overlap.
 */

export type MinuteRange = [number, number];

/**
 * Parses time string in "HH:MM", "HH:MM:SS", "HH:MM AM/PM" format into minutes from midnight (0..1439).
 */
export function parseShiftTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[4]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/**
 * Converts a start and end time string (e.g. "08:00", "08:00:00", "08:00 AM")
 * into normalized 24-hour minute ranges [startMinute, endMinute].
 * If a shift crosses midnight (e.g. 20:00 to 08:00), it produces two disjoint ranges:
 * [[1200, 1440], [0, 480]].
 */
export function shiftToMinuteRanges(startStr?: string | null, endStr?: string | null): MinuteRange[] {
  if (!startStr || !endStr) return [];
  const start = parseShiftTimeToMinutes(startStr);
  const end = parseShiftTimeToMinutes(endStr);
  if (start === null || end === null || start === end) return [];
  if (start < end) {
    return [[start, end]];
  }
  return [[start, 1440], [0, end]];
}

/**
 * Determines whether two sets of minute ranges overlap.
 */
export function doRangesOverlap(ranges1: MinuteRange[], ranges2: MinuteRange[]): boolean {
  for (const [s1, e1] of ranges1) {
    for (const [s2, e2] of ranges2) {
      if (Math.max(s1, s2) < Math.min(e1, e2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks whether two shifts overlap in time.
 */
export function checkShiftIntervalOverlap(
  shiftA: { start?: string | null; end?: string | null },
  shiftB: { start?: string | null; end?: string | null }
): boolean {
  const rangesA = shiftToMinuteRanges(shiftA.start, shiftA.end);
  const rangesB = shiftToMinuteRanges(shiftB.start, shiftB.end);
  if (rangesA.length === 0 || rangesB.length === 0) return false;
  return doRangesOverlap(rangesA, rangesB);
}
