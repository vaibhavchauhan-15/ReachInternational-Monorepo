import * as XLSX from "xlsx";
import type { MachineHourLog } from "@/lib/types/database";
import { formatDate } from "@reachinternational/utils";
import {
  MONTH_NAMES,
  getLogMonthNumber,
  formatExportDateTimeSlug,
  formatCompactTiming,
  buildExportFileName,
  buildMachineExportFileName,
} from "./operator-logs-export";

export interface ExportSupervisorLogsOptions {
  logs: MachineHourLog[];
  viewMode: "all" | "machine" | "client" | "operator";
  selectedEntityId: string;
  selectedMonthValue: string;
  supervisorName?: string;
  selectedSite?: string;
  selectedClientMachineId?: string;
  machines?: any[];
}

export function exportSupervisorRunningLogsToExcel({
  logs,
  viewMode,
  selectedEntityId,
  selectedMonthValue,
  supervisorName = "Supervisor",
  selectedSite = "all",
  selectedClientMachineId = "all",
  machines = [],
}: ExportSupervisorLogsOptions) {
  // 1. Month-wise filtering
  let filtered = selectedMonthValue === "all"
    ? logs
    : logs.filter((log) => getLogMonthNumber(log.log_date) === selectedMonthValue);

  // 2. Entity filtering (by machine, client, or operator)
  if (viewMode === "machine" && selectedEntityId !== "all") {
    filtered = filtered.filter((log) => log.machine_id === selectedEntityId);
  } else if (viewMode === "client" && selectedEntityId !== "all") {
    filtered = filtered.filter((log) => {
      const clientName = (log.machine as any)?.customer_name || "Unassigned Client";
      const matchesClient = clientName.toLowerCase() === selectedEntityId.toLowerCase();
      if (!matchesClient) return false;

      if (selectedSite && selectedSite !== "all") {
        const mObj = log.machine as any;
        const siteStr = log.location || (mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "");
        if (!siteStr.toLowerCase().includes(selectedSite.toLowerCase())) return false;
      }

      if (selectedClientMachineId && selectedClientMachineId !== "all") {
        if (log.machine_id !== selectedClientMachineId) return false;
      }

      return true;
    });
  } else if (viewMode === "operator" && selectedEntityId !== "all") {
    filtered = filtered.filter((log) => log.operator_id === selectedEntityId);
  }

  const { displayDateTime, slugDateTime } = formatExportDateTimeSlug();

  let monthLabel = "All Months";
  if (selectedMonthValue !== "all") {
    const mObj = MONTH_NAMES.find((m) => m.value === selectedMonthValue);
    if (mObj) monthLabel = mObj.label;
  }

  const firstOpObj = filtered[0]?.operator as any;
  const opName = firstOpObj?.full_name || "Selected Operator";
  const opPhone = firstOpObj?.phone || "—";

  let filterLabel = "All Fleet Logs";
  if (viewMode === "machine" && selectedEntityId !== "all") {
    const mName = (filtered[0]?.machine as any)?.machine_name || "Selected Machine";
    const mCode = (filtered[0]?.machine as any)?.machine_code || "";
    filterLabel = `Machine: ${mName} (${mCode})`;
  } else if (viewMode === "client" && selectedEntityId !== "all") {
    const siteText = selectedSite && selectedSite !== "all" ? ` | Site: ${selectedSite}` : "";
    const machineText = selectedClientMachineId && selectedClientMachineId !== "all"
      ? ` | Machine: ${filtered.find((l) => l.machine_id === selectedClientMachineId)?.machine?.machine_name || selectedClientMachineId}`
      : "";
    filterLabel = `Client: ${selectedEntityId}${siteText}${machineText}`;
  } else if (viewMode === "operator" && selectedEntityId !== "all") {
    filterLabel = `Operator: ${opName}`;
  }

  // Header Rows
  const isOperatorView = viewMode === "operator";
  const titleRow = [
    isOperatorView
      ? "OPERATOR DAILY MACHINE LOG REPORT"
      : viewMode === "client"
      ? "SITE MACHINE RUNNING HOURS REPORT"
      : viewMode === "machine"
      ? "MACHINE RUNNING HOURS REPORT"
      : "SUPERVISOR MACHINE RUNNING HOURS REPORT",
  ];

  let filterScopeText = `Filter Scope: ${filterLabel}`;
  if (viewMode === "client" && selectedEntityId !== "all") {
    filterScopeText = `Client: ${selectedEntityId}`;
  } else if (viewMode === "machine" && selectedEntityId !== "all") {
    const mName = (filtered[0]?.machine as any)?.machine_name || "Selected Machine";
    const mCode = (filtered[0]?.machine as any)?.machine_code || "";
    const mModel = (filtered[0]?.machine as any)?.model || "—";
    const mSerial = (filtered[0]?.machine as any)?.serial_number || mCode || "—";
    filterScopeText = `Machine: ${mName} | Model: ${mModel} | Serial/Code: ${mSerial}`;
  }

  let totalRunningHoursAcc = 0;
  let totalOtHoursAcc = 0;
  let totalBreakdownsAcc = 0;

  const dataRows = filtered.map((log, idx) => {
    const startMtr = log.start_meter ?? 0;
    const endMtr = log.end_meter ?? startMtr;
    const runningHrs = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
    const otHrs = log.overtime_hours || 0;
    const isBkd = log.is_breakdown;

    totalRunningHoursAcc += runningHrs;
    totalOtHoursAcc += otHrs;
    if (isBkd) totalBreakdownsAcc++;

    const mObj = log.machine as any;
    const opObj = log.operator as any;

    const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*([^\]]+)\]/);
    const bkdDetails = bkdMatch ? bkdMatch[1] : isBkd ? "Breakdown" : null;
    const cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/, "").trim() || "—";

    if (isOperatorView) {
      return [
        idx + 1,
        formatDate(log.log_date),
        mObj?.machine_name || "Machine",
        mObj?.machine_code || "—",
        mObj?.model || "—",
        formatCompactTiming(log.start_time, log.end_time),
        `${runningHrs} hrs`,
        `${otHrs} hrs`,
        isBkd ? `Breakdown${bkdDetails ? ` (${bkdDetails})` : ""}` : "Normal",
        cleanRemarks,
      ];
    }

    if (viewMode === "client") {
      const siteLoc = log.location || (mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "—");
      return [
        idx + 1,
        formatDate(log.log_date),
        mObj?.machine_name || "Machine",
        mObj?.machine_code || "—",
        mObj?.model || "—",
        mObj?.customer_name || "Unassigned Client",
        siteLoc,
        mObj?.city ? `${mObj.city}${mObj.state ? `, ${mObj.state}` : ""}` : "—",
        opObj?.full_name || "Unassigned",
        log.start_time || "—",
        log.end_time || "—",
        `${runningHrs} hrs`,
        `${otHrs} hrs`,
        isBkd ? "Yes (Breakdown)" : "No Breakdown",
        cleanRemarks,
      ];
    }

    if (viewMode === "machine") {
      return [
        idx + 1,
        formatDate(log.log_date),
        mObj?.customer_name || "Unassigned Client",
        mObj?.city ? `${mObj.city}, ${mObj.state || ""}` : "—",
        opObj?.full_name || "Unassigned",
        startMtr,
        endMtr,
        `${runningHrs} hrs`,
        log.remarks || "—",
      ];
    }

    return [
      idx + 1,
      formatDate(log.log_date),
      mObj?.machine_name || "Machine",
      mObj?.machine_code || "—",
      mObj?.model || "—",
      mObj?.customer_name || "Unassigned Client",
      mObj?.city ? `${mObj.city}, ${mObj.state || ""}` : "—",
      opObj?.full_name || "Unassigned",
      startMtr,
      endMtr,
      `${runningHrs} hrs`,
      log.remarks || "—",
    ];
  });

  const metaRow = isOperatorView ? [
    `Operator: ${opName}`,
    `Operator Number: ${opPhone}`,
    `Supervisor: ${supervisorName}`,
    `Month: ${monthLabel}`,
    `Export Date: ${displayDateTime}`,
  ] : viewMode === "machine" && selectedEntityId !== "all" ? [
    filterScopeText,
    `Total Run: ${Math.round(totalRunningHoursAcc * 10) / 10} hrs`,
    `Total Services: ${machines?.find((m) => m.id === selectedEntityId)?.service_count ?? 0}`,
    `Month: ${monthLabel}`,
    `Export Date: ${displayDateTime}`,
  ] : [
    `Supervisor: ${supervisorName}`,
    `Filter Mode: ${viewMode.toUpperCase()}`,
    filterScopeText,
    `Month: ${monthLabel}`,
    `Export Date: ${displayDateTime}`,
  ];
  const blankRow = [""];

  // Table Columns
  const tableHeaders = isOperatorView ? [
    "S.No",
    "Log Date",
    "Machine Name",
    "Machine Code",
    "Model",
    "Timings",
    "Operating Hours (OP)",
    "Overtime Hours (OT)",
    "Status",
    "Remarks / Notes",
  ] : viewMode === "client" ? [
    "S.No",
    "Log Date",
    "Machine Name",
    "Machine Code",
    "Model",
    "Client / Customer Name",
    "Site / Location",
    "City / State",
    "Operator Name",
    "Start Time",
    "End Time",
    "Running Hours",
    "Overtime Hours",
    "Breakdown Status",
    "Remarks / Notes",
  ] : viewMode === "machine" ? [
    "S.No",
    "Log Date",
    "Client / Customer Name",
    "Location / City",
    "Operator Name",
    "Start Meter (hrs)",
    "End Meter (hrs)",
    "Run Hours (RT)",
    "Remarks / Notes",
  ] : [
    "S.No",
    "Log Date",
    "Machine Name",
    "Machine Code",
    "Model",
    "Client / Customer Name",
    "Location / City",
    "Operator Name",
    "Start Meter (hrs)",
    "End Meter (hrs)",
    "Run Hours (RT)",
    "Remarks / Notes",
  ];

  const summaryRow = isOperatorView ? [
    "SUMMARY TOTALS",
    `Total Logs: ${filtered.length}`,
    "",
    "",
    "",
    "",
    `Total Run: ${Math.round(totalRunningHoursAcc * 10) / 10} hrs`,
    `Total OT: ${Math.round(totalOtHoursAcc * 10) / 10} hrs`,
    `Breakdowns: ${totalBreakdownsAcc}`,
    "",
    "",
  ] : viewMode === "client" ? [
    "SUMMARY TOTALS",
    `Total Logs: ${filtered.length}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    `Total Run: ${Math.round(totalRunningHoursAcc * 10) / 10} hrs`,
    `Total OT: ${Math.round(totalOtHoursAcc * 10) / 10} hrs`,
    `Breakdowns: ${totalBreakdownsAcc}`,
    "",
  ] : viewMode === "machine" ? [
    "SUMMARY TOTALS",
    `Total Logs: ${filtered.length}`,
    "",
    "",
    "",
    "",
    "",
    `Total Run: ${Math.round(totalRunningHoursAcc * 10) / 10} hrs`,
    "",
  ] : [
    "SUMMARY TOTALS",
    `Total Logs: ${filtered.length}`,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    `Total Run: ${Math.round(totalRunningHoursAcc * 10) / 10} hrs`,
    `Breakdowns: ${totalBreakdownsAcc}`,
    "",
  ];

  const worksheetData = [
    titleRow,
    metaRow,
    blankRow,
    tableHeaders,
    ...dataRows,
    blankRow,
    summaryRow,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  worksheet["!cols"] = isOperatorView ? [
    { wch: 8 },  // S.No
    { wch: 15 }, // Log Date
    { wch: 30 }, // Machine Name
    { wch: 18 }, // Machine Code
    { wch: 18 }, // Model
    { wch: 20 }, // Timings
    { wch: 20 }, // Operating Hours
    { wch: 16 }, // Overtime Hours
    { wch: 18 }, // Status
    { wch: 35 }, // Remarks
  ] : viewMode === "client" ? [
    { wch: 8 },  // S.No
    { wch: 15 }, // Log Date
    { wch: 30 }, // Machine Name
    { wch: 18 }, // Machine Code
    { wch: 18 }, // Model
    { wch: 28 }, // Client Name
    { wch: 25 }, // Site Location
    { wch: 20 }, // City / State
    { wch: 22 }, // Operator Name
    { wch: 14 }, // Start Time
    { wch: 14 }, // End Time
    { wch: 18 }, // Running Hours
    { wch: 16 }, // Overtime Hours
    { wch: 20 }, // Breakdown Status
    { wch: 35 }, // Remarks
  ] : viewMode === "machine" ? [
    { wch: 8 },  // S.No
    { wch: 15 }, // Log Date
    { wch: 28 }, // Client Name
    { wch: 20 }, // Location
    { wch: 22 }, // Operator Name
    { wch: 18 }, // Start Meter
    { wch: 18 }, // End Meter
    { wch: 18 }, // Running Hours
    { wch: 35 }, // Remarks
  ] : [
    { wch: 8 },  // S.No
    { wch: 15 }, // Log Date
    { wch: 30 }, // Machine Name
    { wch: 18 }, // Machine Code
    { wch: 18 }, // Model
    { wch: 28 }, // Client Name
    { wch: 20 }, // Location
    { wch: 22 }, // Operator Name
    { wch: 18 }, // Start Meter
    { wch: 18 }, // End Meter
    { wch: 18 }, // Running Hours
    { wch: 35 }, // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Running Hours Logs");

  let fileName = "";
  if (isOperatorView) {
    fileName = buildExportFileName(opName, selectedMonthValue, "xlsx");
  } else if (viewMode === "machine") {
    const selectedMachine = machines?.find((m) => m.id === selectedEntityId) || (filtered[0]?.machine as any);
    const mSerial = selectedMachine?.serial_number || selectedMachine?.machine_code || (filtered[0]?.machine as any)?.serial_number || (filtered[0]?.machine as any)?.machine_code || "Machine";
    fileName = buildMachineExportFileName(mSerial, "xlsx");
  } else if (viewMode === "client" && selectedClientMachineId && selectedClientMachineId !== "all") {
    const clientMachine = machines?.find((m) => m.id === selectedClientMachineId) || filtered.find((l) => l.machine_id === selectedClientMachineId)?.machine;
    const mSerial = (clientMachine as any)?.serial_number || (clientMachine as any)?.machine_code || "Machine";
    fileName = buildMachineExportFileName(mSerial, "xlsx");
  } else if (viewMode === "client") {
    const clientSlug = (selectedEntityId || "Client").split(/[^a-zA-Z0-9]+/).filter(Boolean).join("-") || "Client";
    fileName = `${clientSlug}-${slugDateTime}.xlsx`;
  } else {
    const modeSlug = viewMode.charAt(0).toUpperCase() + viewMode.slice(1);
    fileName = `Supervisor-Running-Logs-${modeSlug}-${slugDateTime}.xlsx`;
  }

  XLSX.writeFile(workbook, fileName);
}
