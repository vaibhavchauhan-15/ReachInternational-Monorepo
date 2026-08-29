"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui";
import type { User, Machine } from "@/lib/types/database";
import type { OperatorHourLog } from "./OperatorDashboard";
import { formatDate, formatTo12Hour } from "@reachinternational/utils";
import {
  exportOperatorLogsToExcel,
  MONTH_NAMES,
  getLogMonthNumber,
  buildExportFileName,
} from "@/lib/utils/operator-logs-export";
import { Printer, FileSpreadsheet, Calendar } from "lucide-react";

interface PrintableOperatorLogsModalProps {
  open: boolean;
  onClose: () => void;
  logs: OperatorHourLog[];
  user: User;
  assignedMachine?: Machine | null;
}

// Compute operating duration fallback
function computeDurationHours(startStr?: string, endStr?: string): number {
  const parseMins = (t?: string) => {
    if (!t) return null;
    const match = t.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (match[3] === "PM" && h < 12) h += 12;
    if (match[3] === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };
  const sMins = parseMins(startStr);
  const eMins = parseMins(endStr);
  if (sMins === null || eMins === null) return 8;
  let diff = eMins - sMins;
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 10) / 10;
}

// Compact timing range formatter with zero spaces (e.g. "06:00AM-06:00PM")
function formatCompactTiming(startStr?: string, endStr?: string): string {
  const formattedStart = formatTo12Hour(startStr) || "06:00 AM";
  const formattedEnd = formatTo12Hour(endStr) || "02:00 PM";
  return `${formattedStart.replace(/\s+/g, "")}-${formattedEnd.replace(/\s+/g, "")}`;
}

interface ReportContentProps {
  logs: OperatorHourLog[];
  user: User;
  assignedMachine?: Machine | null;
  selectedMonth: string;
  totalOpHours: number;
  totalOtHours: number;
  totalBreakdowns: number;
}

function OperatorLogsReportContent({
  logs,
  user,
  assignedMachine,
  selectedMonth,
  totalOpHours,
  totalOtHours,
  totalBreakdowns,
}: ReportContentProps) {
  const operatorName = user.full_name || "Operator";
  const operatorEmail = user.email || "—";
  const operatorPhone = user.phone || "—";

  let monthLabel = "All Months";
  if (selectedMonth !== "all") {
    const mObj = MONTH_NAMES.find((m) => m.value === selectedMonth);
    if (mObj) monthLabel = mObj.label;
  }

  return (
    <div className="bg-white text-black p-2.5 sm:p-4 rounded-xl border border-neutral-300 shadow-sm flex flex-col justify-between text-xs font-sans max-w-[210mm] mx-auto space-y-2 sm:space-y-2.5 w-full">
      {/* ========================================================= */}
      {/* 1. TOP HEADING & CONSOLIDATED METADATA STRIP              */}
      {/* ========================================================= */}
      <div className="pb-2 border-b-2 border-neutral-900 space-y-1.5">
        <div className="grid grid-cols-[110px_1fr_110px] sm:grid-cols-[140px_1fr_140px] items-center gap-2">
          {/* Top Left Logo */}
          <div className="flex items-center justify-start shrink-0">
            {/* eslint-disable-next-html-element-suppress */}
            <img
              src="/pdf-logo.png"
              alt="Reach International"
              className="h-10 sm:h-12 w-auto object-contain"
            />
          </div>

          {/* Report Title (Middle/Center Aligned) */}
          <div className="text-center min-w-0">
            <h2 className="text-sm sm:text-base font-black uppercase text-neutral-900 tracking-wider text-center">
              OPERATOR DAILY MACHINE LOG REPORT
            </h2>
          </div>

          {/* Right Spacer for Perfect Centering Balance */}
          <div className="hidden sm:block w-[110px] sm:w-[140px] shrink-0"></div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-4 sm:gap-x-5 gap-y-1 text-[9.5px] sm:text-[10px] text-neutral-800 font-medium leading-tight pt-1 border-t border-neutral-200">
          <div><strong>Operator:</strong> {operatorName}</div>
          <div><strong>Number:</strong> {operatorPhone}</div>
          {selectedMonth !== "all" && (
            <div><strong>Month:</strong> {monthLabel}</div>
          )}
          {assignedMachine && (
            <div><strong>Machine:</strong> {assignedMachine.machine_name} ({assignedMachine.machine_code})</div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. LOGS KPI SUMMARY STRIP                                */}
      {/* ========================================================= */}
      <div className="grid grid-cols-4 gap-1 sm:gap-1.5 bg-neutral-900 text-white p-1.5 rounded-lg text-center font-mono">
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">Total Logs</span>
          <span className="text-[10px] sm:text-[11px] font-black">{logs.length} Logs</span>
        </div>
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">Total Operating Hrs</span>
          <span className="text-[10px] sm:text-[11px] font-black text-sky-400">{Math.round(totalOpHours * 10) / 10} hrs</span>
        </div>
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">Total Overtime Hrs</span>
          <span className="text-[10px] sm:text-[11px] font-black text-amber-400">{Math.round(totalOtHours * 10) / 10} hrs</span>
        </div>
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">Breakdown Incidents</span>
          <span className="text-[10px] sm:text-[11px] font-black text-rose-400">{totalBreakdowns} Events</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. DETAILED MACHINE LOGS RESPONSIVE TABLE                 */}
      {/* ========================================================= */}
      <div className="w-full overflow-x-auto custom-scrollbar print-table-wrap">
        <table className="w-full text-left border border-neutral-900 border-collapse print-table min-w-[660px] sm:min-w-0">
          <thead>
            <tr className="bg-neutral-900 text-white font-bold text-[8px] uppercase tracking-wider">
              <th className="p-0.5 border border-neutral-800 w-[4%] sm:w-[20px] text-center align-middle">S.N</th>
              <th className="p-0.5 border border-neutral-800 w-[9%] sm:w-[55px] font-mono text-center align-middle whitespace-nowrap">DATE</th>
              <th className="p-1 border border-neutral-800 w-[18%] sm:w-[125px] align-middle">MACHINE NAME</th>
              <th className="p-0.5 border border-neutral-800 w-[10%] sm:w-[65px] font-mono text-center align-middle whitespace-nowrap">MCH CODE</th>
              <th className="p-0.5 border border-neutral-800 w-[12%] sm:w-[75px] font-mono text-center align-middle whitespace-nowrap">METER (HRS)</th>
              <th className="p-0.5 border border-neutral-800 w-[12%] sm:w-[75px] font-mono text-center align-middle whitespace-nowrap">TIMINGS</th>
              <th className="p-0.5 border border-neutral-800 text-center w-[5%] sm:w-[28px] align-middle whitespace-nowrap">OP</th>
              <th className="p-0.5 border border-neutral-800 text-center w-[5%] sm:w-[28px] align-middle whitespace-nowrap">OT</th>
              <th className="p-0.5 border border-neutral-800 text-center w-[7%] sm:w-[45px] align-middle whitespace-nowrap">BREAKDOWN</th>
              <th className="p-1 border border-neutral-800 w-[18%] sm:auto align-middle">REMARKS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-300">
            {logs.length > 0 ? (
              logs.map((log, idx) => {
                const isBkd = log.is_breakdown || log.machine_condition === "breakdown";
                const opHrs = log.running_hours || computeDurationHours(log.start_time, log.end_time);
                const otHrs = log.overtime_hours || 0;

                const bkdMatch = (log.remarks || "").match(/\[Breakdown Duration:\s*([^\]]+)\]/i) || (log.remarks || "").match(/Breakdown\s*(?:Duration)?:?\s*(\d+h?\s*\d*m?)/i);
                const bkdDetails = bkdMatch ? bkdMatch[1].trim() : isBkd ? "Breakdown" : null;
                const cleanRemarks = (log.remarks || "").replace(/\[Breakdown Duration:\s*[^\]]+\]\s*/gi, "").trim() || "—";
                let bkdDurationOnly = bkdDetails;
                if (bkdDurationOnly) {
                  bkdDurationOnly = bkdDurationOnly.replace(/^Breakdown\s*\((.*)\)$/i, "$1").replace(/^Machine Breakdown\s*\((.*)\)$/i, "$1").replace(/^Breakdown\s*/i, "").replace(/\s*duration$/i, "").trim();
                }
                const displayBkdText = isBkd ? (bkdDurationOnly && bkdDurationOnly.toLowerCase() !== "breakdown" ? bkdDurationOnly : "Breakdown") : "Normal";

                return (
                  <tr key={log.id || idx} className="bg-white">
                    <td className="p-0.5 border border-neutral-300 text-center align-middle font-bold text-[8.5px]">{idx + 1}</td>
                    <td className="p-0.5 border border-neutral-300 font-mono text-neutral-800 text-center align-middle text-[8px] whitespace-nowrap">
                      {formatDate(log.log_date)}
                    </td>
                    <td className="p-1 border border-neutral-300 font-bold text-neutral-900 align-middle text-[9px] leading-tight">
                      {log.machine?.machine_name || assignedMachine?.machine_name || "Machine"}
                    </td>
                    <td className="p-0.5 border border-neutral-300 font-mono text-[8.5px] font-semibold text-neutral-700 text-center align-middle whitespace-nowrap">
                      {log.machine?.machine_code || assignedMachine?.machine_code || "—"}
                    </td>
                    <td className="p-0.5 border border-neutral-300 font-mono text-[8px] font-bold text-neutral-900 text-center align-middle whitespace-nowrap">
                      {log.start_meter ?? 0} → {log.end_meter ?? 0}
                    </td>
                    <td className="p-0.5 border border-neutral-300 font-mono text-[8px] text-neutral-800 text-center align-middle whitespace-nowrap">
                      <div>{formatCompactTiming(log.start_time, log.end_time)}</div>
                      <div className="text-[7.5px] text-sky-700 font-bold">
                        {(log as any).normal_working_hours ?? 8}h normal
                      </div>
                    </td>
                    <td className="p-0.5 border border-neutral-300 text-center align-middle font-mono font-bold text-[8.5px] whitespace-nowrap">
                      {opHrs}h
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
              })
            ) : (
              <tr className="bg-white">
                <td colSpan={10} className="p-2 border border-neutral-300 text-center text-neutral-500 font-medium">
                  No daily machine log entries recorded for the selected month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================= */}
      {/* 4. VERIFICATION & SIGNATURES SECTION                      */}
      {/* ========================================================= */}
      {(() => {
        const clientDisplayName =
          (logs[0] as any)?.client?.client_name ||
          (logs[0]?.machine as any)?.customer_name ||
          assignedMachine?.customer_name ||
          "Client Representative";

        const clientLocationText =
          logs[0]?.location ||
          (assignedMachine as any)?.customer_address ||
          (assignedMachine as any)?.city ||
          "(Client Representative)";

        return (
          <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-3 border-t border-neutral-300 text-center text-[9.5px] text-neutral-600 print-signature-block">
            {/* Column 1: Prepared By */}
            <div className="flex flex-col items-center space-y-0.5">
              <span className="font-extrabold text-neutral-900 text-[9.5px] uppercase">Prepared By</span>
              <div className="w-28 sm:w-36 border-b border-neutral-400 mb-0.5 h-6 flex items-end justify-center font-serif text-neutral-800 text-[10.5px] italic font-bold">
                {operatorName}
              </div>
              <span className="font-bold text-neutral-800 text-[8.5px]">
                (Machine Operator)
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

export function PrintableOperatorLogsModal({
  open,
  onClose,
  logs = [],
  user,
  assignedMachine,
}: PrintableOperatorLogsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter logs month-wise
  const filteredLogs =
    selectedMonth === "all"
      ? logs
      : logs.filter((log) => getLogMonthNumber(log.log_date) === selectedMonth);

  // Aggregate KPI Metrics for filtered logs
  let totalOpHours = 0;
  let totalOtHours = 0;
  let totalBreakdowns = 0;

  filteredLogs.forEach((log) => {
    const isBkd = log.is_breakdown || log.machine_condition === "breakdown";
    if (isBkd) totalBreakdowns++;
    const op = log.running_hours || computeDurationHours(log.start_time, log.end_time);
    const ot = log.overtime_hours || 0;
    totalOpHours += op;
    totalOtHours += ot;
  });

  const handlePrint = () => {
    const pdfFileName = buildExportFileName(user.full_name || "Operator", selectedMonth, "pdf");
    const originalTitle = document.title;
    document.title = pdfFileName.replace(/\.pdf$/, "");
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleExportExcel = () => {
    exportOperatorLogsToExcel(logs, user, assignedMachine, selectedMonth);
  };

  const reportProps: ReportContentProps = {
    logs: filteredLogs,
    user,
    assignedMachine,
    selectedMonth,
    totalOpHours,
    totalOtHours,
    totalBreakdowns,
  };

  return (
    <>
      {/* Screen & Print Media Stylesheet */}
      <style>{`
        @media screen {
          #printable-operator-logs-document {
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
          body > *:not(#printable-operator-logs-document) {
            display: none !important;
          }
          #printable-operator-logs-document,
          #printable-operator-logs-document * {
            visibility: visible !important;
          }
          #printable-operator-logs-document {
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

      {/* Render Portal to document.body for clean, unconstrained print rendering */}
      {mounted && open && createPortal(
        <div id="printable-operator-logs-document">
          <OperatorLogsReportContent {...reportProps} />
        </div>,
        document.body
      )}

      {/* Render Modal for On-Screen Interactive Preview */}
      <Modal
        open={open}
        onClose={onClose}
        title={
          <div className="flex items-center justify-between w-full pr-6">
            <span className="text-base font-extrabold text-[var(--color-ink)]">
              Daily Machine Logs PDF Report
            </span>
          </div>
        }
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full pt-2 no-print">
            <div className="text-xs text-[var(--color-mute)] font-medium">
              Showing <strong>{filteredLogs.length}</strong> log entries.
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
              <span>Select Export Month:</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar flex-nowrap w-full sm:w-auto p-1 bg-[var(--color-canvas-elevated)] rounded-lg border border-[var(--color-hairline)]">
              {MONTH_NAMES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setSelectedMonth(m.value)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedMonth === m.value
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                  }`}
                >
                  {m.short}
                </button>
              ))}
            </div>
          </div>

          <div id="printable-operator-logs-document-preview" className="max-w-full overflow-x-auto custom-scrollbar">
            <OperatorLogsReportContent {...reportProps} />
          </div>
        </div>
      </Modal>
    </>
  );
}


