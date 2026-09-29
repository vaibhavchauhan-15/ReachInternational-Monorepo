import * as XLSX from "xlsx";
import type { TodayShiftMonitorRow } from "@/lib/data/operations/today-shift-monitor";
import { formatDate, getISTDateString } from "@reachinternational/utils";

export interface TodayShiftExportMetrics {
  total: number;
  entered: number;
  pending: number;
  unassigned: number;
  totalRunningHours: number;
}

const formatTime12H = (t?: string | null): string => {
  if (!t) return "—";
  try {
    const [h, m] = t.split(":").map(Number);
    if (isNaN(h)) return t;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m || 0).padStart(2, "0")} ${ampm}`;
  } catch {
    return t;
  }
};

export function exportTodayShiftLogsToExcel(
  rows: TodayShiftMonitorRow[],
  dateStr: string = getISTDateString()
): void {
  const total = rows.length;
  const entered = rows.filter((r) => r.status === "entered").length;
  const pending = rows.filter((r) => r.status === "pending").length;
  const unassigned = rows.filter((r) => r.status === "unassigned" || !r.operator_id).length;
  const totalRunningHours = rows.reduce(
    (acc, r) => acc + (typeof r.running_hours === "number" ? r.running_hours : 0),
    0
  );

  const worksheetData: (string | number)[][] = [
    // Header Title
    ["REACH INTERNATIONAL — DAILY SHIFT LOGS MONITOR"],
    [`Date: ${formatDate(dateStr)} (${dateStr})`, "", `Generated: ${new Date().toLocaleString("en-IN")}`],
    [
      `Summary: Total Shifts: ${total} | Entered: ${entered} | Pending: ${pending} | Unassigned: ${unassigned} | Total Running Hours: ${totalRunningHours.toFixed(1)}h`,
    ],
    [], // Blank separator
    // Table Header Row
    [
      "#",
      "Operator Name",
      "Phone",
      "Machine Code",
      "Model",
      "Serial Number",
      "Client",
      "Client Code",
      "Shift",
      "Shift Name",
      "Shift Timings",
      "Status",
      "Entered By",
      "Source",
      "Start HMR (hrs)",
      "End HMR (hrs)",
      "Running Hours (hrs)",
    ],
  ];

  // Data Rows
  rows.forEach((r, idx) => {
    const statusLabel =
      r.status === "entered"
        ? "Entered"
        : r.status === "unassigned" || !r.operator_id
        ? "Unassigned"
        : "Pending";

    const timings =
      r.shift_start && r.shift_end
        ? `${formatTime12H(r.shift_start)} – ${formatTime12H(r.shift_end)}`
        : "—";

    worksheetData.push([
      idx + 1,
      r.operator_name || (r.status === "unassigned" ? "Unassigned Machine" : "—"),
      r.operator_phone || "—",
      r.machine_code || "—",
      r.machine_model || "—",
      r.machine_serial_number || "—",
      r.client_name || "—",
      r.client_code || r.client_id || "—",
      r.shift_code ? `Shift ${r.shift_code}` : "—",
      r.shift_name || "—",
      timings,
      statusLabel,
      r.entered_by_name || "—",
      r.entry_source || "—",
      r.start_meter != null ? Number(r.start_meter) : "",
      r.end_meter != null ? Number(r.end_meter) : "",
      r.running_hours != null ? Number(r.running_hours) : "",
    ]);
  });

  // Summary Footer Rows
  worksheetData.push([]);
  worksheetData.push([
    "Total",
    `${total} Shifts`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    `${entered}/${total} Entered`,
    "",
    "",
    "",
    "",
    `${totalRunningHours.toFixed(1)}h`,
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Column Widths
  worksheet["!cols"] = [
    { wch: 6 },  // #
    { wch: 22 }, // Operator Name
    { wch: 15 }, // Phone
    { wch: 16 }, // Machine Code
    { wch: 20 }, // Model
    { wch: 20 }, // Serial Number
    { wch: 24 }, // Client
    { wch: 14 }, // Client Code
    { wch: 12 }, // Shift
    { wch: 18 }, // Shift Name
    { wch: 22 }, // Shift Timings
    { wch: 14 }, // Status
    { wch: 20 }, // Entered By
    { wch: 12 }, // Source
    { wch: 16 }, // Start HMR
    { wch: 16 }, // End HMR
    { wch: 18 }, // Running Hours
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Today Shift Logs");

  const fileName = `Today_Shift_Monitor_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
