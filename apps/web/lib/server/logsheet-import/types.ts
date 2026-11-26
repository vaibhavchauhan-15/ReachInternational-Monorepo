import type {
  LogsheetImportIssue,
  LogsheetImportRowStatus,
} from "@reachinternational/validation";

/**
 * Preview / result contracts shared between the logsheet import server actions
 * and the web UI. Pure types — safe for client components.
 */

export interface LogsheetPreviewRow {
  rowNumber: number;
  status: LogsheetImportRowStatus;
  /** Source values exactly as read from the spreadsheet (never altered). */
  source: {
    logDate: string;
    operatorEmployeeId: string;
    operatorName: string;
    shiftCode: string;
    startTime: string;
    endTime: string;
    startMeter: number | null;
    endMeter: number | null;
    overtimeHours: number | null;
    machineCondition: string;
    isBreakdown: boolean;
    breakdownStartTime: string;
    breakdownEndTime: string;
    remarks: string;
  };
  /** Resolved / derived values (existing calculation logic), shown for review. */
  resolved: {
    operatorLabel: string;
    shiftCode: string;
    endDate: string;
    runningHours: number;
    overtimeHours: number;
    normalWorkingHours: number;
    durationFormatted: string;
    isOvernight: boolean;
    machineCondition: string;
    remarks: string;
    breakdownDuration: string;
    isFutureEnd: boolean;
  };
  issues: LogsheetImportIssue[];
}

export interface LogsheetImportSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  invalidRows: number;
  duplicateRows: number;
  reviewRows: number;
  /** Rows eligible for import (valid + warning). */
  readyRows: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  totalRunningHours: number;
}

export interface LogsheetImportPreview {
  ok: boolean;
  machineId: string;
  machineLabel: string;
  filename: string;
  fileSize: number;
  fileChecksum: string;
  templateVersion: string;
  rows: LogsheetPreviewRow[];
  summary: LogsheetImportSummary;
  /** File-level structural issues (workbook, sheets, headers, version, size). */
  structuralIssues: LogsheetImportIssue[];
  /** True when any blocking (invalid/review) issue exists — import is disabled. */
  blocked: boolean;
  maxRows: number;
  /** Populated on fatal structural failure. */
  error?: string;
}

export interface LogsheetImportResult {
  success: boolean;
  alreadyImported?: boolean;
  importId?: string;
  machineId?: string;
  machineLabel?: string;
  filename?: string;
  importedRows: number;
  skippedDuplicates: number;
  rejectedRows: number;
  totalRunningHours: number;
  /** Verified committed log ids (post-commit DB verification). */
  insertedLogIds: string[];
  durationMs: number;
  error?: string;
  /** Populated when the import was blocked: the re-validated preview. */
  preview?: LogsheetImportPreview;
}

export interface LogsheetImportHistoryItem {
  id: string;
  importToken: string;
  machineId: string;
  machineLabel: string;
  adminName: string;
  filename: string | null;
  templateVersion: string | null;
  totalRows: number;
  importedRows: number;
  skippedDuplicates: number;
  rejectedRows: number;
  totalRunningHours: number;
  status: string;
  processingDurationMs: number | null;
  createdAt: string;
}
