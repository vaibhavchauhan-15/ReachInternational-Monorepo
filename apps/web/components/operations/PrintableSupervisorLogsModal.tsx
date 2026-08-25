"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui";
import type { User, MachineHourLog } from "@/lib/types/database";
import { formatDate } from "@reachinternational/utils";
import {
  MONTH_NAMES,
  getLogMonthNumber,
  formatExportDateTimeSlug,
  buildExportFileName,
  buildMachineExportFileName,
} from "@/lib/utils/operator-logs-export";
import { exportSupervisorRunningLogsToExcel } from "@/lib/utils/supervisor-logs-export";
import { Printer, FileSpreadsheet, Calendar } from "lucide-react";

interface PrintableSupervisorLogsModalProps {
  open: boolean;
  onClose: () => void;
  logs: MachineHourLog[];
  user: User;
  viewMode: "all" | "machine" | "client" | "operator";
  selectedEntityId: string;
  selectedMonthValue: string;
  selectedSite?: string;
  selectedClientMachineId?: string;
  machines?: any[];
}

interface SupervisorReportContentProps {
  logs: MachineHourLog[];
  user: User;
  viewMode: "all" | "machine" | "client" | "operator";
  selectedEntityId: string;
  selectedMonth: string;
  totalRunningHours: number;
  totalOtHours: number;
  totalBreakdowns: number;
  selectedSite?: string;
  selectedClientMachineId?: string;
  machines?: any[];
}

// Compact timing range formatter with zero spaces (e.g. "10:00PM-02:00AM")
function formatCompactTiming(startStr?: string | null, endStr?: string | null): string {
  if (!startStr && !endStr) return "06:00AM-02:00PM";
  if (!startStr) return endStr?.trim().toUpperCase().replace(/\s+/g, "") || "—";
  if (!endStr) return startStr?.trim().toUpperCase().replace(/\s+/g, "") || "—";
  const clean = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
  return `${clean(startStr)}-${clean(endStr)}`;
}

function SupervisorLogsReportContent({
  logs,
  user,
  viewMode,
  selectedEntityId,
  selectedMonth,
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

  let monthLabel = "All Months";
  if (selectedMonth !== "all") {
    const mObj = MONTH_NAMES.find((m) => m.value === selectedMonth);
    if (mObj) monthLabel = mObj.label;
  }

  const firstLogOp = logs[0]?.operator as any;
  const operatorName = firstLogOp?.full_name || "Operator";
  const operatorPhone = firstLogOp?.phone || "—";

  const selectedMachineObj =
    machines?.find((m) => m.id === selectedEntityId) ||
    (logs[0]?.machine as any);

  const totalServices = selectedMachineObj?.service_count ?? 0;

  let scopeLabel = "All Operations Fleet";
  if (viewMode === "machine" && selectedEntityId !== "all") {
    const mName = selectedMachineObj?.machine_name || "Machine";
    const mCode = selectedMachineObj?.machine_code || "";
    scopeLabel = `Machine: ${mName} (${mCode})`;
  } else if (viewMode === "client" && selectedEntityId !== "all") {
    const siteText = selectedSite && selectedSite !== "all" ? ` | Site: ${selectedSite}` : "";
    const machineText = selectedClientMachineId && selectedClientMachineId !== "all"
      ? ` | Machine: ${logs.find((l) => l.machine_id === selectedClientMachineId)?.machine?.machine_name || selectedClientMachineId}`
      : "";
    scopeLabel = `Client: ${selectedEntityId}${siteText}${machineText}`;
  } else if (viewMode === "operator" && selectedEntityId !== "all") {
    scopeLabel = `Operator: ${operatorName}`;
  }

  const isOperatorView = viewMode === "operator";

  return (
    <div className="bg-white text-black p-2.5 sm:p-4 rounded-xl border border-neutral-300 shadow-sm flex flex-col justify-between text-xs font-sans max-w-[210mm] mx-auto space-y-2 sm:space-y-2.5 w-full">
      {/* 1. TOP HEADER & METADATA STRIP */}
      <div className="pb-2 border-b-2 border-neutral-900 space-y-1.5">
        <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          {/* Top Left Logo */}
          <div className="flex items-center gap-2 shrink-0">
            {/* eslint-disable-next-html-element-suppress */}
            <img
              src="/pdf-logo.png"
              alt="Reach International"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>

          {/* Report Title */}
          <div className="text-right flex-1 min-w-[200px]">
            <h2 className="text-sm sm:text-base font-black uppercase text-neutral-900 tracking-wider">
              {isOperatorView
                ? "OPERATOR DAILY MACHINE LOG REPORT"
                : viewMode === "client"
                ? "SITE MACHINE RUNNING HOURS REPORT"
                : viewMode === "machine"
                ? "MACHINE RUNNING HOURS REPORT"
                : "SUPERVISOR MACHINE RUNNING HOURS REPORT"}
            </h2>

            {/* Large and Bold Client Name & Location Subheading (Smaller than Main Heading) */}
            {viewMode === "client" && selectedEntityId !== "all" && (
              <div className="text-xs sm:text-sm font-extrabold uppercase text-neutral-900 tracking-tight py-0.5">
                <span>CLIENT: {selectedEntityId}</span>
                {selectedSite && selectedSite !== "all" && (
                  <span className="ml-2 text-neutral-700">
                    | LOCATION: <span className="text-neutral-900">{selectedSite}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-4 sm:gap-x-5 gap-y-1 text-[9.5px] sm:text-[10px] text-neutral-800 font-medium leading-tight pt-1 border-t border-neutral-200">
          {isOperatorView ? (
            <>
              <div><strong>Operator:</strong> {operatorName}</div>
              <div><strong>Number:</strong> {operatorPhone}</div>
              <div><strong>Supervisor:</strong> {supervisorName}</div>
              <div><strong>Supervisor Number:</strong> {supervisorPhone}</div>
              {selectedMonth !== "all" && (
                <div><strong>Month:</strong> {monthLabel}</div>
              )}
              <div><strong>Export Date:</strong> {displayDateTime}</div>
            </>
          ) : (
            <>
              {viewMode !== "machine" && (
                <>
                  <div><strong>Supervisor:</strong> {supervisorName}</div>
                  <div><strong>Number:</strong> {supervisorPhone}</div>
                </>
              )}
              {viewMode === "client" && selectedEntityId !== "all" ? (
                <>
                  {selectedMonth !== "all" && (
                    <div><strong>Month:</strong> {monthLabel}</div>
                  )}
                  <div><strong>Export Date:</strong> {displayDateTime}</div>
                </>
              ) : viewMode === "machine" && selectedEntityId !== "all" ? (
                <>
                  <div><strong>Machine:</strong> {selectedMachineObj?.machine_name || (logs[0]?.machine as any)?.machine_name || "Machine"}</div>
                  <div><strong>Manufacturer:</strong> {selectedMachineObj?.manufacturer || (logs[0]?.machine as any)?.manufacturer || "—"}</div>
                  <div><strong>Model:</strong> {selectedMachineObj?.model || (logs[0]?.machine as any)?.model || "—"}</div>
                  <div><strong>Serial/Code:</strong> {selectedMachineObj?.serial_number || selectedMachineObj?.machine_code || (logs[0]?.machine as any)?.serial_number || (logs[0]?.machine as any)?.machine_code || "—"}</div>
                  <div><strong>Total Run:</strong> {Math.round(totalRunningHours * 10) / 10} hrs</div>
                  <div><strong>Export Date:</strong> {displayDateTime}</div>
                </>
              ) : (
                <>
                  <div><strong>Scope:</strong> {scopeLabel}</div>
                  <div><strong>Month:</strong> {monthLabel}</div>
                  <div><strong>Export Date:</strong> {displayDateTime}</div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2. KPI SUMMARY STRIP */}
      <div className="grid grid-cols-4 gap-1 sm:gap-1.5 bg-neutral-900 text-white p-1.5 rounded-lg text-center font-mono">
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">Total Logs</span>
          <span className="text-[10px] sm:text-[11px] font-black">{logs.length} Logs</span>
        </div>
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">Total Operating Hrs</span>
          <span className="text-[10px] sm:text-[11px] font-black text-sky-400">{Math.round(totalRunningHours * 10) / 10} hrs</span>
        </div>
        {viewMode === "machine" ? (
          <div>
            <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">Total Services</span>
            <span className="text-[10px] sm:text-[11px] font-black text-emerald-400">{totalServices} Services</span>
          </div>
        ) : (
          <div>
            <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">Total Overtime Hrs</span>
            <span className="text-[10px] sm:text-[11px] font-black text-amber-400">{Math.round(totalOtHours * 10) / 10} hrs</span>
          </div>
        )}
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">Breakdown Incidents</span>
          <span className="text-[10px] sm:text-[11px] font-black text-rose-400">{totalBreakdowns} Events</span>
        </div>
      </div>

      {/* 3. LOGS HIGH-DENSITY TABLE */}
      <div className="w-full overflow-x-auto custom-scrollbar print-table-wrap">
        <table className="w-full text-left border border-neutral-900 border-collapse print-table min-w-[700px] sm:min-w-0">
          <thead>
            <tr className="bg-neutral-900 text-white font-bold text-[8px] uppercase tracking-wider">
              {isOperatorView ? (
                <>
                  <th className="p-0.5 border border-neutral-800 w-[4%] sm:w-[20px] text-center align-middle">S.N</th>
                  <th className="p-0.5 border border-neutral-800 w-[8%] sm:w-[50px] font-mono text-center align-middle whitespace-nowrap">DATE</th>
                  <th className="p-1 border border-neutral-800 w-[10%] sm:w-[70px] align-middle font-mono">MODEL</th>
                  <th className="p-1 border border-neutral-800 w-[12%] sm:w-[85px] align-middle font-mono">SERIAL NO.</th>
                  <th className="p-1 border border-neutral-800 w-[20%] sm:w-[135px] align-middle">CLIENT & LOCATION</th>
                  <th className="p-0.5 border border-neutral-800 w-[11%] sm:w-[70px] font-mono text-center align-middle whitespace-nowrap">TIMINGS</th>
                  <th className="p-0.5 border border-neutral-800 text-center w-[5%] sm:w-[28px] align-middle whitespace-nowrap">OP</th>
                  <th className="p-0.5 border border-neutral-800 text-center w-[5%] sm:w-[28px] align-middle whitespace-nowrap">OT</th>
                  <th className="p-0.5 border border-neutral-800 text-center w-[7%] sm:w-[45px] align-middle whitespace-nowrap">BREAKDOWN</th>
                  <th className="p-1 border border-neutral-800 w-[15%] sm:auto align-middle">REMARKS</th>
                </>
              ) : viewMode === "client" ? (
                <>
                  <th className="p-0.5 border border-neutral-800 w-[4%] text-center align-middle">S.N</th>
                  <th className="p-0.5 border border-neutral-800 w-[10%] font-mono text-center align-middle whitespace-nowrap">DATE</th>
                  <th className="p-1 border border-neutral-800 w-[12%] align-middle font-mono">MODEL</th>
                  <th className="p-1 border border-neutral-800 w-[16%] align-middle font-mono">SERIAL NO.</th>
                  <th className="p-1 border border-neutral-800 w-[18%] align-middle">OPERATOR</th>
                  <th className="p-1 border border-neutral-800 w-[14%] font-mono text-center align-middle whitespace-nowrap">TIMINGS</th>
                  <th className="p-0.5 border border-neutral-800 text-center w-[8%] align-middle whitespace-nowrap">WT(h)</th>
                  <th className="p-0.5 border border-neutral-800 text-center w-[8%] align-middle whitespace-nowrap">BREAKDOWN</th>
                  <th className="p-1 border border-neutral-800 w-[10%] align-middle">REMARKS</th>
                </>
              ) : viewMode === "machine" ? (
                <>
                  <th className="p-0.5 border border-neutral-800 w-[4%] text-center align-middle">S.N</th>
                  <th className="p-0.5 border border-neutral-800 w-[10%] font-mono text-center align-middle whitespace-nowrap">DATE</th>
                  <th className="p-1 border border-neutral-800 w-[20%] align-middle">CLIENT & LOCATION</th>
                  <th className="p-1 border border-neutral-800 w-[18%] align-middle">OPERATOR</th>
                  <th className="p-0.5 border border-neutral-800 w-[14%] font-mono text-center align-middle whitespace-nowrap">HMR</th>
                  <th className="p-0.5 border border-neutral-800 text-center w-[8%] align-middle whitespace-nowrap">RT(h)</th>
                  <th className="p-0.5 border border-neutral-800 text-center w-[10%] align-middle whitespace-nowrap">BREAKDOWN</th>
                  <th className="p-1 border border-neutral-800 w-[16%] align-middle">REMARKS</th>
                </>
              ) : (
                <>
                  <th className="p-0.5 border border-neutral-800 w-[4%] text-center align-middle">S.N</th>
                  <th className="p-0.5 border border-neutral-800 w-[10%] font-mono text-center align-middle whitespace-nowrap">DATE</th>
                  <th className="p-1 border border-neutral-800 w-[20%] align-middle">MACHINE</th>
                  <th className="p-1 border border-neutral-800 w-[20%] align-middle">CLIENT & LOCATION</th>
                  <th className="p-1 border border-neutral-800 w-[16%] align-middle">OPERATOR</th>
                  <th className="p-0.5 border border-neutral-800 w-[14%] font-mono text-center align-middle whitespace-nowrap">HMR</th>
                  <th className="p-0.5 border border-neutral-800 text-center w-[8%] align-middle whitespace-nowrap">RT(h)</th>
                  <th className="p-0.5 border border-neutral-800 text-center w-[8%] align-middle whitespace-nowrap">BREAKDOWN</th>
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
                const clientName = (log as any)?.client?.client_name || mObj?.customer_name || "Unassigned Client";
                const locationStr = log.location || ((log as any)?.client?.city ? `${(log as any).client.city}, ${(log as any).client.state || ""}` : mObj?.customer_address ? `${mObj.customer_address}${mObj.city ? `, ${mObj.city}` : ""}` : mObj?.city || "—");

                const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*([^\]]+)\]/i) || (log.remarks || "").match(/Breakdown\s*(?:Duration)?:?\s*(\d+h?\s*\d*m?)/i);
                const bkdDetails = bkdMatch ? bkdMatch[1].trim() : isBkd ? "Breakdown" : null;
                const cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim() || "—";
                let bkdDurationOnly = bkdDetails;
                if (bkdDurationOnly) {
                  bkdDurationOnly = bkdDurationOnly.replace(/^Breakdown\s*\((.*)\)$/i, "$1").replace(/^Machine Breakdown\s*\((.*)\)$/i, "$1").replace(/^Breakdown\s*/i, "").replace(/\s*duration$/i, "").trim();
                }
                const displayBkdText = isBkd ? (bkdDurationOnly && bkdDurationOnly.toLowerCase() !== "breakdown" ? bkdDurationOnly : "Breakdown") : "Normal";

                if (isOperatorView) {
                  return (
                    <tr key={log.id || idx} className="bg-white">
                      <td className="p-0.5 border border-neutral-300 text-center align-middle font-bold text-[8.5px]">{idx + 1}</td>
                      <td className="p-0.5 border border-neutral-300 font-mono text-neutral-800 text-center align-middle text-[8px] whitespace-nowrap">
                        {formatDate(log.log_date)}
                      </td>
                      <td className="p-1 border border-neutral-300 font-bold text-neutral-900 align-middle text-[8.5px] font-mono whitespace-nowrap">
                        {mObj?.model || "—"}
                      </td>
                      <td className="p-1 border border-neutral-300 font-bold text-neutral-900 align-middle text-[8.5px] font-mono whitespace-nowrap">
                        {mObj?.serial_number || mObj?.machine_code || "—"}
                      </td>
                      <td className="p-1 border border-neutral-300 text-neutral-900 align-middle text-[8.5px] leading-tight font-medium">
                        <div className="font-bold">{clientName}</div>
                        <div className="text-[7.5px] text-neutral-600 font-normal">{locationStr}</div>
                      </td>
                      <td className="p-0.5 border border-neutral-300 font-mono text-[8px] text-neutral-800 text-center align-middle whitespace-nowrap">
                        {formatCompactTiming(log.start_time, log.end_time)}
                      </td>
                      <td className="p-0.5 border border-neutral-300 text-center align-middle font-mono font-bold text-[8.5px] whitespace-nowrap">
                        {runningHrs}h
                      </td>
                      <td className="p-0.5 border border-neutral-300 text-center align-middle font-mono font-bold text-[8.5px] text-amber-700 whitespace-nowrap">
                        {otHrs > 0 ? `${otHrs}h` : "0h"}
                      </td>
                      <td className="p-0.5 border border-neutral-300 text-[8px] text-center align-middle whitespace-nowrap">
                        {isBkd ? (
                          <span className="font-extrabold text-rose-700 block text-[8px] font-mono text-center whitespace-nowrap">
                            {displayBkdText}
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700 block text-[8px] text-center whitespace-nowrap">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="p-1 border border-neutral-300 text-neutral-700 align-middle text-[8.5px] italic">
                        {cleanRemarks}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={log.id || idx} className="bg-white">
                    <td className="p-0.5 border border-neutral-300 text-center align-middle font-bold text-[8.5px]">{idx + 1}</td>
                    <td className="p-0.5 border border-neutral-300 font-mono text-neutral-800 text-center align-middle text-[8px] whitespace-nowrap">
                      {formatDate(log.log_date)}
                    </td>
                    {viewMode === "client" ? (
                      <>
                        <td className="p-1 border border-neutral-300 align-middle font-mono text-[8.5px] font-bold text-neutral-900">
                          {mObj?.model || "—"}
                        </td>
                        <td className="p-1 border border-neutral-300 align-middle font-mono text-[8.5px] font-bold text-neutral-900">
                          {mObj?.serial_number || mObj?.machine_code || "—"}
                        </td>
                      </>
                    ) : viewMode !== "machine" ? (
                      <td className="p-1 border border-neutral-300 align-middle text-[8.5px] leading-tight">
                        <div className="font-bold text-neutral-900">{mObj?.machine_name || "Machine"}</div>
                        <div className="font-mono text-[7.5px] text-neutral-600">{mObj?.machine_code || "—"}</div>
                      </td>
                    ) : null}
                    {viewMode !== "client" && (
                      <td className="p-1 border border-neutral-300 align-middle text-[8.5px] leading-tight">
                        <div className="font-bold text-neutral-900">{(log as any)?.client?.client_name || mObj?.customer_name || "Unassigned Client"}</div>
                        <div className="text-[7.5px] text-neutral-600">{log.location || ((log as any)?.client?.city ? `${(log as any).client.city}, ${(log as any).client.state || ""}` : mObj?.city ? `${mObj.city}, ${mObj.state || ""}` : "—")}</div>
                      </td>
                    )}
                    <td className="p-1 border border-neutral-300 font-semibold text-neutral-800 align-middle text-[8.5px]">
                      {logOp?.full_name || "Unassigned"}
                    </td>
                    {viewMode === "client" ? (
                      <>
                        <td className="p-1 border border-neutral-300 font-mono text-[8px] font-semibold text-neutral-900 text-center align-middle whitespace-nowrap">
                          {formatCompactTiming(log.start_time, log.end_time)}
                        </td>
                        <td className="p-0.5 border border-neutral-300 text-center align-middle font-mono font-bold text-[8.5px] whitespace-nowrap">
                          {runningHrs}h
                        </td>
                        <td className="p-0.5 border border-neutral-300 text-[8px] text-center align-middle whitespace-nowrap">
                          {isBkd ? (
                            <span className="font-extrabold text-rose-700 block text-[8px] font-mono text-center whitespace-nowrap">
                              {displayBkdText}
                            </span>
                          ) : (
                            <span className="font-semibold text-emerald-700 block text-[8px] text-center whitespace-nowrap">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="p-1 border border-neutral-300 align-middle text-[8px] italic text-neutral-700">
                          {cleanRemarks}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-0.5 border border-neutral-300 font-mono text-[8px] font-bold text-neutral-900 text-center align-middle whitespace-nowrap">
                          {startMtr} → {endMtr}
                        </td>
                        <td className="p-0.5 border border-neutral-300 text-center align-middle font-mono font-bold text-[8.5px] whitespace-nowrap">
                          {runningHrs}h
                        </td>
                        <td className="p-0.5 border border-neutral-300 text-[8px] text-center align-middle whitespace-nowrap">
                          {isBkd ? (
                            <span className="font-extrabold text-rose-700 block text-[8px] font-mono text-center whitespace-nowrap">
                              {displayBkdText}
                            </span>
                          ) : (
                            <span className="font-bold text-emerald-700 block text-[8px] text-center whitespace-nowrap">
                              Normal
                            </span>
                          )}
                        </td>
                        {viewMode === "machine" && (
                          <td className="p-1 border border-neutral-300 align-middle text-[8px] italic text-neutral-700">
                            {cleanRemarks}
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
      </div>

      {/* 4. VERIFICATION SIGNATURES & CLIENT DETAILS */}
      {(() => {
        const clientDisplayName =
          viewMode === "client" && selectedEntityId !== "all"
            ? selectedEntityId
            : (logs[0]?.machine as any)?.customer_name || "Client Representative";

        const clientLocationText =
          selectedSite && selectedSite !== "all"
            ? `Site: ${selectedSite}`
            : logs[0]?.location ||
              ((logs[0]?.machine as any)?.customer_address
                ? `${(logs[0]?.machine as any).customer_address}${(logs[0]?.machine as any).city ? `, ${(logs[0]?.machine as any).city}` : ""}`
                : (logs[0]?.machine as any)?.city) ||
              "(Client Representative)";

        return (
          <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-3 border-t border-neutral-300 text-center text-[9.5px] text-neutral-600 print-signature-block">
            {/* Column 1: Prepared By */}
            <div className="flex flex-col items-center space-y-0.5">
              <span className="font-extrabold text-neutral-900 text-[9.5px] uppercase">Prepared By</span>
              <div className="w-28 sm:w-36 border-b border-neutral-400 mb-0.5 h-6 flex items-end justify-center font-serif text-neutral-800 text-[10.5px] italic font-bold">
                {isOperatorView ? operatorName : supervisorName}
              </div>
              <span className="font-bold text-neutral-800 text-[8.5px]">
                {isOperatorView ? "(Machine Operator)" : "(Operations Supervisor)"}
              </span>
              <div className="flex items-center justify-between w-full max-w-[135px] text-[8px] text-neutral-700 pt-1 font-mono">
                <span>Sign: _______</span>
                <span>Date: _______</span>
              </div>
            </div>

            {/* Column 2: Client Details & Sign-Off */}
            <div className="flex flex-col items-center space-y-0.5">
              <span className="font-extrabold text-neutral-900 text-[9.5px] uppercase">Client Details & Sign-off</span>
              <div className="w-28 sm:w-36 border-b border-neutral-400 mb-0.5 h-6 flex items-end justify-center font-sans text-neutral-900 text-[9.5px] font-bold truncate px-1">
                {clientDisplayName}
              </div>
              <span className="font-bold text-neutral-800 text-[8.5px] truncate max-w-[150px]">
                {clientLocationText}
              </span>
              <div className="flex items-center justify-between w-full max-w-[135px] text-[8px] text-neutral-700 pt-1 font-mono">
                <span>Sign: _______</span>
                <span>Date: _______</span>
              </div>
            </div>

            {/* Column 3: Verified & Approved By */}
            <div className="flex flex-col items-center space-y-0.5">
              <span className="font-extrabold text-neutral-900 text-[9.5px] uppercase">Verified & Approved By</span>
              <div className="w-28 sm:w-36 border-b border-neutral-400 mb-0.5 h-6 flex items-end justify-center font-sans text-neutral-900 text-[9.5px] font-extrabold tracking-wider">
                REACH INTERNATIONAL
              </div>
              <span className="font-bold text-neutral-800 text-[8.5px]">
                (Operations / Service Manager)
              </span>
              <div className="flex items-center justify-between w-full max-w-[135px] text-[8px] text-neutral-700 pt-1 font-mono">
                <span>Sign: _______</span>
                <span>Date: _______</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export function PrintableSupervisorLogsModal({
  open,
  onClose,
  logs = [],
  user,
  viewMode,
  selectedEntityId,
  selectedMonthValue,
  selectedSite = "all",
  selectedClientMachineId = "all",
  machines = [],
}: PrintableSupervisorLogsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeMonth, setActiveMonth] = useState<string>(selectedMonthValue || "all");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setActiveMonth(selectedMonthValue || "all");
  }, [selectedMonthValue]);

  // Apply Month & Entity Filters
  let filteredLogs = activeMonth === "all"
    ? logs
    : logs.filter((log) => getLogMonthNumber(log.log_date) === activeMonth);

  if (viewMode === "machine" && selectedEntityId !== "all") {
    filteredLogs = filteredLogs.filter((log) => log.machine_id === selectedEntityId);
  } else if (viewMode === "client" && selectedEntityId !== "all") {
    filteredLogs = filteredLogs.filter((log) => {
      const clientName = (log as any)?.client?.client_name || (log.machine as any)?.customer_name || "Unassigned Client";
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
    filteredLogs = filteredLogs.filter((log) => log.operator_id === selectedEntityId);
  }

  // Aggregate Metrics
  let totalRunningHours = 0;
  let totalOtHours = 0;
  let totalBreakdowns = 0;

  filteredLogs.forEach((log) => {
    const startMtr = log.start_meter ?? 0;
    const endMtr = log.end_meter ?? startMtr;
    const run = log.running_hours ?? Math.max(0, Math.round((endMtr - startMtr) * 10) / 10);
    const ot = log.overtime_hours || 0;
    totalRunningHours += run;
    totalOtHours += ot;
    if (log.is_breakdown) totalBreakdowns++;
  });

  const handlePrint = () => {
    const originalTitle = document.title;
    let pdfFileName = "";

    if (viewMode === "operator") {
      const firstOpObj = filteredLogs[0]?.operator as any;
      const opName = firstOpObj?.full_name || "Operator";
      pdfFileName = buildExportFileName(opName, activeMonth, "pdf");
    } else if (viewMode === "machine") {
      const selectedMachineObj =
        machines?.find((m) => m.id === selectedEntityId) ||
        (filteredLogs[0]?.machine as any);
      const mSerial =
        selectedMachineObj?.serial_number ||
        selectedMachineObj?.machine_code ||
        (filteredLogs[0]?.machine as any)?.serial_number ||
        (filteredLogs[0]?.machine as any)?.machine_code ||
        "Machine";
      pdfFileName = buildMachineExportFileName(mSerial, "pdf");
    } else if (viewMode === "client" && selectedClientMachineId && selectedClientMachineId !== "all") {
      const clientMachine =
        machines?.find((m) => m.id === selectedClientMachineId) ||
        filteredLogs.find((l) => l.machine_id === selectedClientMachineId)?.machine;
      const mSerial =
        (clientMachine as any)?.serial_number ||
        (clientMachine as any)?.machine_code ||
        "Machine";
      pdfFileName = buildMachineExportFileName(mSerial, "pdf");
    } else if (viewMode === "client") {
      const { slugDateTime } = formatExportDateTimeSlug();
      const clientSlug = (selectedEntityId || "Client").split(/[^a-zA-Z0-9]+/).filter(Boolean).join("-") || "Client";
      pdfFileName = `${clientSlug}-${slugDateTime}.pdf`;
    } else {
      const { slugDateTime } = formatExportDateTimeSlug();
      pdfFileName = `Supervisor-Running-Logs-${viewMode}-${slugDateTime}.pdf`;
    }

    document.title = pdfFileName.replace(/\.pdf$/, "");
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleExportExcel = () => {
    exportSupervisorRunningLogsToExcel({
      logs,
      viewMode,
      selectedEntityId,
      selectedMonthValue: activeMonth,
      supervisorName: user.full_name,
      selectedSite,
      selectedClientMachineId,
      machines,
    });
  };

  const reportProps: SupervisorReportContentProps = {
    logs: filteredLogs,
    user,
    viewMode,
    selectedEntityId,
    selectedMonth: activeMonth,
    totalRunningHours,
    totalOtHours,
    totalBreakdowns,
    selectedSite,
    selectedClientMachineId,
    machines,
  };

  return (
    <>
      <style>{`
        @media screen {
          #printable-supervisor-logs-document {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: portrait;
            margin: 5mm 8mm 5mm 8mm;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body > *:not(#printable-supervisor-logs-document) {
            display: none !important;
          }
          #printable-supervisor-logs-document,
          #printable-supervisor-logs-document * {
            visibility: visible !important;
          }
          #printable-supervisor-logs-document {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            z-index: 999999 !important;
          }
          .print-table-wrap {
            overflow: visible !important;
            width: 100% !important;
          }
          .print-table {
            min-width: 0 !important;
            width: 100% !important;
            table-layout: fixed !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          .print-signature-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {mounted && open && createPortal(
        <div id="printable-supervisor-logs-document">
          <SupervisorLogsReportContent {...reportProps} />
        </div>,
        document.body
      )}

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
            <div className="text-xs text-[var(--color-mute)] font-medium">
              Showing <strong>{filteredLogs.length}</strong> filtered log entries.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Export Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 max-w-full">
          {/* Month Selector Strip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-2.5 sm:p-4 max-w-[210mm] mx-auto w-full rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] no-print">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-ink)] shrink-0">
              <Calendar className="h-4 w-4 text-sky-500" />
              <span>Select Month Filter:</span>
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

          <div id="printable-supervisor-logs-document-preview" className="max-w-full overflow-x-auto custom-scrollbar">
            <SupervisorLogsReportContent {...reportProps} />
          </div>
        </div>
      </Modal>
    </>
  );
}
