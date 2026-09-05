import * as XLSX from "xlsx";
import type { User, Machine } from "@/lib/types/database";
import type { OperatorHourLog } from "@/components/dashboard/OperatorDashboard";
import { formatDate, formatExactTimestamp, formatTo12Hour, parseBreakdownString } from "@reachinternational/utils";

// Time string parser (e.g. "08:00 AM", "05:30 PM", "17:00") -> total minutes from midnight
function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3];

  if (period) {
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}

// Compute operating hours for export fallback
function computeDurationHours(startStr?: string, endStr?: string): number {
  const startMins = parseTimeToMinutes(startStr);
  const endMins = parseTimeToMinutes(endStr);
  if (startMins === null || endMins === null) return 8;

  let diffMins = endMins - startMins;
  if (diffMins <= 0) diffMins += 24 * 60;
  return Math.round((diffMins / 60) * 10) / 10;
}

// Compact timing range formatter with zero spaces (e.g. "06:00AM-06:00PM")
export function formatCompactTiming(startStr?: string | null, endStr?: string | null): string {
  const formattedStart = formatTo12Hour(startStr) || "06:00 AM";
  const formattedEnd = formatTo12Hour(endStr) || "02:00 PM";
  return `${formattedStart.replace(/\s+/g, "")}-${formattedEnd.replace(/\s+/g, "")}`;
}

export const MONTH_NAMES = [
  { value: "all", label: "All Months", short: "All" },
  { value: "01", label: "January", short: "Jan" },
  { value: "02", label: "February", short: "Feb" },
  { value: "03", label: "March", short: "Mar" },
  { value: "04", label: "April", short: "Apr" },
  { value: "05", label: "May", short: "May" },
  { value: "06", label: "June", short: "Jun" },
  { value: "07", label: "July", short: "Jul" },
  { value: "08", label: "August", short: "Aug" },
  { value: "09", label: "September", short: "Sep" },
  { value: "10", label: "October", short: "Oct" },
  { value: "11", label: "November", short: "Nov" },
  { value: "12", label: "December", short: "Dec" },
];

// Extract 2-digit month string ("01" to "12") from log date
export function getLogMonthNumber(logDateStr: string): string {
  if (!logDateStr) return "";
  const isoMatch = logDateStr.match(/^\d{4}-(\d{2})-\d{2}/);
  if (isoMatch) return isoMatch[1];
  const dmyMatch = logDateStr.match(/^\d{2}-(\d{2})-\d{4}/);
  if (dmyMatch) return dmyMatch[1];

  const d = new Date(logDateStr);
  if (!isNaN(d.getTime())) {
    const m = d.getMonth() + 1;
    return m < 10 ? `0${m}` : `${m}`;
  }
  return "";
}

// Format date & time slug for filename (e.g. display: "21-08-2026 16:16", slug: "21-08-2026-16-16")
export function formatExportDateTimeSlug(dateObj: Date = new Date()): { displayDateTime: string; slugDateTime: string } {
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");

  const displayDateTime = `${day}-${month}-${year} ${hours}:${minutes}`;
  const slugDateTime = `${day}-${month}-${year}-${hours}-${minutes}`;
  return { displayDateTime, slugDateTime };
}

// Build standardized machine export filename format: Machineserialnumber-Exportdateandtime (e.g. REACH-2026-001-22-08-2026-16-00.pdf / .xlsx)
export function buildMachineExportFileName(
  serialNumberOrCode: string,
  extension: "xlsx" | "pdf"
): string {
  const rawSerial = (serialNumberOrCode || "").trim() || "Machine";
  const words = rawSerial.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const serialSlug =
    words.length > 0
      ? words.join("-")
      : "Machine";

  const { slugDateTime } = formatExportDateTimeSlug();
  return `${serialSlug}-${slugDateTime}.${extension}`;
}

export function buildExportFileName(
  operatorName: string,
  selectedMonthValue: string,
  extension: "xlsx" | "pdf"
): string {
  const rawName = (operatorName || "").trim() || "Operator";
  const nameWords = rawName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const operatorSlug =
    nameWords.length > 0
      ? nameWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("-")
      : "Operator";

  let monthSlug = "";
  if (
    selectedMonthValue &&
    selectedMonthValue.toLowerCase() !== "all" &&
    selectedMonthValue.toLowerCase() !== "all months"
  ) {
    const monthObj = MONTH_NAMES.find(
      (m) =>
        m.value === selectedMonthValue ||
        m.short.toLowerCase() === selectedMonthValue.toLowerCase() ||
        m.label.toLowerCase() === selectedMonthValue.toLowerCase()
    );
    if (monthObj && monthObj.value !== "all") {
      monthSlug = monthObj.label;
    } else if (!monthObj) {
      const monthWords = selectedMonthValue.split(/[^a-zA-Z0-9]+/).filter(Boolean);
      monthSlug =
        monthWords.length > 0
          ? monthWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("-")
          : selectedMonthValue;
    }
  }

  const { slugDateTime } = formatExportDateTimeSlug();
  if (monthSlug) {
    return `${operatorSlug}-${monthSlug}-${slugDateTime}.${extension}`;
  }
  return `${operatorSlug}-${slugDateTime}.${extension}`;
}

export function exportOperatorLogsToExcel(
  logs: OperatorHourLog[],
  user: User,
  assignedMachine?: Machine | null,
  selectedMonthValue: string = "all"
) {
  // Filter logs month-wise if specific month selected
  const targetLogs =
    selectedMonthValue === "all"
      ? logs
      : logs.filter((log) => getLogMonthNumber(log.log_date) === selectedMonthValue);

  const operatorName = user.full_name || "Operator";
  const operatorEmail = user.email || "—";
  const operatorPhone = user.phone || "—";
  const { displayDateTime } = formatExportDateTimeSlug();

  let selectedMonthLabel = "All Months";
  if (selectedMonthValue !== "all") {
    const mObj = MONTH_NAMES.find(
      (m) => m.value === selectedMonthValue || m.short.toLowerCase() === selectedMonthValue.toLowerCase()
    );
    if (mObj) selectedMonthLabel = mObj.label;
  }

  // Top Header Details
  const titleRow = ["OPERATOR DAILY MACHINE LOG REPORT"];
  const headerInfoRow = [
    `Operator Name: ${operatorName}`,
    `Email: ${operatorEmail}`,
    `Number: ${operatorPhone}`,
    `Export Date: ${displayDateTime}`,
    `Month: ${selectedMonthLabel}`,
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
  const fileName = buildExportFileName(operatorName, selectedMonthValue, "xlsx");

  XLSX.writeFile(workbook, fileName);
}

