import * as XLSX from "xlsx";
import { formatMinutes } from "@reachinternational/utils";

export interface AttendanceExportEmployee {
  id: string;
  employee_id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  shift_start_time?: string | null;
  shift_end_time?: string | null;
}

export interface AttendanceExportDay {
  date: string;
  dow: number;
  status: string;
  effectiveStatus?: string;
  worked_minutes: number;
  overtime_minutes: number;
  breakdown_minutes: number;
  log_count: number;
  punchIn?: string | null;
  punchOut?: string | null;
  primaryMachine?: string;
  primaryLocation?: string;
  isToday?: boolean;
}

export interface AttendanceExportMetrics {
  present: number;
  absent: number;
  halfDay: number;
  weekOff: number;
  payableDays: number;
  totalWorkedMins: number;
  totalOtMins: number;
  attendanceRate: number;
  scheduledHoursTotal?: number;
}

export interface ExportAttendanceExcelOptions {
  employee: AttendanceExportEmployee;
  currentMonth: string; // "2026-09"
  days: AttendanceExportDay[];
  metrics: AttendanceExportMetrics;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_NAMES: Record<string, string> = {
  PRESENT: "Present",
  HALF_DAY: "Half Day",
  ABSENT: "Absent",
  WEEK_OFF: "Week Off",
  DISABLED: "Upcoming",
};

function formatTimeAMPM(timeStr: string | null | undefined): string {
  if (!timeStr) return "—";
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return timeStr;
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(h12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function exportAttendanceToExcel({
  employee,
  currentMonth,
  days,
  metrics,
}: ExportAttendanceExcelOptions): void {
  const [yearStr, monthStr] = currentMonth.split("-");
  const monthDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const monthName = monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const formattedEmpId = employee.employee_id || `EMP-${employee.id.slice(0, 8).toUpperCase()}`;
  const locationStr = employee.city
    ? `${employee.city}${employee.state ? `, ${employee.state}` : ""}`
    : "All Sites";

  const worksheetData: (string | number)[][] = [
    // Header Title
    ["REACH INTERNATIONAL — MONTHLY ATTENDANCE REPORT"],
    [
      `Period: ${monthName} (${currentMonth})`,
      "",
      `Exported: ${new Date().toLocaleString("en-IN")}`,
    ],
    // User Details in Header
    [
      `Employee Name: ${employee.full_name}`,
      `Employee ID: ${formattedEmpId}`,
      `Role: ${employee.role.toUpperCase()}`,
      `Phone: ${employee.phone || "—"}`,
      `Location: ${locationStr}`,
    ],
    // KPI Metrics Summary in Header
    [
      `Summary: Total Days: ${days.length} | Present: ${metrics.present} | Absent: ${metrics.absent} | Half Day: ${metrics.halfDay} | Week Off: ${metrics.weekOff} | Worked: ${formatMinutes(metrics.totalWorkedMins)} | OT: ${formatMinutes(metrics.totalOtMins)} | Payable Days: ${metrics.payableDays.toFixed(1)}`,
    ],
    [], // Blank separator
    // Table Header Row
    [
      "#",
      "Date",
      "Day",
      "Status",
      "Start Time",
      "End Time",
      "Worked Hours",
      "Overtime Hours",
      "Primary Machine",
      "Site Location",
      "Log Count",
    ],
  ];

  // Data Rows
  const tableDataRows: (string | number)[][] = days.map((d, idx) => {
    const displayStatus =
      d.effectiveStatus === "DISABLED"
        ? d.isToday
          ? "In Progress"
          : "Upcoming"
        : STATUS_NAMES[d.status] || d.status;

    const workedHrsStr =
      d.worked_minutes > 0
        ? (d.worked_minutes / 60).toFixed(2) + " hrs"
        : d.status === "WEEK_OFF"
        ? "Week Off"
        : "0.00 hrs";

    const otHrsStr =
      d.overtime_minutes > 0
        ? (d.overtime_minutes / 60).toFixed(2) + " hrs"
        : "0.00 hrs";

    return [
      idx + 1,
      d.date,
      DOW_LABELS[d.dow] || "",
      displayStatus,
      d.punchIn ? formatTimeAMPM(d.punchIn) : "—",
      d.punchOut ? formatTimeAMPM(d.punchOut) : "—",
      workedHrsStr,
      otHrsStr,
      d.primaryMachine || "—",
      d.primaryLocation || "—",
      d.log_count,
    ];
  });

  tableDataRows.forEach((row) => worksheetData.push(row));

  // Summary Footer
  const summaryRow: (string | number)[] = [
    "Monthly Totals",
    "",
    "",
    `${metrics.present} Present / ${metrics.absent} Absent`,
    "",
    "",
    `${(metrics.totalWorkedMins / 60).toFixed(2)} hrs`,
    `${(metrics.totalOtMins / 60).toFixed(2)} hrs`,
    `${metrics.payableDays.toFixed(1)} Payable Days`,
    `${metrics.attendanceRate}% Compliance`,
    "",
  ];

  worksheetData.push([]);
  worksheetData.push(summaryRow);

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Column Width Calculation:
  // Dynamically calculate width based on the maximum value's string length in each column
  const tableHeaderRowIndex = 5; // 0-indexed row of table headers
  const tableHeaders = worksheetData[tableHeaderRowIndex] as string[];

  const colWidths = tableHeaders.map((header, colIdx) => {
    let maxLen = String(header).length;

    tableDataRows.forEach((row) => {
      const val = row[colIdx];
      if (val != null) {
        const strLen = String(val).length;
        if (strLen > maxLen) {
          maxLen = strLen;
        }
      }
    });

    const summaryVal = summaryRow[colIdx];
    if (summaryVal != null && colIdx > 0) {
      const strLen = String(summaryVal).length;
      if (strLen > maxLen) {
        maxLen = strLen;
      }
    }

    // Add breathing room (+4) and apply a sensible minimum width
    const minWidth = colIdx === 0 ? 6 : colIdx === 1 ? 12 : 11;
    return { wch: Math.max(maxLen + 4, minWidth) };
  });

  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Attendance");

  const sanitizedEmpName = employee.full_name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Attendance_${sanitizedEmpName}_${currentMonth}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
