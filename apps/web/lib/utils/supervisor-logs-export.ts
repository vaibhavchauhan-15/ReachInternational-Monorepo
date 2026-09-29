import * as XLSX from "xlsx";
import type { MachineHourLog } from "@/lib/types/database";
import { formatDate } from "@reachinternational/utils";
import {
  MONTH_NAMES,
  getLogMonthNumber,
  formatExportDateTimeSlug,
  buildExportFileName,
  buildMachineExportFileName,
} from "@/lib/pdf/pdf-config";
import {
  groupLogsByDate,
  formatHoursWithUnit,
} from "@/components/operations/logs/OperationsLogsTable";

export interface ExportSupervisorLogsOptions {
  logs: MachineHourLog[];
  viewMode: "all" | "machine" | "client" | "operator";
  selectedEntityId: string;
  selectedClientId?: string;
  selectedClientName?: string;
  selectedMachineId?: string;
  selectedOperatorId?: string;
  selectedMonthValue: string;
  supervisorName?: string;
  selectedSite?: string;
  selectedClientMachineId?: string;
  machines?: any[];
  customStartDate?: string;
  customEndDate?: string;
}

export function exportSupervisorRunningLogsToExcel({
  logs,
  viewMode,
  selectedEntityId,
  selectedClientId,
  selectedClientName,
  selectedMachineId,
  selectedOperatorId,
  selectedMonthValue,
  supervisorName = "Supervisor",
  selectedSite = "all",
  selectedClientMachineId = "all",
  machines = [],
  customStartDate,
  customEndDate,
}: ExportSupervisorLogsOptions) {
  // 1. Month-wise or Custom Date Range filtering
  let filtered = logs.filter((log) => {
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

  // 2. Entity filtering (by machine, client, or operator)
  if (viewMode === "machine" && selectedEntityId !== "all") {
    const targetMachId = selectedMachineId || selectedEntityId;
    filtered = filtered.filter((log) => log.machine_id === targetMachId);
  } else if (viewMode === "client" && selectedEntityId !== "all") {
    const targetClientId = selectedClientId || (selectedEntityId.includes("-") ? selectedEntityId : undefined);
    const targetClientName = selectedClientName || selectedEntityId;
    filtered = filtered.filter((log) => {
      const matchesId = targetClientId
        ? log.client_id === targetClientId || (log as any)?.client?.id === targetClientId
        : false;
      const clientName =
        (log as any)?.client?.client_name ||
        (log as any)?.client?.company_name ||
        (log.machine as any)?.customer_name ||
        "";
      const matchesName = targetClientName
        ? clientName.toLowerCase().trim() === targetClientName.toLowerCase().trim()
        : false;
      const isClientMch = machines?.some(
        (m) =>
          ((targetClientId && (m.client_id === targetClientId || (m as any).client?.id === targetClientId)) ||
            (targetClientName && ((m as any).client?.company_name || (m as any).customer_name || "").toLowerCase().trim() === targetClientName.toLowerCase().trim())) &&
          m.id === log.machine_id
      );

      // If logs were already pre-filtered by client on the server, keep them
      if (!matchesId && !matchesName && !isClientMch && !targetClientId && !targetClientName) return false;
      if (targetClientId || targetClientName) {
        if (!matchesId && !matchesName && !isClientMch) return false;
      }

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
    const targetOpId = selectedOperatorId || selectedEntityId;
    filtered = filtered.filter((log) => log.operator_id === targetOpId);
  }

  // 3. Group filtered logs into 1-row-per-day cohesive summaries
  const effectiveMode = viewMode === "all" ? "client" : viewMode;
  const isClientView = effectiveMode === "client";
  const isOperatorView = effectiveMode === "operator";
  const { slugDateTime } = formatExportDateTimeSlug();

  let worksheetData: (string | number)[][];
  let merges: XLSX.Range[] = [];
  let colWidths: { wch: number }[];

  if (isClientView) {
    // Client view: Machine-wise grouping with machine details at top and separate summary per machine
    const machineGroupsMap = new Map<string, MachineHourLog[]>();
    for (const log of filtered) {
      const mId = log.machine_id || "unknown";
      if (!machineGroupsMap.has(mId)) {
        machineGroupsMap.set(mId, []);
      }
      machineGroupsMap.get(mId)!.push(log);
    }

    const clientHeaders = [
      "Date",
      "Shift",
      "OPERATOR NAME",
      "M/C RT",
      "WH",
      "B/D",
    ];

    const clientRows: (string | number)[][] = [];
    let grandDayRT = 0;
    let grandWorkingHours = 0;
    let grandBreakdownHours = 0;
    let grandDaysCount = 0;

    const groupKeys = Array.from(machineGroupsMap.keys());
    groupKeys.forEach((mId, groupIdx) => {
      const machineLogs = machineGroupsMap.get(mId)!;
      const mObj = (machineLogs[0]?.machine as any) || machines?.find((m) => m.id === mId) || {};
      const mModel = mObj?.model || mObj?.machine_name || "Machine";
      const mSerial = mObj?.serial_number || mObj?.machine_code || "";
      const mCode = mObj?.machine_code && mObj?.machine_code !== mSerial ? mObj.machine_code : "";
      const mSite = machineLogs[0]?.location || (mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "");

      const machineTitle = [
        `Machine: ${mModel}`,
        mSerial ? `(SN: ${mSerial})` : "",
        mCode ? `[${mCode}]` : "",
        mSite ? `• Site: ${mSite}` : "",
      ].filter(Boolean).join(" ");

      const machineGroupedDaily = groupLogsByDate(machineLogs, "client");
      const machineDays = machineGroupedDaily.length;
      const machineDayRT = machineGroupedDaily.reduce((acc, g) => acc + g.totalRunningHours, 0);
      const machineWorking = machineGroupedDaily.reduce((acc, g) => acc + g.totalWorkingHours, 0);
      const machineBreakdown = machineGroupedDaily.reduce((acc, g) => acc + g.totalBreakdownHours, 0);

      grandDaysCount += machineDays;
      grandDayRT += machineDayRT;
      grandWorkingHours += machineWorking;
      grandBreakdownHours += machineBreakdown;

      // Machine header row
      const titleRowIdx = clientRows.length;
      clientRows.push([machineTitle, "", "", "", "", ""]);
      merges.push({ s: { r: titleRowIdx, c: 0 }, e: { r: titleRowIdx, c: 5 } });

      // Table headers
      clientRows.push(clientHeaders);

      // Daily shift rows for this machine
      machineGroupedDaily.forEach((group) => {
        const totalBdMin = Math.round(group.totalBreakdownHours * 60);
        const maintMin = group.totalMaintenanceMinutes;
        const netBdMin = Math.max(0, totalBdMin - maintMin);
        const fmtMin = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}m` : `${h}h`; };
        let bdCell: string;
        if (totalBdMin === 0) bdCell = "0h";
        else if (maintMin >= totalBdMin && maintMin > 0) bdCell = `MT ${fmtMin(maintMin)}`;
        else if (maintMin > 0 && netBdMin > 0) bdCell = `MT ${fmtMin(maintMin)} / ${fmtMin(netBdMin)}`;
        else bdCell = fmtMin(totalBdMin);
        clientRows.push([
          group.formattedDate,
          group.shiftsDisplay,
          group.operatorsDisplay,
          formatHoursWithUnit(group.totalRunningHours),
          formatHoursWithUnit(group.totalWorkingHours),
          bdCell,
        ]);
      });

      // Machine total summary row
      clientRows.push([
        `Total (${machineDays} days)`,
        "",
        "",
        formatHoursWithUnit(machineDayRT),
        formatHoursWithUnit(machineWorking),
        formatHoursWithUnit(machineBreakdown),
      ]);

      // Blank spacing row between machines
      if (groupIdx < groupKeys.length - 1) {
        clientRows.push(["", "", "", "", "", ""]);
      }
    });

    // If multiple machines, append overall grand total row
    if (groupKeys.length > 1) {
      clientRows.push(["", "", "", "", "", ""]);
      clientRows.push([
        `Grand Total (${grandDaysCount} days across ${groupKeys.length} machines)`,
        "",
        "",
        formatHoursWithUnit(grandDayRT),
        formatHoursWithUnit(grandWorkingHours),
        formatHoursWithUnit(grandBreakdownHours),
      ]);
    }

    worksheetData = clientRows;
    colWidths = [
      { wch: 14 }, // Date
      { wch: 14 }, // Shift
      { wch: 38 }, // OPERATOR NAME
      { wch: 12 }, // M/C RT
      { wch: 12 }, // WH
      { wch: 12 }, // B/D
    ];
  } else {
    // Machine view or Operator view: standard single table layout
    const groupedLogs = groupLogsByDate(filtered, effectiveMode);

    const titleText = isOperatorView
      ? "selected operator summery"
      : "selected machine summery";

    const clientColHeader = isOperatorView ? "Machine" : "Client";

    const tableHeaders = [
      "Date",
      clientColHeader,
      "Shift",
      "OPERATOR NAME",
      "M/C RT",
      "WH",
      "B/D",
    ];

    const dataRows = groupedLogs.map((group) => {
      const entityDisplay = isOperatorView
        ? (group.machineModel ? `${group.machineModel}${group.machineSerial ? ` (${group.machineSerial})` : ""}` : group.clientName || "—")
        : group.clientName;
      const totalBdMin = Math.round(group.totalBreakdownHours * 60);
      const maintMin = group.totalMaintenanceMinutes;
      const netBdMin = Math.max(0, totalBdMin - maintMin);
      const fmtMin = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}m` : `${h}h`; };
      let bdCell: string;
      if (totalBdMin === 0) bdCell = "0h";
      else if (maintMin >= totalBdMin && maintMin > 0) bdCell = `MT ${fmtMin(maintMin)}`;
      else if (maintMin > 0 && netBdMin > 0) bdCell = `MT ${fmtMin(maintMin)} / ${fmtMin(netBdMin)}`;
      else bdCell = fmtMin(totalBdMin);
      return [
        group.formattedDate,
        entityDisplay,
        group.shiftsDisplay,
        group.operatorsDisplay,
        formatHoursWithUnit(group.totalRunningHours),
        formatHoursWithUnit(group.totalWorkingHours),
        bdCell,
      ];
    });

    const totalDays = groupedLogs.length;
    const sumDayRT = groupedLogs.reduce((acc, g) => acc + g.totalRunningHours, 0);
    const sumWorkingHours = groupedLogs.reduce((acc, g) => acc + g.totalWorkingHours, 0);
    const sumBreakdownHours = groupedLogs.reduce((acc, g) => acc + g.totalBreakdownHours, 0);

    const totalHeaderRow = ["Total", "", "", "", "", "", ""];
    const totalValuesRow = [
      `${totalDays} days`,
      "",
      "",
      "",
      formatHoursWithUnit(sumDayRT),
      formatHoursWithUnit(sumWorkingHours),
      formatHoursWithUnit(sumBreakdownHours),
    ];

    worksheetData = [
      ["", "", "", "", "", "", ""],
      ["", "", "", titleText, "", "", ""],
      tableHeaders,
      ...dataRows,
      totalHeaderRow,
      totalValuesRow,
    ];

    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 6 } });

    colWidths = [
      { wch: 14 }, // Date (e.g. 28-Sep-26)
      { wch: 28 }, // Client (e.g. Tata Projects LTD)
      { wch: 14 }, // Shift (e.g. S1/S2/S3)
      { wch: 38 }, // OPERATOR NAME
      { wch: 12 }, // M/C RT
      { wch: 12 }, // WH
      { wch: 12 }, // B/D
    ];
  }

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  if (merges.length > 0) {
    worksheet["!merges"] = merges;
  }
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Running Hours Logs");

  let fileName = "";
  if (isOperatorView) {
    const firstOpObj = filtered[0]?.operator as any;
    const opName = firstOpObj?.full_name || "Operator";
    fileName = buildExportFileName(opName, selectedMonthValue, "xlsx", customStartDate, customEndDate);
  } else if (viewMode === "machine") {
    const selectedMachine = machines?.find((m) => m.id === (selectedMachineId || selectedEntityId)) || (filtered[0]?.machine as any);
    const mSerial = selectedMachine?.serial_number || selectedMachine?.machine_code || (filtered[0]?.machine as any)?.serial_number || (filtered[0]?.machine as any)?.machine_code || "Machine";
    fileName = buildMachineExportFileName(mSerial, "xlsx", customStartDate, customEndDate);
  } else if (viewMode === "client" && selectedClientMachineId && selectedClientMachineId !== "all") {
    const clientMachine = machines?.find((m) => m.id === selectedClientMachineId) || filtered.find((l) => l.machine_id === selectedClientMachineId)?.machine;
    const mSerial = (clientMachine as any)?.serial_number || (clientMachine as any)?.machine_code || "Machine";
    fileName = buildMachineExportFileName(mSerial, "xlsx", customStartDate, customEndDate);
  } else if (viewMode === "client") {
    const rawClientName = selectedClientName || (selectedEntityId && !selectedEntityId.includes("-") ? selectedEntityId : (filtered[0]?.client as any)?.company_name || (filtered[0]?.client as any)?.client_name || "Client");
    const clientSlug = rawClientName.split(/[^a-zA-Z0-9]+/).filter(Boolean).join("-") || "Client";
    const monthSlug = selectedMonthValue === "custom" && customStartDate && customEndDate
      ? `${formatDate(customStartDate).replace(/\s+/g, "")}-to-${formatDate(customEndDate).replace(/\s+/g, "")}`
      : selectedMonthValue !== "all"
      ? (MONTH_NAMES.find((m) => m.value === selectedMonthValue)?.short || selectedMonthValue)
      : "AllMonths";
    fileName = `${clientSlug}-${monthSlug}-${slugDateTime}.xlsx`;
  } else {
    const modeSlug = viewMode.charAt(0).toUpperCase() + viewMode.slice(1);
    fileName = `Supervisor-Running-Logs-${modeSlug}-${slugDateTime}.xlsx`;
  }

  XLSX.writeFile(workbook, fileName);
}
