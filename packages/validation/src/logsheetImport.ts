import { z } from "zod";
import {
  computeShiftTiming,
  computeBreakdownDuration,
  formatTo12Hour,
} from "@reachinternational/utils";

/**
 * Canonical model for the Admin Bulk Machine Logsheet (Operation Log) Excel import.
 *
 * SINGLE SOURCE OF TRUTH: the column definitions in this module drive
 *   1. the generated Excel template (Logsheet Data headers, dropdowns, examples),
 *   2. the Instructions worksheet,
 *   3. the Data Dictionary worksheet,
 *   4. the parsing/validation engine, and
 *   5. the preview table columns.
 *
 * Columns are derived 1:1 from the existing `public.machine_hour_logs` data model
 * and the manual shift entry flow (`submitOperatorHourLogAction`). No arbitrary
 * fields are introduced and no trusted database identifiers (machine UUIDs,
 * operator UUIDs, assignment ids) are ever accepted from the spreadsheet.
 */

export const LOGSHEET_IMPORT_TEMPLATE_VERSION = "1.0";

export const LOGSHEET_IMPORT_DATA_SHEET = "Logsheet Data";
export const LOGSHEET_IMPORT_INSTRUCTIONS_SHEET = "Instructions";
export const LOGSHEET_IMPORT_DICTIONARY_SHEET = "Data Dictionary";

/** Maximum importable data rows per workbook (documented template limit). */
export const LOGSHEET_IMPORT_MAX_ROWS = 1000;

/** Maximum file size in bytes for import (10MB). */
export const LOGSHEET_IMPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Maximum decimal places accepted for HMR readings and hour values. */
export const LOGSHEET_IMPORT_MAX_DECIMALS = 2;

/** Machine condition values accepted by the existing manual entry schema. */
export const LOGSHEET_MACHINE_CONDITIONS = [
  "good",
  "fair",
  "needs_attention",
  "breakdown",
] as const;
export type LogsheetMachineCondition = (typeof LOGSHEET_MACHINE_CONDITIONS)[number];

export type LogsheetImportColumnKey =
  | "log_date"
  | "operator_employee_id"
  | "operator_name"
  | "shift_code"
  | "start_time"
  | "end_time"
  | "start_meter"
  | "end_meter"
  | "overtime_hours"
  | "machine_condition"
  | "is_breakdown"
  | "breakdown_start_time"
  | "breakdown_end_time"
  | "remarks";

export interface LogsheetImportColumnDef {
  key: LogsheetImportColumnKey;
  /** Exact header text used in the template and matched by the parser. */
  header: string;
  required: boolean;
  type: "date" | "time" | "number" | "text" | "boolean" | "enum";
  /** Accepted format shown to administrators. */
  format: string;
  description: string;
  /** Human-readable validation rule shown in the Data Dictionary. */
  validationRule: string;
  example: string;
  maxLength?: number;
  options?: readonly string[];
  /** Marks the operator-identity pair (Employee ID OR exact Name). */
  conditionallyRequired?: boolean;
}

export const LOGSHEET_IMPORT_COLUMNS: readonly LogsheetImportColumnDef[] = [
  {
    key: "log_date",
    header: "Log Date",
    required: true,
    type: "date",
    format: "YYYY-MM-DD (also accepts DD/MM/YYYY, DD-MM-YYYY, DD Mon YYYY)",
    description: "Work date of the machine operation log (Asia/Kolkata calendar day).",
    validationRule:
      "Mandatory. Must be a valid calendar date and must not be in the future. Historical dates are allowed for back-filling.",
    example: "2025-01-15",
  },
  {
    key: "operator_employee_id",
    header: "Operator Employee ID",
    required: true,
    conditionallyRequired: true,
    type: "text",
    format: "Text, e.g. EMP-0338",
    description:
      "Employee ID of the operator who ran the machine (exact match against the employee record).",
    validationRule:
      "Mandatory unless Operator Name is filled. Must match exactly one employee ID. The name is used to cross-check when both are provided.",
    example: "EMP-0338",
    maxLength: 100,
  },
  {
    key: "operator_name",
    header: "Operator Name",
    required: false,
    conditionallyRequired: true,
    type: "text",
    format: "Text, exact full name as on the employee record",
    description:
      "Full name of the operator. Used for cross-checking the Employee ID, or as fallback when Employee ID is blank.",
    validationRule:
      "Optional. When provided with an Employee ID it must match that record (mismatches are flagged). When Employee ID is blank, the name must match exactly one operator (partial matches are never accepted).",
    example: "Rohit Singh",
    maxLength: 200,
  },
  {
    key: "shift_code",
    header: "Shift Code",
    required: false,
    type: "text",
    format: "Text up to 20 characters, e.g. S1 / S2 / S3 / S4 / A / B",
    description:
      "Shift identifier used for duplicate detection (Machine + Date + Shift must be unique).",
    validationRule:
      "Optional. When blank it is auto-derived from Start Time using the standard shift windows (00-06 S4, 06-12 S1, 12-18 S2, 18-24 S3). The resolved value is shown in the preview.",
    example: "S1",
    maxLength: 20,
  },
  {
    key: "start_time",
    header: "Start Time",
    required: true,
    type: "time",
    format: "HH:MM (24-hour) or HH:MM AM/PM",
    description: "Shift start time on the log date.",
    validationRule:
      "Mandatory. Must be a valid time and must differ from End Time. Overnight shifts are supported (End Time earlier than Start Time rolls into the next day).",
    example: "08:00",
  },
  {
    key: "end_time",
    header: "End Time",
    required: true,
    type: "time",
    format: "HH:MM (24-hour) or HH:MM AM/PM",
    description: "Shift end time (may be on the next calendar day for overnight shifts).",
    validationRule:
      "Mandatory. Must be a valid time. The resulting shift end timestamp must not be in the future and the shift must not exceed 24 hours.",
    example: "16:00",
  },
  {
    key: "start_meter",
    header: "Start HMR",
    required: true,
    type: "number",
    format: "Number with up to 2 decimals, e.g. 1500.5",
    description: "Hour Meter Reading (HMR) at shift start.",
    validationRule:
      "Mandatory. Non-negative, maximum 2 decimal places. Must be less than or equal to End HMR.",
    example: "1500.5",
  },
  {
    key: "end_meter",
    header: "End HMR",
    required: true,
    type: "number",
    format: "Number with up to 2 decimals, e.g. 1508.5",
    description: "Hour Meter Reading (HMR) at shift end. Running hours = End HMR - Start HMR.",
    validationRule:
      "Mandatory. Non-negative, maximum 2 decimal places. Must be >= Start HMR and the difference must not exceed 24 hours.",
    example: "1508.5",
  },
  {
    key: "overtime_hours",
    header: "Overtime Hours",
    required: false,
    type: "number",
    format: "Number with up to 2 decimals, e.g. 1.5",
    description:
      "Overtime hours worked. Leave blank to auto-calculate (hours beyond 8 per shift, same as the manual entry form).",
    validationRule:
      "Optional. Non-negative, max 16, and must not exceed the shift duration. Blank values are auto-calculated and the resolved value is shown in the preview.",
    example: "1.5",
  },
  {
    key: "machine_condition",
    header: "Machine Condition",
    required: false,
    type: "enum",
    format: "good | fair | needs_attention | breakdown",
    description: "Condition of the machine during the shift.",
    validationRule:
      "Optional (defaults to good). Must be one of the listed values. When Breakdown? is Yes the condition is recorded as breakdown, matching the manual entry behaviour.",
    example: "good",
    options: LOGSHEET_MACHINE_CONDITIONS,
  },
  {
    key: "is_breakdown",
    header: "Breakdown?",
    required: false,
    type: "boolean",
    format: "Yes / No (also accepts Y/N, True/False, 1/0)",
    description: "Whether the machine suffered a breakdown during the shift.",
    validationRule:
      "Optional (defaults to No). When Yes, Breakdown Start and Breakdown End become mandatory and the breakdown must fit inside the shift duration.",
    example: "No",
  },
  {
    key: "breakdown_start_time",
    header: "Breakdown Start",
    required: false,
    type: "time",
    format: "HH:MM (24-hour) or HH:MM AM/PM",
    description: "Breakdown start time (only when Breakdown? is Yes).",
    validationRule:
      "Mandatory when Breakdown? is Yes, otherwise must be blank. The breakdown window must be positive and must not exceed the total shift duration.",
    example: "10:30",
  },
  {
    key: "breakdown_end_time",
    header: "Breakdown End",
    required: false,
    type: "time",
    format: "HH:MM (24-hour) or HH:MM AM/PM",
    description: "Breakdown end time (only when Breakdown? is Yes).",
    validationRule:
      "Mandatory when Breakdown? is Yes, otherwise must be blank. The breakdown window must be positive and must not exceed the total shift duration.",
    example: "11:15",
  },
  {
    key: "remarks",
    header: "Remarks",
    required: false,
    type: "text",
    format: "Free text up to 500 characters",
    description: "Optional operator or supervisor remarks for the shift.",
    validationRule: "Optional. Maximum 500 characters. No control characters.",
    example: "Routine operation, no issues",
    maxLength: 500,
  },
];

export const LOGSHEET_IMPORT_COLUMN_BY_KEY: Readonly<
  Record<LogsheetImportColumnKey, LogsheetImportColumnDef>
> = LOGSHEET_IMPORT_COLUMNS.reduce(
  (acc, col) => {
    acc[col.key] = col;
    return acc;
  },
  {} as Record<LogsheetImportColumnKey, LogsheetImportColumnDef>
);

/** Canonical header list used by the template writer and the structural parser. */
export const LOGSHEET_IMPORT_HEADERS: readonly string[] =
  LOGSHEET_IMPORT_COLUMNS.map((c) => c.header);

// ---------------------------------------------------------------------------
// Issue model
// ---------------------------------------------------------------------------

export type LogsheetImportIssueSeverity = "error" | "warning";

export interface LogsheetImportIssue {
  /** 1-based Excel row number (header row = 1, first data row = 2). */
  rowNumber: number;
  columnKey: LogsheetImportColumnKey | "";
  columnLabel: string;
  /** Original cell value exactly as read from the spreadsheet. */
  value: string;
  severity: LogsheetImportIssueSeverity;
  /** Machine-readable issue code. */
  code: string;
  /** Reason for rejection / warning. */
  message: string;
  /** Expected format or value. */
  expected: string;
}

export type LogsheetImportRowStatus =
  | "valid"
  | "warning"
  | "duplicate"
  | "invalid"
  | "review";

export const LOGSHEET_ISSUE_CODES = {
  REQUIRED: "required",
  INVALID_DATE: "invalid_date",
  FUTURE_DATE: "future_date",
  INVALID_TIME: "invalid_time",
  IDENTICAL_TIMES: "identical_times",
  INVALID_NUMBER: "invalid_number",
  DECIMAL_PRECISION: "decimal_precision",
  NEGATIVE_READING: "negative_reading",
  METER_REGRESSION: "meter_regression",
  RUNNING_HOURS_LIMIT: "running_hours_limit",
  INVALID_BOOLEAN: "invalid_boolean",
  INVALID_ENUM: "invalid_enum",
  TEXT_TOO_LONG: "text_too_long",
  CONTROL_CHARACTERS: "control_characters",
  OVERTIME_INVALID: "overtime_invalid",
  BREAKDOWN_TIMES_REQUIRED: "breakdown_times_required",
  BREAKDOWN_TIMES_UNEXPECTED: "breakdown_times_unexpected",
  BREAKDOWN_WINDOW_INVALID: "breakdown_window_invalid",
  BREAKDOWN_EXCEEDS_SHIFT: "breakdown_exceeds_shift",
  SHIFT_CODE_INVALID: "shift_code_invalid",
  SHIFT_TOO_LONG: "shift_too_long",
  FUTURE_SHIFT_END: "future_shift_end",
  OPERATOR_NOT_FOUND: "operator_not_found",
  OPERATOR_AMBIGUOUS: "operator_ambiguous",
  OPERATOR_NAME_MISMATCH: "operator_name_mismatch",
  OPERATOR_MATCHED_BY_NAME: "operator_matched_by_name",
  OPERATOR_DISAMBIGUATED_BY_NAME: "operator_disambiguated_by_name",
  OPERATOR_INACTIVE: "operator_inactive",
  EXAMPLE_ROW: "example_row",
  DUPLICATE_EXISTING_MACHINE_SHIFT: "duplicate_existing_machine_shift",
  DUPLICATE_EXISTING_OPERATOR_SHIFT: "duplicate_existing_operator_shift",
  DUPLICATE_EXISTING_ASSIGNMENT: "duplicate_existing_assignment",
  DUPLICATE_FILE_MACHINE_SHIFT: "duplicate_file_machine_shift",
  DUPLICATE_FILE_OPERATOR_SHIFT: "duplicate_file_operator_shift",
  OVERLAP_EXISTING_MACHINE: "overlap_existing_machine",
  OVERLAP_EXISTING_OPERATOR: "overlap_existing_operator",
  OVERLAP_FILE_MACHINE: "overlap_file_machine",
  OVERLAP_FILE_OPERATOR: "overlap_file_operator",
} as const;

const DUPLICATE_CODES: ReadonlySet<string> = new Set([
  LOGSHEET_ISSUE_CODES.DUPLICATE_EXISTING_MACHINE_SHIFT,
  LOGSHEET_ISSUE_CODES.DUPLICATE_EXISTING_OPERATOR_SHIFT,
  LOGSHEET_ISSUE_CODES.DUPLICATE_EXISTING_ASSIGNMENT,
  LOGSHEET_ISSUE_CODES.DUPLICATE_FILE_MACHINE_SHIFT,
  LOGSHEET_ISSUE_CODES.DUPLICATE_FILE_OPERATOR_SHIFT,
]);

const REVIEW_CODES: ReadonlySet<string> = new Set([
  LOGSHEET_ISSUE_CODES.OPERATOR_AMBIGUOUS,
]);

/**
 * Derives the row status from its issues.
 * - "duplicate"  → row collides with an existing or in-file record (excluded from import)
 * - "review"     → ambiguous resolution, administrator correction required (blocking)
 * - "invalid"    → hard validation failure (blocking)
 * - "warning"    → importable but explicitly flagged
 * - "valid"      → clean
 */
export function deriveLogsheetRowStatus(
  issues: readonly LogsheetImportIssue[]
): LogsheetImportRowStatus {
  let hasWarning = false;
  for (const issue of issues) {
    if (issue.severity === "warning") {
      hasWarning = true;
      continue;
    }
    if (DUPLICATE_CODES.has(issue.code)) return "duplicate";
    if (REVIEW_CODES.has(issue.code)) return "review";
    return "invalid";
  }
  return hasWarning ? "warning" : "valid";
}

// ---------------------------------------------------------------------------
// Cell parsing helpers (pure, deterministic, never silently coercing)
// ---------------------------------------------------------------------------

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; value: string; error: string };

function isExcelSerialNumber(n: number): boolean {
  return Number.isFinite(n) && n > 0 && n < 2958466;
}

/** Converts an Excel date serial number (1899-12-30 epoch) to a UTC Date. */
export function excelSerialToUtcDate(serial: number): Date | null {
  if (!isExcelSerialNumber(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function toIsoDate(y: number, m: number, d: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const MONTH_NAMES: Readonly<Record<string, number>> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parses a date cell into canonical YYYY-MM-DD.
 * Accepts: ISO strings, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, "D Mon YYYY",
 * Excel serial numbers and Date objects. Rejects ambiguous or impossible dates.
 */
export function parseImportDateCell(raw: unknown): ParseResult<string> {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: false, value: "", error: "Date is blank." };
  }

  if (raw instanceof Date) {
    const iso = toIsoDate(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
    return iso
      ? { ok: true, value: iso }
      : { ok: false, value: String(raw), error: "Unrecognised date value." };
  }

  if (typeof raw === "number") {
    const d = excelSerialToUtcDate(raw);
    const iso = d ? toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) : null;
    return iso
      ? { ok: true, value: iso }
      : { ok: false, value: String(raw), error: "Unrecognised date serial number." };
  }

  const str = String(raw).trim();
  if (!str) return { ok: false, value: "", error: "Date is blank." };

  // Strip any time suffix ("2025-01-15 00:00:00", "2025-01-15T08:00", "15 Jan 2025 08:00 PM")
  // without breaking month-name dates that contain spaces.
  const datePart = str
    .replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i, "")
    .split("T")[0];

  // ISO: YYYY-MM-DD or YYYY/MM/DD
  let m = datePart.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const iso = toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
    return iso
      ? { ok: true, value: iso }
      : { ok: false, value: str, error: `"${datePart}" is not a real calendar date.` };
  }

  // "D Mon YYYY" / "DD-Mon-YYYY" / "D Month YYYY"
  m = datePart.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/](\d{4})$/);
  if (m) {
    const month = MONTH_NAMES[m[2].slice(0, 3).toLowerCase()];
    if (month) {
      const iso = toIsoDate(Number(m[3]), month, Number(m[1]));
      return iso
        ? { ok: true, value: iso }
        : { ok: false, value: str, error: `"${datePart}" is not a real calendar date.` };
    }
  }

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (day-first, matching the documented format)
  m = datePart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const first = Number(m[1]);
    const second = Number(m[2]);
    if (first > 12 && second > 12) {
      return {
        ok: false,
        value: str,
        error: `"${datePart}" is ambiguous or invalid.`,
      };
    }
    if (second > 12 && first <= 12) {
      // Clearly month-first despite the documented day-first format — reject loudly
      // instead of silently swapping.
      return {
        ok: false,
        value: str,
        error: `"${datePart}" looks like MM/DD/YYYY. Use YYYY-MM-DD or DD/MM/YYYY (day first).`,
      };
    }
    const iso = toIsoDate(Number(m[3]), second, first);
    return iso
      ? { ok: true, value: iso }
      : { ok: false, value: str, error: `"${datePart}" is not a real calendar date.` };
  }

  return {
    ok: false,
    value: str,
    error: `"${str}" is not a recognised date.`,
  };
}

/**
 * Parses a time cell into canonical 24-hour HH:MM.
 * Accepts: "HH:MM", "HH:MM:SS", "H:MM AM/PM", Excel day-fractions and
 * full Excel datetime serials (fraction part is used).
 */
export function parseImportTimeCell(raw: unknown): ParseResult<string> {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: false, value: "", error: "Time is blank." };
  }

  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw < 0) {
      return { ok: false, value: String(raw), error: "Unrecognised time value." };
    }
    const dayFraction = raw - Math.floor(raw);
    const totalMinutes = Math.round(dayFraction * 24 * 60);
    if (totalMinutes >= 24 * 60) {
      return { ok: false, value: String(raw), error: "Time must be within 00:00-23:59." };
    }
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return { ok: true, value: `${hh}:${mm}` };
  }

  const str = String(raw).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm|Am|Pm|aM|pM)?$/);
  if (!m) {
    return {
      ok: false,
      value: str,
      error: `"${str}" is not a recognised time.`,
    };
  }
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[4] ? m[4].toUpperCase() : null;

  if (meridiem) {
    if (hours < 1 || hours > 12) {
      return { ok: false, value: str, error: `"${str}": with AM/PM the hour must be 1-12.` };
    }
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
  } else if (hours > 23) {
    return { ok: false, value: str, error: `"${str}": hour must be 0-23 (or use AM/PM).` };
  }
  if (minutes > 59) {
    return { ok: false, value: str, error: `"${str}": minutes must be 0-59.` };
  }
  return {
    ok: true,
    value: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
  };
}

/**
 * Parses a numeric cell. Enforces finite numbers and a maximum decimal precision.
 * Thousands separators in text values are accepted; anything else is rejected.
 */
export function parseImportNumberCell(
  raw: unknown,
  maxDecimals: number = LOGSHEET_IMPORT_MAX_DECIMALS
): ParseResult<number> {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: false, value: "", error: "Value is blank." };
  }
  let num: number;
  if (typeof raw === "number") {
    num = raw;
    if (!Number.isFinite(num)) {
      return { ok: false, value: String(raw), error: "Value is not a finite number." };
    }
  } else {
    const str = String(raw).trim().replace(/,/g, "");
    if (!str || !/^-?\d*\.?\d+$/.test(str)) {
      return { ok: false, value: String(raw), error: `"${String(raw).trim()}" is not a valid number.` };
    }
    num = Number(str);
    if (!Number.isFinite(num)) {
      return { ok: false, value: String(raw), error: "Value is not a finite number." };
    }
  }
  const decimals = countDecimals(num);
  if (decimals > maxDecimals) {
    return {
      ok: false,
      value: String(raw).trim(),
      error: `Value has ${decimals} decimal places; maximum ${maxDecimals} allowed.`,
    };
  }
  return { ok: true, value: num };
}

function countDecimals(n: number): number {
  const s = String(n);
  if (s.includes("e-") || s.includes("E-")) {
    // Scientific notation: fall back to fixed expansion
    const fixed = n.toFixed(20).replace(/0+$/, "");
    const idx = fixed.indexOf(".");
    return idx === -1 ? 0 : fixed.length - idx - 1;
  }
  const idx = s.indexOf(".");
  return idx === -1 ? 0 : s.length - idx - 1;
}

/** Parses Yes/No style boolean cells. */
export function parseImportBooleanCell(raw: unknown): ParseResult<boolean> {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: false };
  }
  if (typeof raw === "boolean") return { ok: true, value: raw };
  if (typeof raw === "number") {
    if (raw === 1) return { ok: true, value: true };
    if (raw === 0) return { ok: true, value: false };
    return { ok: false, value: String(raw), error: `Use Yes or No.` };
  }
  const str = String(raw).trim().toLowerCase();
  if (["yes", "y", "true", "t", "1"].includes(str)) return { ok: true, value: true };
  if (["no", "n", "false", "f", "0"].includes(str)) return { ok: true, value: false };
  return { ok: false, value: String(raw).trim(), error: `Use Yes or No.` };
}

const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Trims a text cell and rejects control characters / overlong values. */
export function parseImportTextCell(
  raw: unknown,
  maxLength: number
): ParseResult<string> {
  if (raw === null || raw === undefined) return { ok: true, value: "" };
  const str = String(raw).trim();
  if (!str) return { ok: true, value: "" };
  if (CONTROL_CHARS_RE.test(str)) {
    return {
      ok: false,
      value: str.slice(0, 40),
      error: "Value contains unsupported control characters.",
    };
  }
  if (str.length > maxLength) {
    return {
      ok: false,
      value: str.slice(0, 40) + "…",
      error: `Value exceeds the ${maxLength} character limit.`,
    };
  }
  return { ok: true, value: str };
}

// ---------------------------------------------------------------------------
// Shift code helpers — mirror `trg_fn_auto_set_machine_hour_log_shift_code`
// ---------------------------------------------------------------------------

/** Strips a leading "shift" word and trims/uppercases for canonical storage. */
export function normalizeShiftCode(raw?: string | null): string {
  const stripped = (raw || "").trim().replace(/^shift\s*/i, "").trim();
  return stripped.toUpperCase();
}

/**
 * Comparison key used for duplicate detection (case-insensitive).
 *
 * Canonicalizes human-readable shift aliases to the same equivalence classes the
 * Operations UI uses (`getShiftOrderWeight` / `resolveShiftCode` in
 * `components/operations/logs/OperationsLogsTable.tsx`): A↔S1, B↔S2, C↔S3, D↔S4,
 * and bare digits 1-4. This keeps duplicate detection consistent with how the
 * rest of the system renders shift identity — "A" and "S1" are the same shift.
 */
export function shiftCodeKey(code?: string | null): string {
  const normalized = normalizeShiftCode(code);
  if (normalized.length === 1) {
    const letter = "ABCD".indexOf(normalized);
    if (letter >= 0) return `s${letter + 1}`;
    if (normalized >= "1" && normalized <= "4") return `s${normalized}`;
  }
  return normalized.toLowerCase();
}

/** Auto-derives the shift code from start time using the standard shift windows. */
export function deriveShiftCodeFromTime(startTime: string): string {
  const hhmm = startTime.slice(0, 5);
  if (hhmm >= "00:00" && hhmm < "06:00") return "S4";
  if (hhmm >= "06:00" && hhmm < "12:00") return "S1";
  if (hhmm >= "12:00" && hhmm < "18:00") return "S2";
  return "S3";
}

// ---------------------------------------------------------------------------
// Operator identity matching (pure) — used by the import validation pipeline
// ---------------------------------------------------------------------------

/** One candidate operator record from `public.users`, flattened for matching. */
export interface LogsheetOperatorCandidate {
  id: string;
  name: string;
  employeeId: string;
  status: string;
}

export type LogsheetOperatorMatch =
  | {
      kind: "resolved";
      operator: LogsheetOperatorCandidate;
      /** How identity was established. */
      via: "employee_id" | "name" | "employee_id_disambiguated_by_name";
      /** True when a provided name conflicts with the resolved record. */
      nameMismatch: boolean;
    }
  | { kind: "ambiguous"; via: "employee_id" | "name"; candidates: LogsheetOperatorCandidate[] }
  | { kind: "not_found"; via: "employee_id" | "name" };

function namesEqual(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Resolves one sheet row to exactly one operator record — pure decision logic.
 *
 * Strict matching (never guesses):
 *  - Employee ID (when provided) is the primary key and must match exactly.
 *  - When several records share the Employee ID, the provided name is used to
 *    disambiguate ONLY if it matches exactly one candidate — otherwise the row
 *    stays ambiguous and lists every candidate so the admin can correct it.
 *  - Name-only matching requires an exact unique full-name match.
 *
 * The caller supplies the candidate pool already de-duplicated by record id —
 * the same record matched by both Employee ID and name must appear once.
 */
export function matchOperatorToRow(
  candidates: LogsheetOperatorCandidate[],
  row: { employeeId: string; name: string }
): LogsheetOperatorMatch {
  const empId = row.employeeId.trim();
  const name = row.name.trim();

  if (empId) {
    const matches = candidates.filter((c) => c.employeeId.trim().toLowerCase() === empId.toLowerCase());
    if (matches.length === 0) return { kind: "not_found", via: "employee_id" };
    if (matches.length === 1) {
      return {
        kind: "resolved",
        operator: matches[0],
        via: "employee_id",
        nameMismatch: Boolean(name && !namesEqual(name, matches[0].name)),
      };
    }
    if (name) {
      const nameMatches = matches.filter((c) => namesEqual(c.name, name));
      if (nameMatches.length === 1) {
        return {
          kind: "resolved",
          operator: nameMatches[0],
          via: "employee_id_disambiguated_by_name",
          nameMismatch: false,
        };
      }
    }
    return { kind: "ambiguous", via: "employee_id", candidates: matches };
  }

  const matches = candidates.filter((c) => namesEqual(c.name, name));
  if (matches.length === 0) return { kind: "not_found", via: "name" };
  if (matches.length === 1) {
    return { kind: "resolved", operator: matches[0], via: "name", nameMismatch: false };
  }
  return { kind: "ambiguous", via: "name", candidates: matches };
}

/** Human-readable candidate list for precise, actionable row errors. */
export function formatOperatorCandidates(candidates: LogsheetOperatorCandidate[]): string {
  return candidates
    .map((c) => `"${c.name || "Unknown"}" (Employee ID: ${c.employeeId || "none"}, status: ${c.status})`)
    .join("; ");
}

// ---------------------------------------------------------------------------
// Normalized row model
// ---------------------------------------------------------------------------

/** A single row as read from the spreadsheet, keyed by canonical column key. */
export type LogsheetImportRawRow = Partial<Record<LogsheetImportColumnKey, unknown>>;

export interface NormalizedLogsheetRow {
  rowNumber: number;
  logDate: string; // YYYY-MM-DD
  operatorEmployeeId: string;
  operatorName: string;
  shiftCode: string; // normalized ("S1"); "" = derive from start time
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  startMeter: number;
  endMeter: number;
  overtimeHours: number | null; // null = auto-calculate (existing logic)
  machineCondition: LogsheetMachineCondition | "";
  isBreakdown: boolean;
  breakdownStartTime: string; // HH:MM or ""
  breakdownEndTime: string; // HH:MM or ""
  remarks: string;
}

export interface LogsheetRowDerived {
  /** Resolved shift code (provided or auto-derived). */
  shiftCode: string;
  shiftLabel: string; // "Shift S1" — mirrors the manual entry `shift` column
  endDate: string; // YYYY-MM-DD (next day for overnight shifts)
  startDatetimeIso: string; // ISO-8601 with +05:30 offset
  endDatetimeIso: string;
  runningHours: number;
  overtimeHours: number;
  normalWorkingHours: number;
  durationFormatted: string;
  isOvernight: boolean;
  isFutureEnd: boolean;
  machineCondition: LogsheetMachineCondition;
  remarks: string; // final remarks incl. breakdown duration prefix
  breakdownDuration: string; // formatted breakdown string
  breakdownHours: number;
}

/**
 * Field-level normalization: parses raw cells into a NormalizedLogsheetRow and
 * reports every field problem with column, original value, reason and expected
 * format. Invalid fields never receive invented or coerced values — the row is
 * reported and left out of any import.
 */
export function normalizeLogsheetRow(
  rowNumber: number,
  raw: LogsheetImportRawRow
): { row: NormalizedLogsheetRow | null; issues: LogsheetImportIssue[] } {
  const issues: LogsheetImportIssue[] = [];
  const push = (
    columnKey: LogsheetImportColumnKey,
    value: unknown,
    code: string,
    message: string,
    expected: string,
    severity: LogsheetImportIssueSeverity = "error"
  ) => {
    issues.push({
      rowNumber,
      columnKey,
      columnLabel: LOGSHEET_IMPORT_COLUMN_BY_KEY[columnKey].header,
      value: value === null || value === undefined ? "" : String(value).trim().slice(0, 60),
      severity,
      code,
      message,
      expected,
    });
  };

  const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

  // Log Date
  let logDate = "";
  if (isBlank(raw.log_date)) {
    push("log_date", raw.log_date, LOGSHEET_ISSUE_CODES.REQUIRED, "Log Date is required.", "YYYY-MM-DD");
  } else {
    const parsed = parseImportDateCell(raw.log_date);
    if (!parsed.ok) {
      push("log_date", raw.log_date, LOGSHEET_ISSUE_CODES.INVALID_DATE, parsed.error!, "YYYY-MM-DD");
    } else {
      logDate = parsed.value;
    }
  }

  // Operator identity (Employee ID and/or exact Name)
  const empRes = parseImportTextCell(raw.operator_employee_id, 100);
  const nameRes = parseImportTextCell(raw.operator_name, 200);
  if (!empRes.ok) push("operator_employee_id", raw.operator_employee_id, LOGSHEET_ISSUE_CODES.TEXT_TOO_LONG, empRes.error!, "Text up to 100 characters");
  if (!nameRes.ok) push("operator_name", raw.operator_name, LOGSHEET_ISSUE_CODES.TEXT_TOO_LONG, nameRes.error!, "Text up to 200 characters");
  const operatorEmployeeId = empRes.ok ? empRes.value : "";
  const operatorName = nameRes.ok ? nameRes.value : "";
  if (!operatorEmployeeId && !operatorName) {
    push(
      "operator_employee_id",
      raw.operator_employee_id,
      LOGSHEET_ISSUE_CODES.REQUIRED,
      "Operator identification is required: fill Operator Employee ID (or Operator Name when the employee ID is unknown).",
      "Employee ID e.g. EMP-0338, or exact full name"
    );
  }

  // Shift code (optional; normalized / auto-derived later)
  let shiftCode = "";
  const shiftRes = parseImportTextCell(raw.shift_code, 20);
  if (!shiftRes.ok) {
    push("shift_code", raw.shift_code, LOGSHEET_ISSUE_CODES.SHIFT_CODE_INVALID, shiftRes.error!, "Text up to 20 characters, e.g. S1");
  } else if (shiftRes.value) {
    shiftCode = normalizeShiftCode(shiftRes.value);
    if (!shiftCode || shiftCode.length > 20) {
      push("shift_code", raw.shift_code, LOGSHEET_ISSUE_CODES.SHIFT_CODE_INVALID, "Shift code is invalid after normalization.", "Text up to 20 characters, e.g. S1");
      shiftCode = "";
    }
  }

  // Times
  let startTime = "";
  let endTime = "";
  if (isBlank(raw.start_time)) {
    push("start_time", raw.start_time, LOGSHEET_ISSUE_CODES.REQUIRED, "Start Time is required.", "HH:MM (24-hour) or HH:MM AM/PM");
  } else {
    const parsed = parseImportTimeCell(raw.start_time);
    if (!parsed.ok) push("start_time", raw.start_time, LOGSHEET_ISSUE_CODES.INVALID_TIME, parsed.error!, "HH:MM (24-hour) or HH:MM AM/PM");
    else startTime = parsed.value;
  }
  if (isBlank(raw.end_time)) {
    push("end_time", raw.end_time, LOGSHEET_ISSUE_CODES.REQUIRED, "End Time is required.", "HH:MM (24-hour) or HH:MM AM/PM");
  } else {
    const parsed = parseImportTimeCell(raw.end_time);
    if (!parsed.ok) push("end_time", raw.end_time, LOGSHEET_ISSUE_CODES.INVALID_TIME, parsed.error!, "HH:MM (24-hour) or HH:MM AM/PM");
    else endTime = parsed.value;
  }

  // Meters
  let startMeter = NaN;
  let endMeter = NaN;
  if (isBlank(raw.start_meter)) {
    push("start_meter", raw.start_meter, LOGSHEET_ISSUE_CODES.REQUIRED, "Start HMR is required.", "Non-negative number, max 2 decimals");
  } else {
    const parsed = parseImportNumberCell(raw.start_meter);
    if (!parsed.ok) {
      const code = parsed.error!.includes("decimal places")
        ? LOGSHEET_ISSUE_CODES.DECIMAL_PRECISION
        : LOGSHEET_ISSUE_CODES.INVALID_NUMBER;
      push("start_meter", raw.start_meter, code, parsed.error!, "Non-negative number, max 2 decimals");
    } else if (parsed.value < 0) {
      push("start_meter", raw.start_meter, LOGSHEET_ISSUE_CODES.NEGATIVE_READING, "Start HMR cannot be negative.", "Non-negative number");
    } else {
      startMeter = parsed.value;
    }
  }
  if (isBlank(raw.end_meter)) {
    push("end_meter", raw.end_meter, LOGSHEET_ISSUE_CODES.REQUIRED, "End HMR is required.", "Non-negative number, max 2 decimals");
  } else {
    const parsed = parseImportNumberCell(raw.end_meter);
    if (!parsed.ok) {
      const code = parsed.error!.includes("decimal places")
        ? LOGSHEET_ISSUE_CODES.DECIMAL_PRECISION
        : LOGSHEET_ISSUE_CODES.INVALID_NUMBER;
      push("end_meter", raw.end_meter, code, parsed.error!, "Non-negative number, max 2 decimals");
    } else if (parsed.value < 0) {
      push("end_meter", raw.end_meter, LOGSHEET_ISSUE_CODES.NEGATIVE_READING, "End HMR cannot be negative.", "Non-negative number");
    } else {
      endMeter = parsed.value;
    }
  }

  // Overtime (optional)
  let overtimeHours: number | null = null;
  if (!isBlank(raw.overtime_hours)) {
    const parsed = parseImportNumberCell(raw.overtime_hours);
    if (!parsed.ok) {
      push("overtime_hours", raw.overtime_hours, LOGSHEET_ISSUE_CODES.OVERTIME_INVALID, parsed.error!, "Non-negative number up to 16, max 2 decimals (or blank for auto)");
    } else {
      overtimeHours = parsed.value;
    }
  }

  // Machine condition (optional enum)
  let machineCondition: LogsheetMachineCondition | "" = "";
  if (!isBlank(raw.machine_condition)) {
    const normalized = String(raw.machine_condition).trim().toLowerCase().replace(/[\s-]+/g, "_");
    if ((LOGSHEET_MACHINE_CONDITIONS as readonly string[]).includes(normalized)) {
      machineCondition = normalized as LogsheetMachineCondition;
    } else {
      push(
        "machine_condition",
        raw.machine_condition,
        LOGSHEET_ISSUE_CODES.INVALID_ENUM,
        `"${String(raw.machine_condition).trim()}" is not a supported machine condition.`,
        "good | fair | needs_attention | breakdown"
      );
    }
  }

  // Breakdown flag + times
  let isBreakdown = false;
  if (!isBlank(raw.is_breakdown)) {
    const parsed = parseImportBooleanCell(raw.is_breakdown);
    if (!parsed.ok) {
      push("is_breakdown", raw.is_breakdown, LOGSHEET_ISSUE_CODES.INVALID_BOOLEAN, parsed.error!, "Yes / No");
    } else {
      isBreakdown = parsed.value;
    }
  }
  let breakdownStartTime = "";
  let breakdownEndTime = "";
  if (!isBlank(raw.breakdown_start_time)) {
    const parsed = parseImportTimeCell(raw.breakdown_start_time);
    if (!parsed.ok) push("breakdown_start_time", raw.breakdown_start_time, LOGSHEET_ISSUE_CODES.INVALID_TIME, parsed.error!, "HH:MM (24-hour) or HH:MM AM/PM");
    else breakdownStartTime = parsed.value;
  }
  if (!isBlank(raw.breakdown_end_time)) {
    const parsed = parseImportTimeCell(raw.breakdown_end_time);
    if (!parsed.ok) push("breakdown_end_time", raw.breakdown_end_time, LOGSHEET_ISSUE_CODES.INVALID_TIME, parsed.error!, "HH:MM (24-hour) or HH:MM AM/PM");
    else breakdownEndTime = parsed.value;
  }
  if (isBreakdown && (!breakdownStartTime || !breakdownEndTime)) {
    push(
      breakdownStartTime ? "breakdown_end_time" : "breakdown_start_time",
      "",
      LOGSHEET_ISSUE_CODES.REQUIRED,
      "Breakdown Start and Breakdown End are required when Breakdown? is Yes.",
      "Both breakdown times filled"
    );
  }

  // Remarks
  const remarksRes = parseImportTextCell(raw.remarks, 500);
  if (!remarksRes.ok) {
    const code = remarksRes.error!.includes("control characters")
      ? LOGSHEET_ISSUE_CODES.CONTROL_CHARACTERS
      : LOGSHEET_ISSUE_CODES.TEXT_TOO_LONG;
    push("remarks", raw.remarks, code, remarksRes.error!, "Up to 500 characters");
  }
  const remarks = remarksRes.ok ? remarksRes.value : "";

  if (issues.some((i) => i.severity === "error")) {
    return { row: null, issues };
  }

  return {
    row: {
      rowNumber,
      logDate,
      operatorEmployeeId,
      operatorName,
      shiftCode,
      startTime,
      endTime,
      startMeter,
      endMeter,
      overtimeHours,
      machineCondition,
      isBreakdown,
      breakdownStartTime,
      breakdownEndTime,
      remarks,
    },
    issues,
  };
}

/**
 * Business-rule validation for a normalized row, mirroring the existing manual
 * shift entry rules (`submitOperatorHourLogAction`, `submit_operator_hour_log_atomic`,
 * `SubmitHourLogSchema`) and the database checks/triggers. Nothing is silently
 * corrected: every deviation is reported.
 */
export function validateLogsheetRowBusiness(
  row: NormalizedLogsheetRow,
  todayIso: string,
  nowMs: number = Date.now()
): LogsheetImportIssue[] {
  const issues: LogsheetImportIssue[] = [];
  const push = (
    columnKey: LogsheetImportColumnKey,
    value: string,
    code: string,
    message: string,
    expected: string,
    severity: LogsheetImportIssueSeverity = "error"
  ) => {
    issues.push({
      rowNumber: row.rowNumber,
      columnKey,
      columnLabel: LOGSHEET_IMPORT_COLUMN_BY_KEY[columnKey].header,
      value,
      severity,
      code,
      message,
      expected,
    });
  };

  // Historical/future date rules: administrators may back-fill history but never future dates
  if (row.logDate > todayIso) {
    push("log_date", row.logDate, LOGSHEET_ISSUE_CODES.FUTURE_DATE, "Log Date is in the future. Historical records can be imported but future logs cannot.", `Date on or before ${todayIso}`);
  }

  // Meter rules (mirrors chk_end_meter_gte_start / max 24h / non-negative)
  if (row.endMeter < row.startMeter) {
    push("end_meter", String(row.endMeter), LOGSHEET_ISSUE_CODES.METER_REGRESSION, "End HMR cannot be less than Start HMR.", `>= ${row.startMeter}`);
  }
  if (row.endMeter - row.startMeter > 24) {
    push("end_meter", String(row.endMeter), LOGSHEET_ISSUE_CODES.RUNNING_HOURS_LIMIT, "Running hours (End HMR - Start HMR) cannot exceed 24 hours in a single log.", "End HMR - Start HMR <= 24");
  }

  // Shift timing (existing computeShiftTiming rules: identical times, >24h, valid range)
  const timing = computeShiftTiming({
    startDate: row.logDate,
    startTime: row.startTime,
    endTime: row.endTime,
    manualOvertime: row.overtimeHours ?? undefined,
  });

  if (!timing.isValid || !timing.startDateTime || !timing.endDateTime) {
    push("start_time", `${row.startTime} - ${row.endTime}`, LOGSHEET_ISSUE_CODES.INVALID_TIME, timing.errorMessage || "Invalid shift timing.", "Valid start and end time with the shift not exceeding 24 hours");
  } else {
    if (timing.isFutureEnd || timing.endDateTime.getTime() > nowMs + 60 * 1000) {
      push("end_time", row.endTime, LOGSHEET_ISSUE_CODES.FUTURE_SHIFT_END, "Shift end timestamp is in the future; the record cannot be imported before the shift has ended.", "Shift end not later than now");
    }
    // Overtime guard: supplied overtime must be plausible (manual entry clamps silently,
    // import rejects loudly instead of altering source values)
    if (row.overtimeHours !== null) {
      if (row.overtimeHours > 16) {
        push("overtime_hours", String(row.overtimeHours), LOGSHEET_ISSUE_CODES.OVERTIME_INVALID, "Overtime hours cannot exceed 16.", "0 - 16");
      } else if (row.overtimeHours > timing.durationHours) {
        push("overtime_hours", String(row.overtimeHours), LOGSHEET_ISSUE_CODES.OVERTIME_INVALID, `Overtime hours cannot exceed the total shift duration (${timing.durationHours}h).`, `<= ${timing.durationHours}`);
      }
    }
  }

  // Breakdown rules (mirrors the manual entry breakdown guards)
  if (row.isBreakdown) {
    if (!row.breakdownStartTime || !row.breakdownEndTime) {
      push(
        row.breakdownStartTime ? "breakdown_end_time" : "breakdown_start_time",
        row.breakdownStartTime || row.breakdownEndTime,
        LOGSHEET_ISSUE_CODES.BREAKDOWN_TIMES_REQUIRED,
        "Breakdown Start and Breakdown End are required when Breakdown? is Yes.",
        "Both breakdown times filled"
      );
    } else {
      const bkd = computeBreakdownDuration(row.breakdownStartTime, row.breakdownEndTime);
      if (!bkd.isValid) {
        push(
          "breakdown_start_time",
          `${row.breakdownStartTime} - ${row.breakdownEndTime}`,
          LOGSHEET_ISSUE_CODES.BREAKDOWN_WINDOW_INVALID,
          bkd.errorMessage || "Invalid breakdown time window.",
          "A positive breakdown window (start != end)"
        );
      } else if (timing.isValid) {
        const totalShiftHours = timing.durationHours + (timing.overtimeHours > 0 ? timing.overtimeHours : 0);
        if (bkd.durationDecimalHours > totalShiftHours) {
          push(
            "breakdown_end_time",
            `${row.breakdownStartTime} - ${row.breakdownEndTime}`,
            LOGSHEET_ISSUE_CODES.BREAKDOWN_EXCEEDS_SHIFT,
            `Breakdown duration (${bkd.durationDecimalHours}h) cannot exceed total shift duration (${totalShiftHours}h).`,
            `Breakdown duration <= ${totalShiftHours}h`
          );
        }
      }
    }
  } else if (row.breakdownStartTime || row.breakdownEndTime) {
    push(
      "is_breakdown",
      `${row.breakdownStartTime} ${row.breakdownEndTime}`.trim(),
      LOGSHEET_ISSUE_CODES.BREAKDOWN_TIMES_UNEXPECTED,
      "Breakdown times were provided but Breakdown? is No. Mark the row as a breakdown or remove the breakdown times — the import will not silently discard them.",
      'Set Breakdown? to "Yes" or leave both breakdown times blank',
      "warning"
    );
  }

  return issues;
}

/**
 * Computes the derived record exactly as the existing calculation logic would
 * (computeShiftTiming + breakdown helpers + the manual entry remarks convention).
 * Every derived value is displayed in the preview — source values are never altered.
 */
export function computeLogsheetRowDerived(row: NormalizedLogsheetRow): LogsheetRowDerived {
  const timing = computeShiftTiming({
    startDate: row.logDate,
    startTime: row.startTime,
    endTime: row.endTime,
    manualOvertime: row.overtimeHours ?? undefined,
  });

  const shiftCode = row.shiftCode || deriveShiftCodeFromTime(row.startTime);
  const runningHours =
    Math.round((row.endMeter - row.startMeter) * 100) / 100;

  let breakdownDuration = "";
  let breakdownHours = 0;
  let remarks = row.remarks;
  if (row.isBreakdown && row.breakdownStartTime && row.breakdownEndTime) {
    const bkd = computeBreakdownDuration(row.breakdownStartTime, row.breakdownEndTime);
    if (bkd.isValid) {
      breakdownDuration = bkd.fullBreakdownString;
      breakdownHours = bkd.durationDecimalHours;
      const prefix = `[Breakdown Duration: ${breakdownDuration}]`;
      if (!remarks.includes("[Breakdown Duration:")) {
        remarks = remarks ? `${prefix} ${remarks}` : prefix;
      }
    }
  }

  return {
    shiftCode,
    shiftLabel: `Shift ${shiftCode}`,
    endDate: timing.resolvedEndDate,
    startDatetimeIso: timing.startDateTime
      ? timing.startDateTime.toISOString()
      : "",
    endDatetimeIso: timing.endDateTime ? timing.endDateTime.toISOString() : "",
    runningHours,
    overtimeHours: timing.overtimeHours,
    normalWorkingHours: timing.normalWorkingHours,
    durationFormatted: timing.durationFormatted,
    isOvernight: timing.isOvernight,
    isFutureEnd: Boolean(timing.endDateTime && timing.endDateTime.getTime() > Date.now() + 60 * 1000),
    machineCondition: row.isBreakdown
      ? "breakdown"
      : row.machineCondition || "good",
    remarks,
    breakdownDuration,
    breakdownHours,
  };
}

// ---------------------------------------------------------------------------
// Duplicate / conflict detection
// ---------------------------------------------------------------------------

export interface LogsheetConflictCandidate {
  rowNumber: number;
  /** Resolved operator key (users.id when resolved, else the raw reference). */
  operatorKey: string;
  logDate: string;
  shiftKey: string;
  startDatetimeIso: string;
  endDatetimeIso: string;
}

export interface LogsheetConflictMatch {
  /** Existing record identity (log id for DB matches, row number for file matches). */
  conflictingWith: string;
  conflictingLabel: string;
}

export type LogsheetConflictKind =
  | "machine_date_shift"
  | "operator_date_shift"
  | "machine_interval"
  | "operator_interval";

export interface LogsheetConflictIssue {
  rowNumber: number;
  kind: LogsheetConflictKind;
  source: "file" | "database";
  conflictingWith: string;
  conflictingLabel: string;
}

function isoRangeOverlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Detects conflicts inside the uploaded file using the exact database
 * uniqueness semantics:
 *   - (machine, log_date, shift_code)  → uq_machine_hour_logs_machine_date_shift
 *   - (operator, log_date, shift_code) → uq_machine_hour_logs_operator_date_shift
 *   - machine timeline overlap         → machine_hour_logs_machine_timeline_overlap_excl
 *   - operator timeline overlap        → trg_check_machine_hour_log_shift_overlap
 *
 * The first occurrence of a duplicated key is kept; later occurrences are flagged.
 */
export function detectLogsheetIntraFileConflicts(
  candidates: readonly LogsheetConflictCandidate[]
): LogsheetConflictIssue[] {
  const issues: LogsheetConflictIssue[] = [];
  const seenMachineDateShift = new Map<string, number>();
  const seenOperatorDateShift = new Map<string, number>();

  for (const c of candidates) {
    const mds = `${c.logDate}::${c.shiftKey}`;
    const firstMds = seenMachineDateShift.get(mds);
    if (firstMds !== undefined) {
      issues.push({
        rowNumber: c.rowNumber,
        kind: "machine_date_shift",
        source: "file",
        conflictingWith: String(firstMds),
        conflictingLabel: `Row ${firstMds} already covers Machine + ${c.logDate} + Shift ${c.shiftKey.toUpperCase()}`,
      });
    } else {
      seenMachineDateShift.set(mds, c.rowNumber);
    }

    const ods = `${c.operatorKey}::${c.logDate}::${c.shiftKey}`;
    const firstOds = seenOperatorDateShift.get(ods);
    if (firstOds !== undefined) {
      issues.push({
        rowNumber: c.rowNumber,
        kind: "operator_date_shift",
        source: "file",
        conflictingWith: String(firstOds),
        conflictingLabel: `Row ${firstOds} already logs the same operator for ${c.logDate} Shift ${c.shiftKey.toUpperCase()}`,
      });
    } else {
      seenOperatorDateShift.set(ods, c.rowNumber);
    }
  }

  // Timeline overlaps (machine-wide and per-operator)
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (!isoRangeOverlaps(a.startDatetimeIso, a.endDatetimeIso, b.startDatetimeIso, b.endDatetimeIso)) {
        continue;
      }
      issues.push({
        rowNumber: b.rowNumber,
        kind: "machine_interval",
        source: "file",
        conflictingWith: String(a.rowNumber),
        conflictingLabel: `Row ${a.rowNumber} overlaps in time on the same machine (${a.startDatetimeIso} - ${a.endDatetimeIso})`,
      });
      if (a.operatorKey === b.operatorKey) {
        issues.push({
          rowNumber: b.rowNumber,
          kind: "operator_interval",
          source: "file",
          conflictingWith: String(a.rowNumber),
          conflictingLabel: `Row ${a.rowNumber} overlaps in time for the same operator (${a.startDatetimeIso} - ${a.endDatetimeIso})`,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Untrusted-payload schema (confirmation request re-validated on the server)
// ---------------------------------------------------------------------------

export const LogsheetImportRowPayloadSchema = z.object({
  rowNumber: z.number().int().min(2),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid log date"),
  operatorEmployeeId: z.string().max(100),
  operatorName: z.string().max(200),
  shiftCode: z.string().max(20),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid start time"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid end time"),
  startMeter: z.number().min(0),
  endMeter: z.number().min(0),
  overtimeHours: z.number().min(0).max(16).nullable(),
  machineCondition: z.enum(["", "good", "fair", "needs_attention", "breakdown"]),
  isBreakdown: z.boolean(),
  breakdownStartTime: z.string().max(10),
  breakdownEndTime: z.string().max(10),
  remarks: z.string().max(500),
});

export type LogsheetImportRowPayload = z.infer<typeof LogsheetImportRowPayloadSchema>;
