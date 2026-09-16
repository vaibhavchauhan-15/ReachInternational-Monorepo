/**
 * ReachInternational Operations Date & Month Architecture
 *
 * Provides a canonical, IST-safe date and month resolution engine
 * for the entire Operations domain across Web (Next.js App Router RSC,
 * Server Actions, Edge) and Mobile (React Native / Expo).
 *
 * Eliminates UTC calendar day rollback between 12:00 AM and 05:29 AM IST,
 * and ensures all database queries target exact ISO date boundaries for
 * composite B-tree index scans on `(entity_id, log_date DESC)`.
 */

import { getISTDateString } from "./date";

export interface OperationsDateRangeInput {
  month?: string | null;
  customStart?: string | null;
  customEnd?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  year?: number | null;
}

export interface OperationsDateRangeResult {
  startDate: string | null;
  endDate: string | null;
  endDateInclusive: string | null;
  endOperator: "lt" | "lte";
  month: string;
  isCustom: boolean;
  isAll: boolean;
}

export interface OperationsMonthOption {
  value: string;
  label: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * Extracts year, month (1-12), and day (1-31) in India Standard Time (Asia/Kolkata).
 */
export function getISTYearMonthDay(dateInput?: Date | string | number | null): {
  year: number;
  month: number;
  day: number;
} {
  const istStr = getISTDateString(dateInput); // YYYY-MM-DD
  const [y, m, d] = istStr.split("-").map(Number);
  return {
    year: y || new Date().getFullYear(),
    month: m || new Date().getMonth() + 1,
    day: d || new Date().getDate(),
  };
}

/**
 * Returns current two-digit month string ("01" to "12") in IST.
 */
export function getOperationsCurrentMonth(): string {
  const { month } = getISTYearMonthDay();
  return String(month).padStart(2, "0");
}

/**
 * Returns current four-digit year in IST.
 */
export function getOperationsCurrentYear(): number {
  const { year } = getISTYearMonthDay();
  return year;
}

/**
 * Returns the exact number of days in a month for a given year.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Centralized, IST-aware resolver for operational date boundaries.
 * 
 * Accurately handles:
 * - Direct ISO `startDate` and `endDate` parameters
 * - Custom date ranges (`month: "custom", customStart, customEnd`)
 * - Entire historical queries (`month: "all"`)
 * - Current month (`month: "current"`)
 * - Specific month indices (`month: "01"` through `"12"`)
 */
export function resolveOperationsDateRange(
  params: OperationsDateRangeInput = {}
): OperationsDateRangeResult {
  const { year: currentISTYear, month: currentISTMonth } = getISTYearMonthDay();
  const effectiveYear = params.year || currentISTYear;

  // 1. Direct explicit ISO date boundaries take precedence
  const cleanStart = params.startDate ? String(params.startDate).trim() : null;
  const cleanEnd = params.endDate ? String(params.endDate).trim() : null;

  if (cleanStart || cleanEnd) {
    return {
      startDate: cleanStart,
      endDate: cleanEnd,
      endDateInclusive: cleanEnd,
      endOperator: "lte",
      month: params.month || "custom",
      isCustom: true,
      isAll: false,
    };
  }

  // 2. Custom date range (query exactly that range: start -> end inclusive)
  if (params.month === "custom") {
    const s = params.customStart ? String(params.customStart).trim() : null;
    const e = params.customEnd ? String(params.customEnd).trim() : null;
    return {
      startDate: s,
      endDate: e,
      endDateInclusive: e,
      endOperator: "lte",
      month: "custom",
      isCustom: true,
      isAll: false,
    };
  }

  // 3. All dates (unbounded)
  if (params.month === "all") {
    return {
      startDate: null,
      endDate: null,
      endDateInclusive: null,
      endOperator: "lte",
      month: "all",
      isCustom: false,
      isAll: true,
    };
  }

  // 4. Month selection (e.g. September 2026 -> query only 2026-09-01 -> 2026-10-01)
  let targetMonthNum = currentISTMonth;
  let targetMonthStr = String(currentISTMonth).padStart(2, "0");

  if (params.month && params.month !== "current") {
    const parsed = parseInt(params.month, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
      targetMonthNum = parsed;
      targetMonthStr = String(parsed).padStart(2, "0");
    }
  }

  // Next month boundary for half-open index query: [start_of_month, start_of_next_month)
  const nextMonthNum = targetMonthNum === 12 ? 1 : targetMonthNum + 1;
  const nextMonthYear = targetMonthNum === 12 ? effectiveYear + 1 : effectiveYear;
  const nextMonthStr = String(nextMonthNum).padStart(2, "0");

  const startDate = `${effectiveYear}-${targetMonthStr}-01`;
  const endDate = `${nextMonthYear}-${nextMonthStr}-01`; // e.g. 2026-10-01 for September 2026

  // Inclusive last day for legacy/RPC queries
  const daysInMonth = getDaysInMonth(effectiveYear, targetMonthNum);
  const endDateInclusive = `${effectiveYear}-${targetMonthStr}-${String(daysInMonth).padStart(2, "0")}`;

  return {
    startDate,
    endDate,
    endDateInclusive,
    endOperator: "lt",
    month: targetMonthStr,
    isCustom: false,
    isAll: false,
  };
}

/**
 * Pre-computes month options with localized labels and exact ISO boundaries.
 */
export function getOperationsMonthOptions(count: number = 12): OperationsMonthOption[] {
  const { year: curYear, month: curMonth } = getISTYearMonthDay();
  const options: OperationsMonthOption[] = [];

  for (let i = 0; i < count; i++) {
    let m = curMonth - i;
    let y = curYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const mStr = String(m).padStart(2, "0");
    const lastDay = getDaysInMonth(y, m);
    const label = `${MONTH_NAMES[m - 1]} ${y}`;

    options.push({
      value: mStr,
      label,
      year: y,
      month: m,
      startDate: `${y}-${mStr}-01`,
      endDate: `${y}-${mStr}-${String(lastDay).padStart(2, "0")}`,
    });
  }

  return options;
}

/**
 * Fast ISO date range containment checker.
 */
export function isDateInOperationsRange(
  dateStr: string,
  startDate?: string | null,
  endDate?: string | null
): boolean {
  if (!dateStr) return false;
  const isoDate = dateStr.slice(0, 10);
  if (startDate && isoDate < startDate) return false;
  if (endDate && isoDate > endDate) return false;
  return true;
}
