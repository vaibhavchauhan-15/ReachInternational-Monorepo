"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui";
import type { User, MachineHourLog } from "@/lib/types/database";
import { formatDate, parseBreakdownString } from "@reachinternational/utils";
import {
  isUuid,
  formatCompactTiming,
  resolveCleanClientName,
  resolvePeriodLabel,
  resolveClientLocation,
  openPrintWindow,
  resolveShiftCode,
  PDFReportHeader,
  PDFKPIStrip,
  PDFSignatureBlock,
  PDFTableWrapper,
} from "@/components/pdf";
import {
  MONTH_NAMES,
  getCurrentMonthNumber,
  formatExportDateTimeSlug,
  buildExportFileName,
  buildMachineExportFileName,
} from "@/lib/pdf/pdf-config";
import { getPrintStylesheet } from "@/lib/pdf/pdf-print-styles";
import { getOperationsExportLogsAction } from "@/app/actions/operators";
import { groupLogsByDate, formatDayOfWeek, formatHoursWithUnit, calculateShiftWorkingHours } from "./logs/OperationsLogsTable";
import { Printer, FileSpreadsheet, Loader2, Calendar } from "lucide-react";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { getISTDateString } from "@reachinternational/utils";

// ─── Constants ───────────────────────────────────────────────────────────────
const PRINT_DOC_ID = "printable-supervisor-logs-document";
const PREVIEW_ID = "printable-supervisor-logs-document-preview";

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface PrintableSupervisorLogsModalProps {
  open: boolean;
  onClose: () => void;
  logs?: MachineHourLog[];
  user: User;
  viewMode: "all" | "machine" | "client" | "operator";
  selectedEntityId: string;
  selectedEntityName?: string;
  selectedClientId?: string;
  selectedClientName?: string;
  selectedMachineId?: string;
  selectedOperatorId?: string;
  selectedMonthValue: string;
  selectedSite?: string;
  selectedClientMachineId?: string;
  machines?: any[];
  clientSites?: string[];
  clientMachines?: any[];
  customStartDate?: string;
  customEndDate?: string;
  search?: string;
}

interface SupervisorReportContentProps {
  logs: MachineHourLog[];
  user: User;
  viewMode: "all" | "machine" | "client" | "operator";
  selectedEntityId: string;
  selectedEntityName?: string;
  selectedClientId?: string;
  selectedClientName?: string;
  selectedMonth: string;
  customStartDate?: string;
  customEndDate?: string;
  totalRunningHours: number;
  totalOtHours: number;
  totalBreakdowns: number;
  totalWorkingHours?: number;
  selectedSite?: string;
  selectedClientMachineId?: string;
  machines?: any[];
}

// ─── Row Height Helper ────────────────────────────────────────────────────────
/**
 * Calculates optimal row height (in mm) for A4 portrait document so the table
 * content dynamically fills the page, eliminates large empty voids, and guarantees
 * that when isFirstPage and isLastPage are both true (1-page report), header,
 * table, and signature footer all fit comfortably on the single page without spilling.
 */
function calculateA4RowHeight({
  rowCount,
  isFirstPage,
  isLastPage,
  hasKpiStrip = false,
  hasMachineBanner = false,
}: {
  rowCount: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  hasKpiStrip?: boolean;
  hasMachineBanner?: boolean;
}): { rowHeightMm: number; footerRowHeightMm: number } {
  // Printable A4 height is 287mm. We target 278mm to guarantee safe margin against browser print engine overflow
  const TARGET_PAGE_H_MM = 278;

  let fixedH = 0;
  if (isFirstPage) {
    fixedH += 34; // PDFReportHeader (logo, title, subtitle, metadata strip)
    if (hasKpiStrip) fixedH += 15; // PDFKPIStrip
  }
  if (hasMachineBanner) {
    fixedH += 9; // Machine banner
  }
  fixedH += 8; // thead
  fixedH += 9; // tfoot
  if (isLastPage) {
    fixedH += 28; // PDFSignatureBlock (3-col signatures)
  }
  fixedH += 6; // container padding, borders, gaps

  const availableHeightMm = Math.max(50, TARGET_PAGE_H_MM - fixedH);
  const count = Math.max(1, rowCount);

  // Distribute available vertical space evenly across rows
  const rawRowH = availableHeightMm / count;

  // Clamping bounds:
  // MIN: 5.6mm - ensures 31 rows fit cleanly with header, KPI strip, and footer on 1 page!
  // MAX: 10.5mm - prevents rows from looking unnaturally tall when there are only a few rows (e.g. 5-10 rows)
  const MIN_ROW_MM = 5.6;
  const MAX_ROW_MM = 10.5;

  const rowHeightMm = Math.min(MAX_ROW_MM, Math.max(MIN_ROW_MM, rawRowH));
  const footerRowHeightMm = Math.min(9, Math.max(5.5, rowHeightMm * 0.9));

  return {
    rowHeightMm: Math.round(rowHeightMm * 10) / 10,
    footerRowHeightMm: Math.round(footerRowHeightMm * 10) / 10,
  };
}

// ─── Report Content ──────────────────────────────────────────────────────────

function SupervisorLogsReportContent({
  logs,
  user,
  viewMode,
  selectedEntityId,
  selectedEntityName,
  selectedMonth,
  customStartDate,
  customEndDate,
  totalRunningHours,
  totalOtHours,
  totalBreakdowns,
  totalWorkingHours = 0,
  selectedSite,
  selectedClientMachineId,
  machines,
}: SupervisorReportContentProps) {
  const isOperatorView = viewMode === "operator";
  const supervisorName = user.full_name || "Supervisor";
  const supervisorPhone = user.phone || "";
  const selectedMachineObj =
    machines?.find((m: any) => m.id === selectedEntityId) ||
    (logs[0]?.machine as any);

  // Report Title
  const reportTitle = isOperatorView
    ? "OPERATOR DAILY MACHINE LOG REPORT"
    : viewMode === "client"
    ? "SITE MACHINE RUNNING HOURS REPORT"
    : viewMode === "machine"
    ? "MACHINE RUNNING HOURS REPORT"
    : "SUPERVISOR MACHINE RUNNING HOURS REPORT";

  // Operator Info (if operator view)
  const operatorName = isOperatorView
    ? selectedEntityName || logs[0]?.operator?.full_name || user.full_name || "Operator"
    : "";
  const operatorPhone = isOperatorView
    ? (logs[0]?.operator as any)?.phone || user.phone || ""
    : "";

  // Client name cleanup
  const cleanClientName =
    viewMode === "client"
      ? selectedEntityName || (logs[0]?.client as any)?.client_name || "Client"
      : "";

  // Client location cleanup
  const resolvedClientLocation =
    (logs[0] as any)?.site_location ||
    (logs[0]?.client as any)?.city ||
    (logs[0]?.machine as any)?.client?.city ||
    "";

  // Subtitle Parts (pipe-separated, single line)
  const subtitleParts: string[] = [];
  if (viewMode === "client") {
    subtitleParts.push(`CLIENT: ${(cleanClientName || "ALL CLIENTS").toUpperCase()}`);
    if (selectedClientMachineId && selectedClientMachineId !== "all") {
      const cMachine = machines?.find((m: any) => m.id === selectedClientMachineId) || logs.find((l: any) => l.machine_id === selectedClientMachineId)?.machine;
      const cMachName = (cMachine as any)?.machine_name || (cMachine as any)?.model || selectedClientMachineId;
      subtitleParts.push(`MACHINE: ${cMachName.toUpperCase()}`);
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    } else {
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    }
  } else if (viewMode === "machine") {
    const mMfr = selectedMachineObj?.manufacturer || (logs[0]?.machine as any)?.manufacturer || "";
    const mModel = selectedMachineObj?.model || (logs[0]?.machine as any)?.model || "MACHINE";
    const mSerial = selectedMachineObj?.serial_number || selectedMachineObj?.machine_code || (logs[0]?.machine as any)?.serial_number || (logs[0]?.machine as any)?.machine_code || "N/A";
    const machDisplay = selectedEntityId !== "all" ? `${mMfr ? `${mMfr} ` : ""}${mModel}` : "ALL FLEET MACHINES";
    subtitleParts.push(`EQUIPMENT: ${machDisplay.toUpperCase()}`);
    if (selectedEntityId !== "all") {
      subtitleParts.push(`SERIAL NO.: ${mSerial.toUpperCase()}`);
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    } else {
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    }
  } else if (isOperatorView) {
    const opDisplay = selectedEntityId !== "all" ? operatorName : "ALL OPERATORS";
    subtitleParts.push(`OPERATOR: ${opDisplay.toUpperCase()}`);
    if (selectedEntityId !== "all" && operatorPhone && operatorPhone !== "") {
      subtitleParts.push(`CONTACT: ${operatorPhone}`);
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    } else {
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    }
  } else {
    subtitleParts.push("SCOPE: ALL FLEET OPERATIONS");
    subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
  }

  // Period label
  const periodLabel =
    selectedMonth === "custom" && customStartDate && customEndDate
      ? `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`
      : selectedMonth === "all"
      ? "All Available Logs"
      : selectedMonth;

  const { displayDateTime } = formatExportDateTimeSlug();

  // Metadata Items
  const metadataItems: { label: string; value: string }[] = [];
  if (isOperatorView) {
    metadataItems.push({ label: "Operator", value: operatorName });
    if (operatorPhone) metadataItems.push({ label: "Number", value: operatorPhone });
    if (user.id !== selectedEntityId && user.role !== "operator") {
      metadataItems.push({ label: "Supervisor", value: supervisorName });
      if (supervisorPhone) metadataItems.push({ label: "Supervisor Number", value: supervisorPhone });
    }
    if (selectedMonth !== "all") {
      metadataItems.push({ label: selectedMonth === "custom" ? "Date Range" : "Month", value: periodLabel });
    }
    metadataItems.push({ label: "Export Date", value: displayDateTime });
  } else if (viewMode !== "machine") {
    metadataItems.push({ label: "Supervisor", value: supervisorName });
    metadataItems.push({ label: "Number", value: supervisorPhone });
  }

  if (!isOperatorView) {
    if (viewMode === "client" && selectedEntityId !== "all") {
      if (selectedMonth !== "all") {
        metadataItems.push({ label: selectedMonth === "custom" ? "Date Range" : "Month", value: periodLabel });
      }
      metadataItems.push({ label: "Export Date", value: displayDateTime });
    } else if (viewMode === "machine" && selectedEntityId !== "all") {
      metadataItems.push({ label: "Manufacturer", value: selectedMachineObj?.manufacturer || (logs[0]?.machine as any)?.manufacturer || "N/A" });
      metadataItems.push({ label: "Model", value: selectedMachineObj?.model || (logs[0]?.machine as any)?.model || "N/A" });
      metadataItems.push({ label: "Serial No.", value: selectedMachineObj?.serial_number || (logs[0]?.machine as any)?.serial_number || "N/A" });
      metadataItems.push({ label: "Total Run", value: `${Math.round(totalRunningHours * 10) / 10} hrs` });
      if (selectedMonth !== "all") {
        metadataItems.push({ label: selectedMonth === "custom" ? "Date Range" : "Month", value: periodLabel });
      }
      metadataItems.push({ label: "Export Date", value: displayDateTime });
    } else {
      const scopeLabel = viewMode === "machine" && selectedEntityId !== "all"
        ? `Machine: ${selectedMachineObj?.manufacturer ? `${selectedMachineObj.manufacturer} ` : ""}${selectedMachineObj?.model || "Machine"}`
        : viewMode === "client" && selectedEntityId !== "all"
        ? `Client: ${cleanClientName}`
        : "All Operations Fleet";
      metadataItems.push({ label: "Scope", value: scopeLabel });
      metadataItems.push({ label: selectedMonth === "custom" ? "Date Range" : "Month", value: periodLabel });
      metadataItems.push({ label: "Export Date", value: displayDateTime });
    }
  }

  // Signature Columns (for every page)
  const clientLocationText =
    selectedSite && selectedSite !== "all"
      ? `Site: ${selectedSite}`
      : resolvedClientLocation !== "" && resolvedClientLocation !== "ALL SITES"
      ? `Site: ${resolvedClientLocation}`
      : "All Operational Sites";

  const signatureColumns = [
    {
      heading: "Prepared By",
      name: isOperatorView ? operatorName : supervisorName,
      role: isOperatorView ? "(Machine Operator)" : "(Operations Supervisor)",
    },
    {
      heading: "Client Details & Sign-off",
      name: cleanClientName,
      role: clientLocationText,
      nameUppercase: true,
    },
    {
      heading: "Verified & Approved By",
      name: "REACH INTERNATIONAL",
      role: "(Operations / Service Manager)",
      nameUppercase: true,
    },
  ];

  const computedTotalWorkingHours =
    totalWorkingHours > 0
      ? totalWorkingHours
      : logs.reduce((acc: number, l: any) => acc + calculateShiftWorkingHours(l), 0);

  if (viewMode === "client") {
    // Group logs by machine for client view
    const logsByMachineId = new Map<string, MachineHourLog[]>();
    for (const log of logs) {
      const mId = log.machine_id || (log.machine as any)?.id || "unassigned";
      const existing = logsByMachineId.get(mId);
      if (existing) existing.push(log);
      else logsByMachineId.set(mId, [log]);
    }

    const targetMachineIds: string[] = [];
    if (selectedClientMachineId && selectedClientMachineId !== "all") {
      targetMachineIds.push(selectedClientMachineId);
    } else {
      if (machines && machines.length > 0) {
        for (const m of machines) {
          if (m?.id && logsByMachineId.has(m.id)) targetMachineIds.push(m.id);
        }
      }
      for (const mId of logsByMachineId.keys()) {
        if (!targetMachineIds.includes(mId)) targetMachineIds.push(mId);
      }
    }

    const machineWiseGroups = targetMachineIds
      .map((mId) => {
        const machLogs = logsByMachineId.get(mId) || [];
        const machineObj =
          machines?.find((m: any) => m.id === mId) ||
          machLogs[0]?.machine || { id: mId, model: "Equipment" };

        const dailyGroups = groupLogsByDate(machLogs, "client");
        const sumDayRT = dailyGroups.reduce((acc, g) => acc + g.totalRunningHours, 0);
        const sumWorkingHours = dailyGroups.reduce((acc, g) => acc + g.totalWorkingHours, 0);
        const sumBreakdownHours = dailyGroups.reduce((acc, g) => acc + g.totalBreakdownHours, 0);

        return {
          machineId: mId,
          machineObj,
          logs: machLogs,
          dailyGroups,
          sumDayRT,
          sumWorkingHours,
          sumBreakdownHours,
        };
      })
      .filter((g) => g.logs.length > 0);

    if (machineWiseGroups.length === 0) {
      return (
        <div className="print-document-container w-full">
          <div className="print-page bg-white text-black p-4 sm:p-5 rounded-lg border border-neutral-300 shadow-md flex flex-col justify-between text-xs font-sans max-w-[210mm] w-full min-h-[297mm] sm:min-h-[287mm] mx-auto print:p-0 print:border-none print:shadow-none print:rounded-none">
            <div className="flex flex-col gap-y-2">
              <PDFReportHeader
                title={reportTitle}
                subtitleParts={subtitleParts}
                metadataItems={metadataItems}
                centeredLayout
              />
              <PDFTableWrapper>
                <div className="p-4 text-center text-neutral-500 font-medium text-xs">
                  No machine running hour logs found for the active filter selection.
                </div>
              </PDFTableWrapper>
            </div>
            <div className="pt-2">
              <PDFSignatureBlock columns={signatureColumns} />
            </div>
          </div>
        </div>
      );
    }

    // Split machines and paginate their rows (max 30 rows per page)
    const MAX_ROWS_PER_CLIENT_PAGE = 30;
    const clientPages: {
      machineId: string;
      machineObj: any;
      dailyGroups: (typeof machineWiseGroups)[0]["dailyGroups"];
      sumDayRT: number;
      sumWorkingHours: number;
      sumBreakdownHours: number;
      isFirstChunkOfMachine: boolean;
      isLastChunkOfMachine: boolean;
    }[] = [];

    for (const mGroup of machineWiseGroups) {
      if (mGroup.dailyGroups.length <= MAX_ROWS_PER_CLIENT_PAGE) {
        clientPages.push({
          machineId: mGroup.machineId,
          machineObj: mGroup.machineObj,
          dailyGroups: mGroup.dailyGroups,
          sumDayRT: mGroup.sumDayRT,
          sumWorkingHours: mGroup.sumWorkingHours,
          sumBreakdownHours: mGroup.sumBreakdownHours,
          isFirstChunkOfMachine: true,
          isLastChunkOfMachine: true,
        });
      } else {
        const totalChunks = Math.ceil(mGroup.dailyGroups.length / MAX_ROWS_PER_CLIENT_PAGE);
        for (let c = 0; c < totalChunks; c++) {
          const chunk = mGroup.dailyGroups.slice(c * MAX_ROWS_PER_CLIENT_PAGE, (c + 1) * MAX_ROWS_PER_CLIENT_PAGE);
          clientPages.push({
            machineId: mGroup.machineId,
            machineObj: mGroup.machineObj,
            dailyGroups: chunk,
            sumDayRT: mGroup.sumDayRT,
            sumWorkingHours: mGroup.sumWorkingHours,
            sumBreakdownHours: mGroup.sumBreakdownHours,
            isFirstChunkOfMachine: c === 0,
            isLastChunkOfMachine: c === totalChunks - 1,
          });
        }
      }
    }

    const totalClientPages = clientPages.length;

    return (
      <div className="print-document-container w-full space-y-6 print:space-y-0" data-machine-total={totalClientPages}>
        {clientPages.map((page, pageIdx) => {
          const isFirstPage = pageIdx === 0;
          const isLastPage = pageIdx === totalClientPages - 1;
          const { rowHeightMm, footerRowHeightMm } = calculateA4RowHeight({
            rowCount: page.dailyGroups.length,
            isFirstPage,
            isLastPage,
            hasKpiStrip: isFirstPage,
            hasMachineBanner: true,
          });

          return (
            <div
              key={`${page.machineId}-p${pageIdx}`}
              data-machine-idx={pageIdx}
              className="print-page bg-white text-black p-4 sm:p-5 rounded-lg border border-neutral-300 shadow-md flex flex-col justify-between text-xs font-sans max-w-[210mm] w-full min-h-[297mm] sm:min-h-[287mm] mx-auto print:p-0 print:border-none print:shadow-none print:rounded-none"
            >
              {/* Top section: Header (Page 1 only), KPI (Page 1 only), Machine Banner, Table */}
              <div className="flex flex-col gap-y-2">
                {/* Official Title & Client Details Header ONLY on first page */}
                {isFirstPage && (
                  <PDFReportHeader
                    title={reportTitle}
                    subtitleParts={subtitleParts}
                    metadataItems={metadataItems}
                    centeredLayout
                  />
                )}

                {/* Overall Client KPI Strip ONLY on first page */}
                {isFirstPage && (
                  <PDFKPIStrip
                    variant="light"
                    items={[
                      { label: "Total Shifts", value: `${logs.length} ${logs.length === 1 ? "Shift" : "Shifts"}` },
                      { label: "Operating Hours", value: `${Math.round(totalRunningHours * 10) / 10} hrs`, valueColor: "text-sky-700" },
                      { label: "Total Work Hours", value: `${Math.round(computedTotalWorkingHours * 10) / 10} hrs`, valueColor: "text-emerald-700" },
                      { label: "Breakdown Incidents", value: `${totalBreakdowns} Events`, valueColor: "text-rose-700" },
                    ]}
                  />
                )}

                {/* Machine Details Header Banner */}
                <div data-machine-banner="true" className="p-1.5 sm:p-2 bg-neutral-100 border border-neutral-900 rounded flex items-center justify-between text-[9px] font-bold">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-black">
                      EQUIPMENT: {(page.machineObj.model || "Machine").toUpperCase()}
                    </span>
                    {(page.machineObj.serial_number || page.machineObj.machine_code) && (
                      <span className="font-mono text-neutral-700">
                        (SN: {page.machineObj.serial_number || page.machineObj.machine_code})
                      </span>
                    )}
                    {(page.machineObj.machine_id || page.machineObj.machine_code) && (
                      <span className="font-mono px-1 py-0.5 bg-white border border-neutral-400 rounded text-[8px]">
                        {page.machineObj.machine_id || page.machineObj.machine_code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span>Days: {page.dailyGroups.length}</span>
                    <span>M/C RT: {formatHoursWithUnit(page.sumDayRT)}</span>
                    <span>WH: {formatHoursWithUnit(page.sumWorkingHours)}</span>
                    {page.sumBreakdownHours > 0 && (
                      <span className="text-rose-700">B/D: {formatHoursWithUnit(page.sumBreakdownHours)}</span>
                    )}
                    {totalClientPages > 1 && (
                      <span className="text-neutral-500 font-normal">Page {pageIdx + 1}/{totalClientPages}</span>
                    )}
                  </div>
                </div>

                {/* Daily Shift Logs Table with A4-optimized dynamic row sizing */}
                <PDFTableWrapper>
                  <table className="w-full text-center border border-neutral-900 border-collapse print-table table-fixed min-w-[700px] sm:min-w-0 mx-auto">
                    <thead>
                      <tr className="bg-neutral-100 text-black font-black text-[8.5px] uppercase tracking-wider border-b-2 border-neutral-900">
                        <th className="py-1 px-1 border border-neutral-900 w-[12%] font-mono text-center align-middle">Date</th>
                        <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle">Shift</th>
                        <th className="py-1 px-1 border border-neutral-900 w-[53%] text-center align-middle">OPERATOR NAME</th>
                        <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle">M/C RT</th>
                        <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle">WH</th>
                        <th className="py-1 px-0.5 border border-neutral-900 w-[8%] font-mono text-center align-middle">B/D</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.dailyGroups.map((group) => (
                        <tr
                          key={group.date}
                          className="bg-white border-b border-neutral-300 text-[8.5px]"
                          style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm` }}
                        >
                          <td
                            className="px-1 border border-neutral-300 font-mono font-bold text-center align-middle whitespace-nowrap"
                            style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {group.formattedDate}
                          </td>
                          <td
                            className="px-0.5 border border-neutral-300 font-mono font-bold text-sky-800 text-center align-middle whitespace-nowrap"
                            style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {group.shiftsDisplay}
                          </td>
                          <td
                            className="px-1 border border-neutral-300 text-center align-middle font-medium leading-tight whitespace-normal break-words"
                            style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {group.operatorsDisplay || "Unassigned"}
                          </td>
                          <td
                            className="px-0.5 border border-neutral-300 font-mono font-bold text-sky-800 text-center align-middle whitespace-nowrap"
                            style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {formatHoursWithUnit(group.totalRunningHours)}
                          </td>
                          <td
                            className="px-0.5 border border-neutral-300 font-mono font-bold text-neutral-900 text-center align-middle whitespace-nowrap"
                            style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {formatHoursWithUnit(group.totalWorkingHours)}
                          </td>
                          <td
                            className="px-0.5 border border-neutral-300 font-mono font-bold text-center align-middle whitespace-nowrap"
                            style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {(() => {
                              const totalBdMin = Math.round(group.totalBreakdownHours * 60);
                              const maintMin = group.totalMaintenanceMinutes;
                              const netBdMin = Math.max(0, totalBdMin - maintMin);
                              const fmtMin = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}m` : `${h}h`; };
                              if (totalBdMin === 0) return <span style={{ color: '#9ca3af' }}>0h</span>;
                              if (maintMin >= totalBdMin && maintMin > 0)
                                return <span style={{ color: '#b45309', fontWeight: 'bold' }}>MT {fmtMin(maintMin)}</span>;
                              if (maintMin > 0 && netBdMin > 0)
                                return <span><span style={{ color: '#b45309' }}>MT {fmtMin(maintMin)}</span> / <span style={{ color: '#be123c' }}>{fmtMin(netBdMin)}</span></span>;
                              return <span style={{ color: '#be123c' }}>{fmtMin(totalBdMin)}</span>;
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {/* Machine-specific total footer rendered on the last page of this machine */}
                    {page.isLastChunkOfMachine && (
                      <tfoot className="border-t-2 border-neutral-900 bg-neutral-100 font-bold text-[8.5px] select-none">
                        <tr style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm` }}>
                          <td
                            colSpan={6}
                            className="px-1 border border-neutral-900 font-black text-center align-middle"
                            style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            Total for {page.machineObj.model || "Machine"}
                          </td>
                        </tr>
                        <tr
                          className="border-b-2 border-neutral-900 font-mono font-bold"
                          style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm` }}
                        >
                          <td
                            className="px-1 border border-neutral-900 text-center align-middle"
                            style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {page.dailyGroups.length} {page.dailyGroups.length === 1 ? "day" : "days"}
                          </td>
                          <td className="px-0.5 border border-neutral-900 text-center align-middle" style={{ height: `${footerRowHeightMm}mm` }}></td>
                          <td className="px-1 border border-neutral-900 text-center align-middle" style={{ height: `${footerRowHeightMm}mm` }}></td>
                          <td
                            className="px-0.5 border border-neutral-900 text-center align-middle font-bold text-sky-800"
                            style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {formatHoursWithUnit(page.sumDayRT)}
                          </td>
                          <td
                            className="px-0.5 border border-neutral-900 text-center align-middle font-bold text-neutral-900"
                            style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {formatHoursWithUnit(page.sumWorkingHours)}
                          </td>
                          <td
                            className="px-0.5 border border-neutral-900 text-center align-middle font-bold"
                            style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                          >
                            {formatHoursWithUnit(page.sumBreakdownHours)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </PDFTableWrapper>
              </div>

              {/* Bottom section: Signature block ONLY on the last page of the document */}
              {isLastPage && (
                <div className="pt-2">
                  <PDFSignatureBlock columns={signatureColumns} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Non-client views (machine, operator, all)
  const groupedLogs = groupLogsByDate(logs, viewMode);
  const sumDayRT = groupedLogs.reduce((acc, g) => acc + g.totalRunningHours, 0);
  const sumWorkingHours = groupedLogs.reduce((acc, g) => acc + g.totalWorkingHours, 0);
  const sumBreakdownHours = groupedLogs.reduce((acc, g) => acc + g.totalBreakdownHours, 0);

  const MAX_ROWS_PER_NON_CLIENT_PAGE = 30;
  const nonClientPages: (typeof groupedLogs)[] = [];
  if (groupedLogs.length === 0) {
    nonClientPages.push([]);
  } else {
    for (let i = 0; i < groupedLogs.length; i += MAX_ROWS_PER_NON_CLIENT_PAGE) {
      nonClientPages.push(groupedLogs.slice(i, i + MAX_ROWS_PER_NON_CLIENT_PAGE));
    }
  }

  const totalNonClientPages = nonClientPages.length;

  return (
    <div className="print-document-container w-full space-y-6 print:space-y-0" data-page-total={totalNonClientPages}>
      {nonClientPages.map((pageRows, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = pageIdx === totalNonClientPages - 1;
        const { rowHeightMm, footerRowHeightMm } = calculateA4RowHeight({
          rowCount: pageRows.length,
          isFirstPage,
          isLastPage,
          hasKpiStrip: isFirstPage,
          hasMachineBanner: false,
        });

        return (
          <div
            key={pageIdx}
            data-page-idx={pageIdx}
            className="print-page bg-white text-black p-4 sm:p-5 rounded-lg border border-neutral-300 shadow-md flex flex-col justify-between text-xs font-sans max-w-[210mm] w-full min-h-[297mm] sm:min-h-[287mm] mx-auto print:p-0 print:border-none print:shadow-none print:rounded-none"
          >
            <div className="flex flex-col gap-y-2">
              {/* 1. HEADER ONLY ON FIRST PAGE */}
              {isFirstPage && (
                <PDFReportHeader
                  title={reportTitle}
                  subtitleParts={subtitleParts}
                  metadataItems={metadataItems}
                  centeredLayout
                />
              )}

              {/* Page indicator for subsequent pages */}
              {!isFirstPage && totalNonClientPages > 1 && (
                <div className="flex items-center justify-between text-[8px] font-mono text-neutral-500 pb-1 border-b border-neutral-300">
                  <span className="font-bold text-neutral-700 uppercase tracking-wider">{reportTitle}</span>
                  <span className="font-semibold text-neutral-600">Page {pageIdx + 1} of {totalNonClientPages}</span>
                </div>
              )}

              {/* 2. KPI STRIP ONLY ON FIRST PAGE */}
              {isFirstPage && (
                <PDFKPIStrip
                  variant="light"
                  items={[
                    { label: "Total Logs", value: `${logs.length} Logs` },
                    { label: "Operating Hours", value: `${Math.round(totalRunningHours * 10) / 10} hrs`, valueColor: "text-sky-700" },
                    { label: "Total Work Hours", value: `${Math.round(computedTotalWorkingHours * 10) / 10} hrs`, valueColor: "text-emerald-700" },
                    { label: "Overtime Hours", value: `${Math.round(totalOtHours * 10) / 10} hrs`, valueColor: "text-amber-700" },
                    { label: "Breakdown Incidents", value: `${totalBreakdowns} Events`, valueColor: "text-rose-700" },
                  ]}
                />
              )}

              {/* 3. LOGS TABLE */}
              <PDFTableWrapper>
                <table className="w-full text-center border border-neutral-900 border-collapse print-table table-fixed min-w-[700px] sm:min-w-0 mx-auto">
                  <thead>
                    <tr className="bg-neutral-100 text-black font-black text-[8.5px] uppercase tracking-wider border-b-2 border-neutral-900">
                      <th className="py-1 px-1 border border-neutral-900 w-[12%] font-mono text-center align-middle">Date</th>
                      <th className="py-1 px-1 border border-neutral-900 w-[18%] text-center align-middle">{isOperatorView ? "Machine" : "Client"}</th>
                      <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle">Shift</th>
                      <th className="py-1 px-1 border border-neutral-900 w-[35%] text-center align-middle">OPERATOR NAME</th>
                      <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle">M/C RT</th>
                      <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle">WH</th>
                      <th className="py-1 px-0.5 border border-neutral-900 w-[8%] font-mono text-center align-middle">B/D</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length > 0 ? (
                      pageRows.map((group) => {
                        const machineOrClient = isOperatorView
                          ? (group.machineModel ? `${group.machineModel}${group.machineSerial ? ` (${group.machineSerial})` : ""}` : group.clientName || "Machine")
                          : group.clientName;

                        return (
                          <tr
                            key={group.date}
                            className="bg-white border-b border-neutral-300 text-[8.5px]"
                            style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm` }}
                          >
                            <td
                              className="px-1 border border-neutral-300 font-mono font-bold text-center align-middle whitespace-nowrap"
                              style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                            >
                              {group.formattedDate}
                            </td>
                            <td
                              className="px-1 border border-neutral-300 text-center align-middle font-semibold whitespace-normal break-words leading-tight"
                              style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                            >
                              {machineOrClient}
                            </td>
                            <td
                              className="px-0.5 border border-neutral-300 font-mono font-bold text-sky-800 text-center align-middle whitespace-nowrap"
                              style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                            >
                              {group.shiftsDisplay}
                            </td>
                            <td
                              className="px-1 border border-neutral-300 text-center align-middle font-medium leading-tight whitespace-normal break-words"
                              style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                            >
                              {group.operatorsDisplay || "Unassigned"}
                            </td>
                            <td
                              className="px-0.5 border border-neutral-300 font-mono font-bold text-sky-800 text-center align-middle whitespace-nowrap"
                              style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                            >
                              {formatHoursWithUnit(group.totalRunningHours)}
                            </td>
                            <td
                              className="px-0.5 border border-neutral-300 font-mono font-bold text-neutral-900 text-center align-middle whitespace-nowrap"
                              style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                            >
                              {formatHoursWithUnit(group.totalWorkingHours)}
                            </td>
                            <td
                              className="px-0.5 border border-neutral-300 font-mono font-bold text-center align-middle whitespace-nowrap"
                              style={{ height: `${rowHeightMm}mm`, minHeight: `${rowHeightMm}mm`, verticalAlign: "middle" }}
                            >
                              {(() => {
                                const totalBdMin = Math.round(group.totalBreakdownHours * 60);
                                const maintMin = group.totalMaintenanceMinutes;
                                const netBdMin = Math.max(0, totalBdMin - maintMin);
                                const fmtMin = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return r > 0 ? `${h}h ${r}m` : `${h}h`; };
                                if (totalBdMin === 0) return <span style={{ color: '#9ca3af' }}>0h</span>;
                                if (maintMin >= totalBdMin && maintMin > 0)
                                  return <span style={{ color: '#b45309', fontWeight: 'bold' }}>MT {fmtMin(maintMin)}</span>;
                                if (maintMin > 0 && netBdMin > 0)
                                  return <span><span style={{ color: '#b45309' }}>MT {fmtMin(maintMin)}</span> / <span style={{ color: '#be123c' }}>{fmtMin(netBdMin)}</span></span>;
                                return <span style={{ color: '#be123c' }}>{fmtMin(totalBdMin)}</span>;
                              })()}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr className="bg-white" style={{ height: "40px" }}>
                        <td colSpan={7} className="p-3 border border-neutral-300 text-center align-middle text-neutral-500 font-medium">
                          No machine running hour logs found for the active filter selection.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {isLastPage && groupedLogs.length > 0 && (
                    <tfoot className="border-t-2 border-neutral-900 bg-neutral-100 font-bold text-[8.5px] select-none">
                      <tr style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm` }}>
                        <td
                          colSpan={7}
                          className="px-1 border border-neutral-900 font-black text-center align-middle"
                          style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                        >
                          Total
                        </td>
                      </tr>
                      <tr
                        className="border-b-2 border-neutral-900 font-mono font-bold"
                        style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm` }}
                      >
                        <td
                          className="px-1 border border-neutral-900 text-center align-middle"
                          style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                        >
                          {groupedLogs.length} {groupedLogs.length === 1 ? "day" : "days"}
                        </td>
                        <td className="px-1 border border-neutral-900 text-center align-middle" style={{ height: `${footerRowHeightMm}mm` }}></td>
                        <td className="px-0.5 border border-neutral-900 text-center align-middle" style={{ height: `${footerRowHeightMm}mm` }}></td>
                        <td className="px-1 border border-neutral-900 text-center align-middle" style={{ height: `${footerRowHeightMm}mm` }}></td>
                        <td
                          className="px-0.5 border border-neutral-900 text-center align-middle font-bold text-sky-800"
                          style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                        >
                          {formatHoursWithUnit(sumDayRT)}
                        </td>
                        <td
                          className="px-0.5 border border-neutral-900 text-center align-middle font-bold text-neutral-900"
                          style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                        >
                          {formatHoursWithUnit(sumWorkingHours)}
                        </td>
                        <td
                          className="px-0.5 border border-neutral-900 text-center align-middle font-bold"
                          style={{ height: `${footerRowHeightMm}mm`, minHeight: `${footerRowHeightMm}mm`, verticalAlign: "middle" }}
                        >
                          {formatHoursWithUnit(sumBreakdownHours)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </PDFTableWrapper>
            </div>

            {/* 4. SIGNATURES ONLY ON LAST PAGE */}
            {isLastPage && (
              <div className="pt-2">
                <PDFSignatureBlock columns={signatureColumns} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
// ─── Skeleton ───────────────────────────────────────────────────────────────

function SupervisorLogsReportSkeleton() {
  return (
    <div className="bg-white text-black p-2.5 sm:p-4 rounded-xl border border-neutral-300 shadow-sm flex flex-col justify-between text-xs font-sans max-w-[210mm] mx-auto space-y-3 w-full animate-pulse select-none">
      <div className="pb-2 border-b-2 border-neutral-900 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="w-28 sm:w-36 h-9 rounded bg-neutral-200" />
          <div className="flex-1 text-center flex flex-col items-center gap-1.5">
            <div className="w-56 sm:w-80 h-4.5 rounded bg-neutral-300" />
            <div className="w-40 sm:w-60 h-3 rounded bg-neutral-200" />
          </div>
          <div className="w-28 sm:w-36 hidden sm:block" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-neutral-200">
          <div className="h-3 rounded bg-neutral-200 w-3/4" />
          <div className="h-3 rounded bg-neutral-200 w-2/3" />
          <div className="h-3 rounded bg-neutral-200 w-1/2" />
          <div className="h-3 rounded bg-neutral-200 w-4/5" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 p-2 rounded-lg border border-neutral-200 bg-neutral-100">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="w-16 h-2 rounded bg-neutral-300" />
            <div className="w-12 h-4 rounded bg-neutral-300" />
          </div>
        ))}
      </div>
      <div className="border border-neutral-900 rounded overflow-hidden">
        <div className="grid grid-cols-9 bg-neutral-100 border-b border-neutral-900 py-1.5 px-1">
          {[...Array(9)].map((_, idx) => (
            <div key={idx} className="h-3 rounded bg-neutral-300 mx-1" />
          ))}
        </div>
        <div className="divide-y divide-neutral-200">
          {[...Array(8)].map((_, rIdx) => (
            <div key={rIdx} className="grid grid-cols-9 py-2 px-1 items-center bg-white">
              <div className="h-2.5 rounded bg-neutral-200 mx-2 w-4" />
              <div className="h-2.5 rounded bg-neutral-200 mx-1 w-12" />
              <div className="h-2.5 rounded bg-neutral-200 mx-1 w-16" />
              <div className="h-2.5 rounded bg-neutral-200 mx-1 w-14" />
              <div className="h-2.5 rounded bg-neutral-200 mx-1 w-16" />
              <div className="h-2.5 rounded bg-neutral-200 mx-1 w-14" />
              <div className="h-2.5 rounded bg-neutral-200 mx-1 w-8" />
              <div className="h-2.5 rounded bg-neutral-200 mx-1 w-12" />
              <div className="h-2.5 rounded bg-neutral-200 mx-1 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-neutral-300">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="w-24 h-3 rounded bg-neutral-300" />
            <div className="w-32 h-4 border-b border-neutral-300" />
            <div className="w-20 h-2.5 rounded bg-neutral-200" />
            <div className="w-28 h-2 rounded bg-neutral-200 mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

export function PrintableSupervisorLogsModal({
  open,
  onClose,
  logs: _fallbackLogs = [],
  user,
  viewMode,
  selectedEntityId,
  selectedEntityName,
  selectedClientId,
  selectedClientName,
  selectedMachineId,
  selectedOperatorId,
  selectedMonthValue,
  selectedSite = "all",
  selectedClientMachineId = "all",
  machines = [],
  clientSites = [],
  clientMachines = [],
  customStartDate: initialCustomStartDate,
  customEndDate: initialCustomEndDate,
  search,
}: PrintableSupervisorLogsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeMonth, setActiveMonth] = useState<string>(() => selectedMonthValue || getCurrentMonthNumber());
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    if (initialCustomStartDate) return initialCustomStartDate;
    try {
      const today = getISTDateString();
      return today.slice(0, 7) + "-01";
    } catch {
      return "";
    }
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    if (initialCustomEndDate) return initialCustomEndDate;
    try {
      return getISTDateString();
    } catch {
      return "";
    }
  });

  const activeSite = selectedSite && selectedSite !== "" ? selectedSite : "all";
  const activeMachineId = selectedClientMachineId && selectedClientMachineId !== "" ? selectedClientMachineId : "all";

  const [fetchedLogs, setFetchedLogs] = useState<MachineHourLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(true);
  const [fetchedMetrics, setFetchedMetrics] = useState<{
    totalRunningHours: number;
    totalOtHours: number;
    totalBreakdowns: number;
    totalWorkingHours?: number;
    loggedDaysCount: number;
  }>({
    totalRunningHours: 0,
    totalOtHours: 0,
    totalBreakdowns: 0,
    totalWorkingHours: 0,
    loggedDaysCount: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedMonthValue) {
      setActiveMonth(selectedMonthValue);
    }
  }, [selectedMonthValue]);

  useEffect(() => {
    if (initialCustomStartDate) {
      setCustomStartDate(initialCustomStartDate);
    }
  }, [initialCustomStartDate]);

  useEffect(() => {
    if (initialCustomEndDate) {
      setCustomEndDate(initialCustomEndDate);
    }
  }, [initialCustomEndDate]);

  // Fetch complete dataset for export (not paginated)
  useEffect(() => {
    if (!open) return;
    setIsLoadingLogs(true);
    let isCancelled = false;

    getOperationsExportLogsAction({
      viewMode: viewMode === "all" ? "client" : viewMode,
      entityId: selectedEntityId,
      clientId: selectedClientId || (viewMode === "client" ? selectedEntityId : undefined),
      clientName: selectedClientName,
      machineId: selectedMachineId || (viewMode === "machine" ? selectedEntityId : undefined),
      operatorId: selectedOperatorId || (viewMode === "operator" ? selectedEntityId : undefined),
      site: activeSite,
      clientMachineId: activeMachineId,
      month: activeMonth,
      customStartDate: activeMonth === "custom" ? customStartDate : undefined,
      customEndDate: activeMonth === "custom" ? customEndDate : undefined,
      search,
    })
      .then((res) => {
        if (!isCancelled) {
          if (res.success && res.logs) {
            setFetchedLogs(res.logs);
            if (res.summary) {
              setFetchedMetrics(res.summary);
            }
          } else {
            console.error("Failed to load operational logs for export:", res.error);
            setFetchedLogs([]);
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Exception fetching operational logs for export:", err);
          setFetchedLogs([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingLogs(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    open,
    viewMode,
    selectedEntityId,
    selectedClientId,
    selectedClientName,
    selectedMachineId,
    selectedOperatorId,
    activeSite,
    activeMachineId,
    activeMonth,
    customStartDate,
    customEndDate,
    search,
  ]);

  const exportLogs = fetchedLogs;
  const totalRunningHours = fetchedMetrics.totalRunningHours;
  const totalOtHours = fetchedMetrics.totalOtHours;
  const totalBreakdowns = fetchedMetrics.totalBreakdowns;
  const totalWorkingHours = fetchedMetrics.totalWorkingHours || exportLogs.reduce((acc, l) => acc + calculateShiftWorkingHours(l), 0);

  const doPrint = () => {
    if (isLoadingLogs || exportLogs.length === 0) return;
    let pdfFileName = "";

    if (viewMode === "operator") {
      const firstOpObj = exportLogs[0]?.operator as any;
      const opName = selectedEntityName || firstOpObj?.full_name || "Operator";
      pdfFileName = buildExportFileName(opName, activeMonth, "pdf", customStartDate, customEndDate);
    } else if (viewMode === "machine") {
      const machineObj =
        machines?.find((m) => m.id === selectedEntityId) ||
        (exportLogs[0]?.machine as any);
      const mSerial =
        machineObj?.serial_number ||
        machineObj?.machine_code ||
        (exportLogs[0]?.machine as any)?.serial_number ||
        (exportLogs[0]?.machine as any)?.machine_code ||
        "Machine";
      pdfFileName = buildMachineExportFileName(mSerial, "pdf", customStartDate, customEndDate);
    } else if (viewMode === "client" && activeMachineId && activeMachineId !== "all") {
      const clientMachine =
        machines?.find((m) => m.id === activeMachineId) ||
        exportLogs.find((l) => l.machine_id === activeMachineId)?.machine;
      const mSerial =
        (clientMachine as any)?.serial_number ||
        (clientMachine as any)?.machine_code ||
        "Machine";
      pdfFileName = buildMachineExportFileName(mSerial, "pdf", customStartDate, customEndDate);
    } else if (viewMode === "client") {
      const { slugDateTime } = formatExportDateTimeSlug();
      const rawClientName = selectedEntityName || selectedClientName || (selectedEntityId && !selectedEntityId.includes("-") ? selectedEntityId : (exportLogs[0]?.client as any)?.company_name || (exportLogs[0]?.client as any)?.client_name || "Client");
      const clientSlug = rawClientName.split(/[^a-zA-Z0-9]+/).filter(Boolean).join("-") || "Client";
      const monthSlug = activeMonth === "custom" && customStartDate && customEndDate
        ? `${formatDate(customStartDate).replace(/\s+/g, "")}-to-${formatDate(customEndDate).replace(/\s+/g, "")}`
        : activeMonth !== "all"
        ? (MONTH_NAMES.find((m) => m.value === activeMonth)?.short || activeMonth)
        : "AllMonths";
      pdfFileName = `${clientSlug}-${monthSlug}-${slugDateTime}.pdf`;
    } else {
      const { slugDateTime } = formatExportDateTimeSlug();
      const rangeSlug = activeMonth === "custom" && customStartDate && customEndDate
        ? `-${formatDate(customStartDate).replace(/\s+/g, "")}-to-${formatDate(customEndDate).replace(/\s+/g, "")}`
        : "";
      pdfFileName = `Supervisor-Running-Logs-${viewMode}${rangeSlug}-${slugDateTime}.pdf`;
    }

    // Serialise the already-rendered preview HTML into a dedicated blank popup
    // window so the browser flows it across as many A4 pages as needed,
    // instead of squeezing everything onto a single page.
    const previewEl = document.getElementById(PREVIEW_ID);
    if (!previewEl) {
      // Fallback: use the hidden portal div
      const portalEl = document.getElementById(PRINT_DOC_ID);
      if (portalEl) openPrintWindow(portalEl.innerHTML, pdfFileName);
      return;
    }
    openPrintWindow(previewEl.innerHTML, pdfFileName);
  };

  const handleExportExcel = async () => {
    if (isLoadingLogs || exportLogs.length === 0) return;
    const { exportSupervisorRunningLogsToExcel } = await import("@/lib/utils/supervisor-logs-export");
    exportSupervisorRunningLogsToExcel({
      logs: exportLogs,
      viewMode,
      selectedEntityId,
      selectedClientId,
      selectedClientName,
      selectedMachineId,
      selectedOperatorId,
      selectedMonthValue: activeMonth,
      supervisorName: user.full_name,
      selectedSite: activeSite,
      selectedClientMachineId: activeMachineId,
      machines,
      customStartDate: activeMonth === "custom" ? customStartDate : undefined,
      customEndDate: activeMonth === "custom" ? customEndDate : undefined,
    });
  };

  const reportProps: SupervisorReportContentProps = {
    logs: exportLogs,
    user,
    viewMode,
    selectedEntityId,
    selectedEntityName,
    selectedClientId,
    selectedClientName,
    selectedMonth: activeMonth,
    customStartDate: activeMonth === "custom" ? customStartDate : undefined,
    customEndDate: activeMonth === "custom" ? customEndDate : undefined,
    totalRunningHours,
    totalOtHours,
    totalBreakdowns,
    totalWorkingHours,
    selectedSite: activeSite,
    selectedClientMachineId: activeMachineId,
    machines,
  };

  return (
    <>
      {/* Centralized Print Stylesheet */}
      <style>{getPrintStylesheet(PRINT_DOC_ID, PREVIEW_ID, {
        includePreviewStyles: true,
        includeKpiStrip: true,
      })}</style>

      {/* Print Portal */}
      {mounted && open && createPortal(
        <div id={PRINT_DOC_ID}>
          <SupervisorLogsReportContent {...reportProps} />
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      <Modal
        open={open}
        onClose={onClose}
        title={
          <div className="flex items-center justify-between w-full pr-6">
            <span className="text-base font-extrabold text-[var(--color-ink)]">
              {viewMode === "operator"
                ? "Operator Daily Machine Logs PDF Report"
                : viewMode === "client"
                ? "Site Machine Running Hours PDF Report"
                : viewMode === "machine"
                ? "Machine Running Hours PDF Report"
                : "Supervisor Running Hours PDF Report"}
            </span>
          </div>
        }
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full pt-2 no-print">
            <div className="text-xs text-[var(--color-mute)] font-medium flex items-center gap-1.5">
              {isLoadingLogs ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 text-sky-500 animate-spin" />
                  <span>Fetching complete operational records...</span>
                </>
              ) : (
                <span>Showing <strong>{exportLogs.length}</strong> operational log entries as per selected time.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isLoadingLogs || exportLogs.length === 0}
                className="px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {isLoadingLogs ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
                Export Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={doPrint}
                disabled={isLoadingLogs || exportLogs.length === 0}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isLoadingLogs ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Print / Save as PDF
              </button>
            </div>
          </div>
        }
      >
        <div className="max-w-full space-y-4">
          {/* Month & Date Range Selector Strip */}
          <div className="flex flex-col gap-2.5 p-2.5 sm:p-4 max-w-[210mm] mx-auto w-full rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] no-print">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-ink)] shrink-0">
                <Calendar className="h-4 w-4 text-sky-500" />
                <span>Select Export Period:</span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar flex-nowrap w-full sm:w-auto p-1 bg-[var(--color-canvas-elevated)] rounded-lg border border-[var(--color-hairline)]">
                {MONTH_NAMES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setActiveMonth(m.value)}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      activeMonth === m.value
                        ? "bg-sky-600 text-white shadow-2xs"
                        : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                    }`}
                  >
                    {m.short}
                  </button>
                ))}
              </div>
            </div>

            {activeMonth === "custom" && (
              <div className="pt-2.5 border-t border-[var(--color-hairline)]">
                <DateRangePicker
                  label="Select Date Range"
                  value={{
                    startDate: customStartDate,
                    endDate: customEndDate,
                  }}
                  onChange={({ startDate, endDate }) => {
                    setCustomStartDate(startDate);
                    setCustomEndDate(endDate);
                  }}
                  allowAnyPast
                  allowAnyFuture
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div id={PREVIEW_ID} className="max-w-full overflow-x-auto custom-scrollbar flex justify-center py-2">
            {isLoadingLogs ? (
              <SupervisorLogsReportSkeleton />
            ) : (
              <SupervisorLogsReportContent {...reportProps} />
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
