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
  handleBrowserPrint,
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
import { exportSupervisorRunningLogsToExcel } from "@/lib/utils/supervisor-logs-export";
import { getOperationsExportLogsAction } from "@/app/actions/operators";
import { Printer, FileSpreadsheet, Loader2 } from "lucide-react";

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
  selectedSite?: string;
  selectedClientMachineId?: string;
  machines?: any[];
}

// ─── Report Content ──────────────────────────────────────────────────────────

function SupervisorLogsReportContent({
  logs,
  user,
  viewMode,
  selectedEntityId,
  selectedEntityName,
  selectedClientId,
  selectedClientName,
  selectedMonth,
  customStartDate,
  customEndDate,
  totalRunningHours,
  totalOtHours,
  totalBreakdowns,
  selectedSite = "all",
  selectedClientMachineId = "all",
  machines = [],
}: SupervisorReportContentProps) {
  const supervisorName = user.full_name || "Supervisor";
  const supervisorPhone = user.phone || "—";
  const { displayDateTime } = formatExportDateTimeSlug();

  // Resolve client name (never a UUID)
  const cleanClientName = resolveCleanClientName({
    selectedClientName,
    selectedEntityName,
    selectedClientId,
    selectedEntityId,
    machines,
    logs,
  });

  const periodLabel = resolvePeriodLabel(selectedMonth, customStartDate, customEndDate);
  const resolvedClientLocation = resolveClientLocation(selectedSite, logs);

  const firstLogOp = logs[0]?.operator as any;
  const operatorName = firstLogOp?.full_name || "Operator";
  const operatorPhone = firstLogOp?.phone || "—";

  const selectedMachineObj =
    machines?.find((m) => m.id === selectedEntityId) ||
    (logs[0]?.machine as any);

  const isOperatorView = viewMode === "operator";

  // ─── Report Title ─────────────────────────────────────────────────
  const reportTitle = isOperatorView
    ? "OPERATOR DAILY MACHINE LOG REPORT"
    : viewMode === "client"
    ? "SITE MACHINE RUNNING HOURS REPORT"
    : viewMode === "machine"
    ? "MACHINE RUNNING HOURS REPORT"
    : "SUPERVISOR MACHINE RUNNING HOURS REPORT";

  // ─── Subtitle Parts (pipe-separated, single line) ─────────────────
  const subtitleParts: string[] = [];
  if (viewMode === "client") {
    subtitleParts.push(`CLIENT: ${(cleanClientName || "ALL CLIENTS").toUpperCase()}`);
    if (selectedClientMachineId && selectedClientMachineId !== "all") {
      const cMachine = machines?.find((m) => m.id === selectedClientMachineId) || logs.find((l) => l.machine_id === selectedClientMachineId)?.machine;
      const cMachName = (cMachine as any)?.machine_name || (cMachine as any)?.model || selectedClientMachineId;
      subtitleParts.push(`MACHINE: ${cMachName.toUpperCase()}`);
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "—" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    } else {
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "—" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    }
  } else if (viewMode === "machine") {
    const mMfr = selectedMachineObj?.manufacturer || (logs[0]?.machine as any)?.manufacturer || "";
    const mModel = selectedMachineObj?.model || (logs[0]?.machine as any)?.model || "MACHINE";
    const mSerial = selectedMachineObj?.serial_number || selectedMachineObj?.machine_code || (logs[0]?.machine as any)?.serial_number || (logs[0]?.machine as any)?.machine_code || "—";
    const machDisplay = selectedEntityId !== "all" ? `${mMfr ? `${mMfr} ` : ""}${mModel}` : "ALL FLEET MACHINES";
    subtitleParts.push(`EQUIPMENT: ${machDisplay.toUpperCase()}`);
    if (selectedEntityId !== "all") {
      subtitleParts.push(`SERIAL NO.: ${mSerial.toUpperCase()}`);
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "—" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    } else {
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "—" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    }
  } else if (isOperatorView) {
    const opDisplay = selectedEntityId !== "all" ? operatorName : "ALL OPERATORS";
    subtitleParts.push(`OPERATOR: ${opDisplay.toUpperCase()}`);
    if (selectedEntityId !== "all" && operatorPhone && operatorPhone !== "—") {
      subtitleParts.push(`CONTACT: ${operatorPhone}`);
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "—" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    } else {
      subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "—" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
    }
  } else {
    subtitleParts.push("SCOPE: ALL FLEET OPERATIONS");
    subtitleParts.push(`LOCATION: ${(resolvedClientLocation !== "—" ? resolvedClientLocation : "ALL SITES").toUpperCase()}`);
  }

  // ─── Metadata Items ───────────────────────────────────────────────
  const metadataItems: { label: string; value: string }[] = [];
  if (isOperatorView) {
    metadataItems.push({ label: "Operator", value: operatorName });
    metadataItems.push({ label: "Number", value: operatorPhone });
    metadataItems.push({ label: "Supervisor", value: supervisorName });
    metadataItems.push({ label: "Supervisor Number", value: supervisorPhone });
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
      metadataItems.push({ label: "Manufacturer", value: selectedMachineObj?.manufacturer || (logs[0]?.machine as any)?.manufacturer || "—" });
      metadataItems.push({ label: "Model", value: selectedMachineObj?.model || (logs[0]?.machine as any)?.model || "—" });
      metadataItems.push({ label: "Serial No.", value: selectedMachineObj?.serial_number || (logs[0]?.machine as any)?.serial_number || "—" });
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

  // ─── Signature Columns ─────────────────────────────────────────────
  const clientLocationText =
    selectedSite && selectedSite !== "all"
      ? `Site: ${selectedSite}`
      : resolvedClientLocation !== "—" && resolvedClientLocation !== "ALL SITES"
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

  return (
    <div className="bg-white text-black p-2.5 sm:p-4 rounded-xl border border-neutral-300 shadow-sm flex flex-col justify-between text-xs font-sans max-w-[210mm] mx-auto space-y-2 sm:space-y-2.5 w-full print-document-container">
      {/* 1. HEADER */}
      <PDFReportHeader
        title={reportTitle}
        subtitleParts={subtitleParts}
        metadataItems={metadataItems}
        centeredLayout
      />

      {/* 2. KPI STRIP */}
      <PDFKPIStrip
        variant="light"
        items={[
          { label: "Total Logs", value: `${logs.length} Logs` },
          { label: "Operating Hours", value: `${Math.round(totalRunningHours * 10) / 10} hrs`, valueColor: "text-sky-700" },
          { label: "Overtime Hours", value: `${Math.round(totalOtHours * 10) / 10} hrs`, valueColor: "text-amber-700" },
          { label: "Breakdown Incidents", value: `${totalBreakdowns} Events`, valueColor: "text-rose-700" },
        ]}
      />

      {/* 3. LOGS TABLE */}
      <PDFTableWrapper>
        <table className="w-full text-center border border-neutral-900 border-collapse print-table table-fixed min-w-[700px] sm:min-w-0 mx-auto">
          <thead>
            <tr className="bg-neutral-100 text-black font-black text-[8.5px] uppercase tracking-wider border-b-2 border-neutral-900">
              {isOperatorView ? (
                <>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[4%]">S.N</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[8%] font-mono whitespace-nowrap">DATE</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[10%] font-mono">MODEL</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[11%] font-mono">SERIAL NO.</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[18%]">CLIENT & LOCATION</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[11%] font-mono whitespace-nowrap">TIMINGS</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[6%] whitespace-nowrap">OP</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[6%] whitespace-nowrap">OT</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[12%] whitespace-nowrap">BREAKDOWN</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[14%]">REMARKS</th>
                </>
              ) : viewMode === "client" ? (
                <>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[4%]">S.N</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[9%] font-mono whitespace-nowrap">DATE</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[10%] font-mono">MODEL</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[13%] font-mono">SERIAL NO.</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[16%]">OPERATOR</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[13%] font-mono whitespace-nowrap">TIMINGS</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[7%] whitespace-nowrap">WT (H)</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[13%] whitespace-nowrap">BREAKDOWN</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[15%]">REMARKS</th>
                </>
              ) : viewMode === "machine" ? (
                <>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[4%]">S.N</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[9%] font-mono whitespace-nowrap">DATE</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[22%]">CLIENT & LOCATION</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[16%]">OPERATOR</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[12%] font-mono whitespace-nowrap">HMR</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[8%] whitespace-nowrap">RT (H)</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[13%] whitespace-nowrap">BREAKDOWN</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[16%]">REMARKS</th>
                </>
              ) : (
                <>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[4%]">S.N</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[9%] font-mono whitespace-nowrap">DATE</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[18%]">MACHINE</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[20%]">CLIENT & LOCATION</th>
                  <th className="py-1.5 px-1 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[16%]">OPERATOR</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[12%] font-mono whitespace-nowrap">HMR</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[8%] whitespace-nowrap">RT (H)</th>
                  <th className="py-1.5 px-0.5 border border-neutral-900 bg-neutral-100 text-black font-black text-center align-middle text-[8.5px] uppercase tracking-wider w-[13%] whitespace-nowrap">BREAKDOWN</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-300">
            {logs.length > 0 ? (
              logs.map((log, idx) => {
                const startMtr = log.start_meter ?? 0;
                const endMtr = log.end_meter ?? startMtr;
                const runningHrs = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
                const otHrs = log.overtime_hours || 0;
                const isBkd = log.is_breakdown;

                const mObj = log.machine as any;
                const logOp = log.operator as any;
                const logClientName = (log as any)?.client?.company_name || (log as any)?.client?.client_name || mObj?.customer_name || "Unassigned Client";
                const locationStr = log.location || ((log as any)?.client?.city ? `${(log as any).client.city}, ${(log as any).client.state || ""}` : mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "—");

                const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*([^\]]+)\]/i) || (log.remarks || "").match(/Breakdown\s*(?:Duration)?:?\s*(\d+h?\s*\d*m?)/i);
                const bkdRaw = (log as any).breakdown_duration || (bkdMatch ? bkdMatch[1].trim() : null);
                const bkdParsed = parseBreakdownString(bkdRaw || log.remarks);
                const bkdStartTime = (log as any).breakdown_start_time || bkdParsed?.startTime || null;
                const bkdEndTime = (log as any).breakdown_end_time || bkdParsed?.endTime || null;
                const bkdDurationOnly = bkdParsed?.durationFormatted || bkdParsed?.durationText || bkdRaw || (isBkd ? "Breakdown" : null);

                let cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim();
                if (cleanRemarks.toLowerCase() === "breakdown" || cleanRemarks.toLowerCase() === "machine breakdown") {
                  cleanRemarks = "—";
                }
                cleanRemarks = cleanRemarks || "—";

                const displayBkdText = isBkd
                  ? (bkdDurationOnly && bkdDurationOnly.toLowerCase() !== "breakdown" ? bkdDurationOnly : "Breakdown")
                  : "0";

                // Breakdown cell renderer (shared across all view modes)
                const breakdownCell = (
                  <td className="p-0.5 border border-neutral-300 text-center align-middle text-[8px]">
                    {isBkd ? (
                      bkdStartTime && bkdEndTime ? (
                        <div className="text-rose-700 font-mono text-center flex flex-col items-center justify-center leading-tight py-0.5">
                          <span className="font-extrabold text-[8px] leading-tight whitespace-nowrap text-center">
                            {formatCompactTiming(bkdStartTime, bkdEndTime)}
                          </span>
                          <span className="text-[7.5px] font-bold text-rose-700/90 leading-tight pt-0.5 text-center">
                            ({bkdDurationOnly})
                          </span>
                        </div>
                      ) : (
                        <div className="text-rose-700 font-mono text-center flex flex-col items-center justify-center leading-tight py-0.5">
                          <span className="font-extrabold text-[8px] leading-tight break-words max-w-full text-center">
                            {displayBkdText}
                          </span>
                        </div>
                      )
                    ) : (
                      <span className="font-bold text-neutral-800 block text-[8px] text-center font-mono">
                        0
                      </span>
                    )}
                  </td>
                );

                if (isOperatorView) {
                  return (
                    <tr key={log.id || idx} className="bg-white">
                      <td className="p-0.5 border border-neutral-300 text-center align-middle font-bold text-[8.5px] text-neutral-900">{idx + 1}</td>
                      <td className="p-0.5 border border-neutral-300 font-mono text-neutral-900 text-center align-middle text-[8px] whitespace-nowrap font-medium">
                        {formatDate(log.log_date)}
                      </td>
                      <td className="p-1 border border-neutral-300 font-bold text-neutral-900 align-middle text-[8.5px] font-mono text-center whitespace-nowrap">
                        {mObj?.model || "—"}
                      </td>
                      <td className="p-1 border border-neutral-300 font-bold text-neutral-900 align-middle text-[8.5px] font-mono text-center whitespace-nowrap">
                        {mObj?.serial_number || mObj?.machine_code || "—"}
                      </td>
                      <td className="p-1 border border-neutral-300 text-neutral-900 align-middle text-[8.5px] leading-tight font-medium text-center">
                        <div className="font-bold truncate text-center">{logClientName}</div>
                        <div className="text-[7.5px] text-neutral-600 font-normal truncate text-center">{locationStr}</div>
                      </td>
                      <td className="p-0.5 border border-neutral-300 font-mono text-[8px] text-neutral-800 text-center align-middle whitespace-nowrap">
                        <div className="text-center">{formatCompactTiming(log.start_time, log.end_time)}</div>
                        <div className="text-[7.5px] text-sky-700 font-bold text-center">
                          {(log as any).normal_working_hours ?? 8}h normal
                        </div>
                      </td>
                      <td className="p-0.5 border border-neutral-300 text-center align-middle font-mono font-bold text-[8.5px] text-neutral-900 whitespace-nowrap">
                        {runningHrs}h
                      </td>
                      <td className="p-0.5 border border-neutral-300 text-center align-middle font-mono font-bold text-[8.5px] text-amber-700 whitespace-nowrap">
                        {otHrs > 0 ? `${otHrs}h` : "0h"}
                      </td>
                      {breakdownCell}
                      <td className="p-1 border border-neutral-300 text-neutral-700 align-middle text-[8.5px] italic text-center break-words">
                        <div className="text-center">{cleanRemarks}</div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={log.id || idx} className="bg-white">
                    <td className="p-0.5 border border-neutral-300 text-center align-middle font-bold text-[8.5px] text-neutral-900">{idx + 1}</td>
                    <td className="p-0.5 border border-neutral-300 font-mono text-neutral-900 text-center align-middle text-[8px] whitespace-nowrap font-medium">
                      {formatDate(log.log_date)}
                    </td>
                    {viewMode === "client" ? (
                      <>
                        <td className="p-1 border border-neutral-300 align-middle font-mono text-[8.5px] font-bold text-neutral-900 text-center">
                          {mObj?.model || "—"}
                        </td>
                        <td className="p-1 border border-neutral-300 align-middle font-mono text-[8.5px] font-bold text-neutral-900 text-center">
                          {mObj?.serial_number || mObj?.machine_code || "—"}
                        </td>
                      </>
                    ) : viewMode !== "machine" ? (
                      <td className="p-1 border border-neutral-300 align-middle text-[8.5px] leading-tight text-center">
                        <div className="font-bold text-neutral-900 truncate text-center">{mObj?.machine_name || "Machine"}</div>
                        <div className="font-mono text-[7.5px] text-neutral-600 text-center">{mObj?.machine_code || "—"}</div>
                      </td>
                    ) : null}
                    {viewMode !== "client" && (
                      <td className="p-1 border border-neutral-300 align-middle text-[8.5px] leading-tight text-center">
                        <div className="font-bold text-neutral-900 truncate text-center">{logClientName}</div>
                        <div className="text-[7.5px] text-neutral-600 truncate text-center">{locationStr}</div>
                      </td>
                    )}
                    <td className="p-1 border border-neutral-300 font-semibold text-neutral-900 align-middle text-[8.5px] text-center leading-tight">
                      <div className="text-center leading-tight">{logOp?.full_name || "Unassigned"}</div>
                    </td>
                    {viewMode === "client" ? (
                      <>
                        <td className="p-0.5 border border-neutral-300 font-mono text-[8px] font-semibold text-neutral-900 text-center align-middle whitespace-nowrap">
                          <div className="text-center">{formatCompactTiming(log.start_time, log.end_time)}</div>
                        </td>
                        <td className="p-0.5 border border-neutral-300 text-center align-middle font-mono font-bold text-[8.5px] text-neutral-900 whitespace-nowrap">
                          {runningHrs}h
                        </td>
                        {breakdownCell}
                        <td className="p-1 border border-neutral-300 align-middle text-[8px] italic text-neutral-700 text-center break-words">
                          <div className="text-center">{cleanRemarks}</div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-0.5 border border-neutral-300 font-mono text-[8px] font-bold text-neutral-900 text-center align-middle whitespace-nowrap">
                          <div className="text-center">{startMtr} → {endMtr}</div>
                        </td>
                        <td className="p-0.5 border border-neutral-300 text-center align-middle font-mono font-bold text-[8.5px] text-neutral-900 whitespace-nowrap">
                          {runningHrs}h
                        </td>
                        {breakdownCell}
                        {viewMode === "machine" && (
                          <td className="p-1 border border-neutral-300 align-middle text-[8px] italic text-neutral-700 text-center break-words">
                            <div className="text-center">{cleanRemarks}</div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr className="bg-white">
                <td colSpan={isOperatorView ? 10 : viewMode === "client" ? 9 : viewMode === "machine" ? 8 : 8} className="p-2 border border-neutral-300 text-center text-neutral-500 font-medium">
                  No machine running hour logs found for the active filter selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </PDFTableWrapper>

      {/* 4. SIGNATURES */}
      <PDFSignatureBlock columns={signatureColumns} />
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

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
  const activeMonth = selectedMonthValue || getCurrentMonthNumber();
  const activeSite = selectedSite && selectedSite !== "" ? selectedSite : "all";
  const activeMachineId = selectedClientMachineId && selectedClientMachineId !== "" ? selectedClientMachineId : "all";
  const customStartDate = initialCustomStartDate || "";
  const customEndDate = initialCustomEndDate || "";

  const [fetchedLogs, setFetchedLogs] = useState<MachineHourLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(true);
  const [fetchedMetrics, setFetchedMetrics] = useState({
    totalRunningHours: 0,
    totalOtHours: 0,
    totalBreakdowns: 0,
    loggedDaysCount: 0,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

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
      customStartDate,
      customEndDate,
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

    handleBrowserPrint(pdfFileName);
  };

  const handleExportExcel = () => {
    if (isLoadingLogs || exportLogs.length === 0) return;
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
      customStartDate,
      customEndDate,
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
    customStartDate,
    customEndDate,
    totalRunningHours,
    totalOtHours,
    totalBreakdowns,
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
              Supervisor Running Hours PDF Report
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
        <div className="max-w-full">
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
