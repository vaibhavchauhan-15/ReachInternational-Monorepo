import * as XLSX from "xlsx";
import type { User, Machine } from "@/lib/types/database";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";
import { formatDate, formatExactTimestamp, formatTo12Hour, parseBreakdownString } from "@reachinternational/utils";

// ─── Re-exports from centralized pdf-config & pdf-utils ──────────────────────
// Backward-compatible: all consumers importing from this file continue to work.
export {
  MONTH_NAMES,
  getCurrentMonthNumber,
  getLogMonthNumber,
  formatExportDateTimeSlug,
  buildExportFileName,
  buildMachineExportFileName,
} from "@/lib/pdf/pdf-config";

export { formatCompactTiming, computeDurationHours } from "@/lib/pdf/pdf-utils";

import { MONTH_NAMES, getLogMonthNumber, formatExportDateTimeSlug, buildExportFileName } from "@/lib/pdf/pdf-config";
import { computeDurationHours } from "@/lib/pdf/pdf-utils";

export function exportOperatorLogsToExcel(
  logs: OperatorHourLog[],
  user: User,
  assignedMachine?: Machine | null,
  selectedMonthValue: string = "all",
  customStartDate?: string,
  customEndDate?: string
) {
  // Filter logs month-wise or by custom date range
  const targetLogs = logs.filter((log) => {
    if (selectedMonthValue === "custom") {
      if (!customStartDate && !customEndDate) return true;
      const logDate = log.log_date?.split("T")[0] || "";
      if (customStartDate && logDate < customStartDate) return false;
      if (customEndDate && logDate > customEndDate) return false;
      return true;
    }
    if (selectedMonthValue === "all") return true;
    return getLogMonthNumber(log.log_date) === selectedMonthValue;
  });

  const operatorName = user.full_name || "Operator";
  const operatorEmail = user.email || "—";
  const operatorPhone = user.phone || "—";
  const { displayDateTime } = formatExportDateTimeSlug();

  let periodInfoLabel = "Month: All Months";
  if (selectedMonthValue === "custom") {
    if (customStartDate && customEndDate) {
      periodInfoLabel = `Date Range: ${formatDate(customStartDate)} to ${formatDate(customEndDate)}`;
    } else if (customStartDate) {
      periodInfoLabel = `Date Range: From ${formatDate(customStartDate)}`;
    } else if (customEndDate) {
      periodInfoLabel = `Date Range: Up to ${formatDate(customEndDate)}`;
    } else {
      periodInfoLabel = "Date Range: Custom";
    }
  } else if (selectedMonthValue !== "all") {
    const mObj = MONTH_NAMES.find(
      (m) => m.value === selectedMonthValue || m.short.toLowerCase() === selectedMonthValue.toLowerCase()
    );
    periodInfoLabel = `Month: ${mObj ? mObj.label : selectedMonthValue}`;
  }

  // Top Header Details
  const titleRow = ["OPERATOR DAILY MACHINE LOG REPORT"];
  const headerInfoRow = [
    `Operator Name: ${operatorName}`,
    `Email: ${operatorEmail}`,
    `Number: ${operatorPhone}`,
    `Export Date: ${displayDateTime}`,
    periodInfoLabel,
  ];
  const blankRow = [""];

  // Table Headers
  const tableHeaders = [
    "S.No",
    "Shift Date",
    "Entry Timestamp",
    "Serial No",
    "Model",
    "Start Meter (hrs)",
    "End Meter (hrs)",
    "Meter Run (hrs)",
    "Shift Timings",
    "Normal Working Time (hrs)",
    "Overtime (hrs)",
    "Breakdown Timing (Start - End)",
    "Breakdown Total Time",
    "Remarks / Notes",
  ];

  let totalOpHours = 0;
  let totalNormalHours = 0;
  let totalOtHours = 0;
  let totalMeterRun = 0;
  let totalBreakdowns = 0;

  // Transform logs into row arrays
  const dataRows = targetLogs.map((log, index) => {
    const isBkd = log.is_breakdown || log.machine_condition === "breakdown";
    if (isBkd) totalBreakdowns++;

    const startMtr = log.start_meter ?? 0;
    const endMtr = log.end_meter ?? startMtr;
    const meterRun = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
    totalMeterRun += meterRun;

    const opHrs = computeDurationHours(log.start_time, log.end_time);
    const otHrs = log.overtime_hours || 0;
    const normalHrs = (log as any).normal_working_hours !== undefined && (log as any).normal_working_hours !== null
      ? Number((log as any).normal_working_hours)
      : Math.max(0, Math.round((opHrs - otHrs - 1.0) * 10) / 10);

    totalOpHours += opHrs;
    totalNormalHours += normalHrs;
    totalOtHours += otHrs;

    const mSerial = log.machine?.serial_number || (assignedMachine as any)?.serial_number || log.machine?.machine_code || assignedMachine?.machine_code || "—";
    const mModel = log.machine?.model || assignedMachine?.model || "Standard";

    const bkdParsed = parseBreakdownString((log as any).breakdown_duration || log.remarks);
    const bkdStartTime = (log as any).breakdown_start_time || bkdParsed?.startTime || null;
    const bkdEndTime = (log as any).breakdown_end_time || bkdParsed?.endTime || null;
    const bkdTimingStr = isBkd && bkdStartTime && bkdEndTime ? `${bkdStartTime} - ${bkdEndTime}` : isBkd ? "Breakdown" : "—";
    const bkdDurationOnly = bkdParsed?.durationFormatted || bkdParsed?.durationText || (log as any).breakdown_duration || "Breakdown";
    const displayBkdText = isBkd ? bkdDurationOnly : "0";

    const cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim() || "—";

    return [
      index + 1,
      formatDate(log.log_date),
      log.created_at ? formatExactTimestamp(log.created_at, true) : "—",
      mSerial,
      mModel,
      startMtr,
      endMtr,
      `${meterRun} hrs`,
      `${formatTo12Hour(log.start_time) || "06:00 AM"} - ${formatTo12Hour(log.end_time) || "02:00 PM"}`,
      `${normalHrs} hrs`,
      `${otHrs} hrs`,
      bkdTimingStr,
      displayBkdText,
      cleanRemarks,
    ];
  });

  // Total Summary Row
  const summaryRow = [
    "SUMMARY TOTALS",
    `Total Logs: ${targetLogs.length}`,
    "",
    "",
    "",
    "",
    "",
    `Meter Run: ${Math.round(totalMeterRun * 10) / 10} hrs`,
    `Total Shift: ${Math.round(totalOpHours * 10) / 10} hrs`,
    `Total Normal: ${Math.round(totalNormalHours * 10) / 10} hrs`,
    `Total OT: ${Math.round(totalOtHours * 10) / 10} hrs`,
    `Breakdowns: ${totalBreakdowns}`,
    "",
    "",
  ];

  // Combine all rows into array of arrays
  const worksheetData = [
    titleRow,
    headerInfoRow,
    blankRow,
    tableHeaders,
    ...dataRows,
    blankRow,
    summaryRow,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Define column widths for optimal viewing
  worksheet["!cols"] = [
    { wch: 8 },  // S.No
    { wch: 14 }, // Shift Date
    { wch: 24 }, // Entry Timestamp
    { wch: 18 }, // Serial No
    { wch: 16 }, // Model
    { wch: 16 }, // Start Meter (hrs)
    { wch: 16 }, // End Meter (hrs)
    { wch: 16 }, // Meter Run (hrs)
    { wch: 22 }, // Shift Timings
    { wch: 22 }, // Normal Working Time
    { wch: 15 }, // Overtime Hours
    { wch: 26 }, // Breakdown Timing (Start - End)
    { wch: 22 }, // Breakdown Total Time
    { wch: 35 }, // Remarks / Notes
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Daily Machine Logs");

  // File name formatting strictly following format: operator-name-month-export-date-and-time.xlsx
  const fileName = buildExportFileName(operatorName, selectedMonthValue, "xlsx", customStartDate, customEndDate);

  XLSX.writeFile(workbook, fileName);
}

