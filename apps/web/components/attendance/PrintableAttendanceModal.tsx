"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui";
import {
  PDFReportHeader,
  PDFKPIStrip,
  PDFSignatureBlock,
  PDFTableWrapper,
  openPrintWindow,
  getPrintStylesheet,
} from "@/components/pdf";
import { formatExportDateTimeSlug } from "@/lib/pdf/pdf-config";
import {
  exportAttendanceToExcel,
  type AttendanceExportEmployee,
  type AttendanceExportDay,
  type AttendanceExportMetrics,
} from "@/lib/utils/attendance-export";
import { Printer, FileSpreadsheet } from "lucide-react";
import { formatMinutes, normalizeClientSiteAddress } from "@reachinternational/utils";

const PRINT_DOC_ID = "printable-attendance-document";
const PREVIEW_ID = "printable-attendance-document-preview";

export interface PrintableAttendanceModalProps {
  open: boolean;
  onClose: () => void;
  employee: AttendanceExportEmployee;
  currentMonth: string; // "2026-09"
  days: AttendanceExportDay[];
  metrics: AttendanceExportMetrics;
  userRole?: string;
  isSelf?: boolean;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function formatDateShortWithDow(dateStr: string, dow: number): string {
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const day = parts[2];
  const dowName = DOW_LABELS[dow] || "";
  return `${day} (${dowName})`;
}

/**
 * Calculates optimal row height (in mm) for A4 portrait document so the attendance
 * table dynamically fills the page, eliminates large empty voids, and guarantees
 * that header, KPI strip, all 30/31 days, and signature block fit comfortably on a single page.
 */
function calculateAttendanceRowHeight(rowCount: number): {
  rowHeightMm: number;
  footerRowHeightMm: number;
} {
  const TARGET_PAGE_H_MM = 278;
  const headerH = 32; // PDFReportHeader (logo, title, subtitle, user details metadata strip)
  const kpiH = 14; // PDFKPIStrip
  const theadH = 7; // thead
  const tfootH = 7; // tfoot
  const signatureH = 26; // PDFSignatureBlock (3-col signatures)
  const paddingH = 6; // container padding, borders, gaps

  const fixedH = headerH + kpiH + theadH + tfootH + signatureH + paddingH;
  const availableHeightMm = Math.max(50, TARGET_PAGE_H_MM - fixedH);
  const count = Math.max(1, rowCount);
  const rawRowH = availableHeightMm / count;

  // Clamping: 5.4mm (ensures 31 rows fit cleanly on 1 page) to 9.5mm (for shorter datasets)
  const MIN_ROW_MM = 5.4;
  const MAX_ROW_MM = 9.5;
  const rowHeightMm = Math.min(MAX_ROW_MM, Math.max(MIN_ROW_MM, rawRowH));
  const footerRowHeightMm = Math.min(8.5, Math.max(5.2, rowHeightMm * 0.9));

  return {
    rowHeightMm: Math.round(rowHeightMm * 10) / 10,
    footerRowHeightMm: Math.round(footerRowHeightMm * 10) / 10,
  };
}

function AttendanceReportContent({
  employee,
  currentMonth,
  days,
  metrics,
  isOperator,
}: {
  employee: AttendanceExportEmployee;
  currentMonth: string;
  days: AttendanceExportDay[];
  metrics: AttendanceExportMetrics;
  isOperator: boolean;
}) {
  const [yearStr, monthStr] = currentMonth.split("-");
  const monthDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const monthName = monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const formattedEmpId = employee.employee_id || `EMP-${employee.id.slice(0, 8).toUpperCase()}`;

  const { rowHeightMm, footerRowHeightMm } = useMemo(
    () => calculateAttendanceRowHeight(days.length),
    [days.length]
  );

  const metadataItems = [
    { label: "Employee Name", value: employee.full_name },
    { label: "Employee ID", value: formattedEmpId },
    { label: "Role", value: employee.role.toUpperCase() },
    { label: "Phone", value: employee.phone || "—" },
    {
      label: "Site Location",
      value: employee.city
        ? `${employee.city}${employee.state ? `, ${employee.state}` : ""}`
        : "All Sites",
    },
    {
      label: "Shift Timing",
      value:
        employee.shift_start_time && employee.shift_end_time
          ? `${formatTimeAMPM(employee.shift_start_time)} – ${formatTimeAMPM(employee.shift_end_time)}`
          : "08:00 AM – 05:00 PM",
    },
    { label: "Month", value: monthName },
    { label: "Generated", value: new Date().toLocaleDateString("en-IN", { dateStyle: "medium" }) },
  ];

  const kpis = [
    { label: "Total Days", value: `${days.length} Days` },
    { label: "Present", value: `${metrics.present} Days`, valueColor: "text-emerald-700" },
    { label: "Absent", value: `${metrics.absent} Days`, valueColor: "text-rose-700" },
    { label: "Half Day", value: `${metrics.halfDay} Days`, valueColor: "text-amber-700" },
    { label: "Week Off", value: `${metrics.weekOff} Days` },
    { label: "Worked Hours", value: formatMinutes(metrics.totalWorkedMins), valueColor: "text-sky-700" },
    { label: "Overtime", value: `+${formatMinutes(metrics.totalOtMins)}`, valueColor: "text-amber-700" },
    { label: "Payable Days", value: `${metrics.payableDays.toFixed(1)} Days`, valueColor: "text-emerald-700" },
  ];

  const signatureColumns = [
    {
      heading: "Employee Sign-off",
      name: employee.full_name,
      role: `(${employee.role.toUpperCase()})`,
    },
    {
      heading: "Site Supervisor / HR",
      name: "Operations / HR Representative",
      role: "(Operations / HR Supervisor)",
    },
    {
      heading: "Authorized Signatory",
      name: "REACH INTERNATIONAL",
      role: "(Authorized Signatory)",
      nameUppercase: true,
    },
  ];

  return (
    <div className="print-document-container w-full">
      <div
        className="print-page bg-white text-black p-3 sm:p-4 rounded-lg border border-neutral-300 shadow-md flex flex-col justify-between text-xs font-sans max-w-[210mm] w-full min-h-[287mm] max-h-[287mm] mx-auto print:p-0 print:border-none print:shadow-none print:rounded-none overflow-hidden"
        style={{
          width: "210mm",
          height: "287mm",
          minHeight: "287mm",
          maxHeight: "287mm",
          boxSizing: "border-box",
        }}
      >
        {/* Top Section: Header + KPI Strip + Attendance Table */}
        <div className="flex flex-col gap-y-2">
          {/* 1. Header with Red Logo and User Details */}
          <PDFReportHeader
            title={isOperator ? "OPERATOR ATTENDANCE REPORT" : "EMPLOYEE ATTENDANCE REPORT"}
            subtitle="Monthly Attendance Ledger, Shift Timings & Working Hours"
            metadataItems={metadataItems}
            logoSrc="/pdf-logo.png"
            centeredLayout={false}
          />

          {/* 2. KPI Summary Strip */}
          <PDFKPIStrip items={kpis} />

          {/* 3. High-Density Balanced Attendance Table */}
          <PDFTableWrapper>
            <table className="w-full text-center border border-neutral-900 border-collapse print-table table-fixed min-w-[700px] sm:min-w-0 mx-auto">
              <thead>
                <tr className="bg-neutral-100 text-neutral-900 border-b-2 border-neutral-900 font-bold text-[8px]">
                  <th className="py-1 px-1 border border-neutral-900 w-[11%] text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis">
                    Date & Day
                  </th>
                  <th className="py-1 px-0.5 border border-neutral-900 w-[9%] text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis">
                    Status
                  </th>
                  <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis">
                    Start Time
                  </th>
                  <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis">
                    End Time
                  </th>
                  <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis">
                    Worked Hrs
                  </th>
                  <th className="py-1 px-0.5 border border-neutral-900 w-[9%] font-mono text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis">
                    Overtime
                  </th>
                  <th className="py-1 px-1 border border-neutral-900 w-[14%] text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis">
                    Primary Machine
                  </th>
                  <th className="py-1 px-1 border border-neutral-900 w-[30%] text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis">
                    Site Location
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const isUpcoming = d.effectiveStatus === "DISABLED";
                  const isPresent = d.status === "PRESENT" && !isUpcoming;
                  const isAbsent = d.status === "ABSENT" && !isUpcoming;
                  const isHalfDay = d.status === "HALF_DAY" && !isUpcoming;
                  const isWeekOff = d.status === "WEEK_OFF";

                  let statusBadgeBg = "bg-neutral-100 text-neutral-600 border border-neutral-200";
                  let statusLabel = "Upcoming";
                  if (isPresent) {
                    statusBadgeBg = "bg-emerald-50 text-emerald-800 border border-emerald-300";
                    statusLabel = "Present";
                  } else if (isAbsent) {
                    statusBadgeBg = "bg-rose-50 text-rose-800 border border-rose-300";
                    statusLabel = "Absent";
                  } else if (isHalfDay) {
                    statusBadgeBg = "bg-amber-50 text-amber-800 border border-amber-300";
                    statusLabel = "Half Day";
                  } else if (isWeekOff) {
                    statusBadgeBg = "bg-neutral-50 text-neutral-500 border border-neutral-200";
                    statusLabel = "Week Off";
                  } else if (d.isToday && isUpcoming) {
                    statusBadgeBg = "bg-sky-50 text-sky-800 border border-sky-300";
                    statusLabel = "In Progress";
                  }

                  const displayLocation =
                    normalizeClientSiteAddress(d.primaryLocation) || d.primaryLocation || "—";

                  return (
                    <tr
                      key={d.date}
                      className="bg-white border-b border-neutral-300 text-[8px]"
                      style={{
                        height: `${rowHeightMm}mm`,
                        minHeight: `${rowHeightMm}mm`,
                        maxHeight: `${rowHeightMm}mm`,
                      }}
                    >
                      {/* Date */}
                      <td
                        className="px-1 border border-neutral-300 font-mono font-bold text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          height: `${rowHeightMm}mm`,
                          minHeight: `${rowHeightMm}mm`,
                          maxHeight: `${rowHeightMm}mm`,
                          verticalAlign: "middle",
                        }}
                      >
                        {formatDateShortWithDow(d.date, d.dow)}
                      </td>

                      {/* Status */}
                      <td
                        className="px-0.5 border border-neutral-300 text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          height: `${rowHeightMm}mm`,
                          minHeight: `${rowHeightMm}mm`,
                          maxHeight: `${rowHeightMm}mm`,
                          verticalAlign: "middle",
                        }}
                      >
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[7.5px] font-bold ${statusBadgeBg}`}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      {/* Start Time */}
                      <td
                        className="px-0.5 border border-neutral-300 font-mono text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          height: `${rowHeightMm}mm`,
                          minHeight: `${rowHeightMm}mm`,
                          maxHeight: `${rowHeightMm}mm`,
                          verticalAlign: "middle",
                        }}
                      >
                        {d.punchIn ? formatTimeAMPM(d.punchIn) : "—"}
                      </td>

                      {/* End Time */}
                      <td
                        className="px-0.5 border border-neutral-300 font-mono text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          height: `${rowHeightMm}mm`,
                          minHeight: `${rowHeightMm}mm`,
                          maxHeight: `${rowHeightMm}mm`,
                          verticalAlign: "middle",
                        }}
                      >
                        {d.punchOut ? formatTimeAMPM(d.punchOut) : "—"}
                      </td>

                      {/* Worked Hours */}
                      <td
                        className="px-0.5 border border-neutral-300 font-mono font-bold text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          height: `${rowHeightMm}mm`,
                          minHeight: `${rowHeightMm}mm`,
                          maxHeight: `${rowHeightMm}mm`,
                          verticalAlign: "middle",
                        }}
                      >
                        {d.worked_minutes > 0 ? (
                          formatMinutes(d.worked_minutes)
                        ) : isWeekOff ? (
                          <span className="text-neutral-500 font-normal">Off</span>
                        ) : (
                          <span className="text-neutral-400 font-normal">0h</span>
                        )}
                      </td>

                      {/* Overtime */}
                      <td
                        className="px-0.5 border border-neutral-300 font-mono font-bold text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          height: `${rowHeightMm}mm`,
                          minHeight: `${rowHeightMm}mm`,
                          maxHeight: `${rowHeightMm}mm`,
                          verticalAlign: "middle",
                        }}
                      >
                        {d.overtime_minutes > 0 ? (
                          <span className="text-amber-700">+{formatMinutes(d.overtime_minutes)}</span>
                        ) : (
                          <span className="text-neutral-400 font-normal">—</span>
                        )}
                      </td>

                      {/* Primary Machine */}
                      <td
                        className="px-1 border border-neutral-300 font-mono text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          height: `${rowHeightMm}mm`,
                          minHeight: `${rowHeightMm}mm`,
                          maxHeight: `${rowHeightMm}mm`,
                          verticalAlign: "middle",
                        }}
                        title={d.primaryMachine || "—"}
                      >
                        {d.primaryMachine || "—"}
                      </td>

                      {/* Site Location */}
                      <td
                        className="px-1 border border-neutral-300 text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                        style={{
                          height: `${rowHeightMm}mm`,
                          minHeight: `${rowHeightMm}mm`,
                          maxHeight: `${rowHeightMm}mm`,
                          verticalAlign: "middle",
                        }}
                        title={d.primaryLocation || "—"}
                      >
                        {displayLocation}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-neutral-900 bg-neutral-100 font-bold text-[8px] select-none">
                <tr
                  style={{
                    height: `${footerRowHeightMm}mm`,
                    minHeight: `${footerRowHeightMm}mm`,
                    maxHeight: `${footerRowHeightMm}mm`,
                  }}
                >
                  <td
                    className="px-1 border border-neutral-900 font-black text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      height: `${footerRowHeightMm}mm`,
                      minHeight: `${footerRowHeightMm}mm`,
                      maxHeight: `${footerRowHeightMm}mm`,
                      verticalAlign: "middle",
                    }}
                  >
                    Monthly Totals
                  </td>
                  <td
                    className="px-0.5 border border-neutral-900 font-bold text-emerald-700 text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      height: `${footerRowHeightMm}mm`,
                      minHeight: `${footerRowHeightMm}mm`,
                      maxHeight: `${footerRowHeightMm}mm`,
                      verticalAlign: "middle",
                    }}
                  >
                    {metrics.present} Present
                  </td>
                  <td
                    className="px-0.5 border border-neutral-900 font-mono text-rose-700 text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      height: `${footerRowHeightMm}mm`,
                      minHeight: `${footerRowHeightMm}mm`,
                      maxHeight: `${footerRowHeightMm}mm`,
                      verticalAlign: "middle",
                    }}
                  >
                    {metrics.absent} Absent
                  </td>
                  <td
                    className="px-0.5 border border-neutral-900 font-mono text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      height: `${footerRowHeightMm}mm`,
                      minHeight: `${footerRowHeightMm}mm`,
                      maxHeight: `${footerRowHeightMm}mm`,
                      verticalAlign: "middle",
                    }}
                  >
                    {metrics.payableDays.toFixed(1)} Payable
                  </td>
                  <td
                    className="px-0.5 border border-neutral-900 font-mono font-bold text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      height: `${footerRowHeightMm}mm`,
                      minHeight: `${footerRowHeightMm}mm`,
                      maxHeight: `${footerRowHeightMm}mm`,
                      verticalAlign: "middle",
                    }}
                  >
                    {formatMinutes(metrics.totalWorkedMins)}
                  </td>
                  <td
                    className="px-0.5 border border-neutral-900 font-mono font-bold text-amber-700 text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      height: `${footerRowHeightMm}mm`,
                      minHeight: `${footerRowHeightMm}mm`,
                      maxHeight: `${footerRowHeightMm}mm`,
                      verticalAlign: "middle",
                    }}
                  >
                    +{formatMinutes(metrics.totalOtMins)}
                  </td>
                  <td
                    colSpan={2}
                    className="px-1 border border-neutral-900 text-neutral-700 text-center align-middle whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{
                      height: `${footerRowHeightMm}mm`,
                      minHeight: `${footerRowHeightMm}mm`,
                      maxHeight: `${footerRowHeightMm}mm`,
                      verticalAlign: "middle",
                    }}
                  >
                    {metrics.attendanceRate}% Attendance Compliance
                  </td>
                </tr>
              </tfoot>
            </table>
          </PDFTableWrapper>
        </div>

        {/* Bottom Section: Signature Block */}
        <div className="pt-2">
          <PDFSignatureBlock columns={signatureColumns} />
        </div>
      </div>
    </div>
  );
}

export function PrintableAttendanceModal({
  open,
  onClose,
  employee,
  currentMonth,
  days,
  metrics,
  userRole,
  isSelf = false,
}: PrintableAttendanceModalProps) {
  const [mounted, setMounted] = useState(false);
  const isOperator = userRole === "operator" || isSelf;

  useEffect(() => {
    setMounted(true);
  }, []);

  const [yearStr, monthStr] = currentMonth.split("-");
  const monthDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const monthName = monthDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const handlePrint = useCallback(() => {
    const previewEl = document.getElementById(PREVIEW_ID);
    const sanitizedEmpName = employee.full_name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const { slugDateTime } = formatExportDateTimeSlug();
    const pdfFileName = `Attendance_${sanitizedEmpName}_${currentMonth}_${slugDateTime}.pdf`;

    const extraPrintStyles = `
      .print-page {
        width: 210mm !important;
        height: 287mm !important;
        max-height: 287mm !important;
        min-height: 287mm !important;
        padding: 2.5mm 5mm !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
      }
      .print-table {
        table-layout: fixed !important;
        width: 100% !important;
      }
      .print-table thead th {
        font-size: 8px !important;
        padding: 1.5px 2px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        line-height: 1.1 !important;
      }
      .print-table tbody td {
        font-size: 8px !important;
        padding: 0.5px 2px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        line-height: 1.15 !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
      }
      .print-table tbody td * {
        white-space: nowrap !important;
      }
      .print-table tfoot td {
        font-size: 8px !important;
        padding: 1px 2px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        line-height: 1.1 !important;
      }
      @page {
        size: A4 portrait !important;
        margin: 5mm !important;
      }
    `;

    if (previewEl) {
      openPrintWindow(previewEl.innerHTML, pdfFileName, extraPrintStyles);
      return;
    }
    const portalEl = document.getElementById(PRINT_DOC_ID);
    if (portalEl) {
      openPrintWindow(portalEl.innerHTML, pdfFileName, extraPrintStyles);
    }
  }, [employee.full_name, currentMonth]);

  const handleExportExcel = useCallback(() => {
    exportAttendanceToExcel({
      employee,
      currentMonth,
      days,
      metrics,
    });
  }, [employee, currentMonth, days, metrics]);

  const reportContentProps = {
    employee,
    currentMonth,
    days,
    metrics,
    isOperator,
  };

  return (
    <>
      {/* Centralized Print Stylesheet & Screen Preview Single-Line Guarantee */}
      <style>{`
        ${getPrintStylesheet(PRINT_DOC_ID, PREVIEW_ID, {
          includePreviewStyles: true,
          includeKpiStrip: true,
        })}
        #${PREVIEW_ID} .print-table {
          table-layout: fixed !important;
          width: 100% !important;
        }
        #${PREVIEW_ID} .print-table thead th {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          font-size: 8px !important;
          padding: 1.5px 2px !important;
        }
        #${PREVIEW_ID} .print-table tbody td {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          word-break: normal !important;
          overflow-wrap: normal !important;
          font-size: 8px !important;
          padding: 0.5px 2px !important;
        }
        #${PREVIEW_ID} .print-table tbody td * {
          white-space: nowrap !important;
        }
        #${PREVIEW_ID} .print-table tfoot td {
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          font-size: 8px !important;
          padding: 1px 2px !important;
        }
      `}</style>

      {/* Print Portal */}
      {mounted && open && createPortal(
        <div id={PRINT_DOC_ID}>
          <AttendanceReportContent {...reportContentProps} />
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
              {isOperator ? "My Attendance PDF Report" : "Attendance PDF Report"}
            </span>
          </div>
        }
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full pt-2 no-print">
            <div className="text-xs text-[var(--color-mute)] font-medium flex items-center gap-1.5">
              <span>
                Showing <strong>{days.length}</strong> daily attendance records for {monthName}.
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex-1 sm:flex-initial justify-center px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Export Excel</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-initial justify-center px-3.5 sm:px-5 py-2.5 sm:py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Printer className="h-4 w-4 shrink-0" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="max-w-full space-y-4">
          <div
            id={PREVIEW_ID}
            className="max-w-full overflow-x-auto custom-scrollbar flex justify-center py-2"
          >
            <AttendanceReportContent {...reportContentProps} />
          </div>
        </div>
      </Modal>
    </>
  );
}
