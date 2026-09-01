"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Modal } from "@/components/ui";
import type { Machine } from "@/lib/types/database";
import { formatDate } from "@reachinternational/utils";
import {
  exportMachinesToExcel,
  exportMachinesToCSV,
  formatMachinesExportDateTimeSlug,
  buildMachinesExportFileName,
} from "@/lib/utils/machines-export";
import { Printer, FileSpreadsheet, FileText, SlidersHorizontal } from "lucide-react";

interface PrintableMachineDirectoryModalProps {
  open: boolean;
  onClose: () => void;
  machines: Machine[];
  selectedIds?: (string | number)[];
  title?: string;
}

const FILTER_TABS = [
  { value: "all", label: "All Fleet" },
  { value: "available", label: "Available" },
  { value: "rented", label: "On Rent" },
  { value: "breakdown", label: "Breakdown" },
  { value: "under_maintenance", label: "Maintenance" },
];

function formatRentalStatus(status?: string): string {
  switch (status) {
    case "rented":
      return "On Rent";
    case "available":
      return "Available";
    case "maintenance":
      return "Maintenance";
    case "retired":
      return "Retired";
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Available";
  }
}

function formatHealthStatus(health?: string): string {
  switch (health) {
    case "active":
      return "Active";
    case "under_maintenance":
      return "Maintenance";
    case "breakdown":
      return "Breakdown";
    default:
      return health ? health.charAt(0).toUpperCase() + health.slice(1).replace(/_/g, " ") : "Active";
  }
}

interface ReportContentProps {
  machines: Machine[];
  totalAvailable: number;
  totalRented: number;
  totalBreakdowns: number;
  totalMaintenance: number;
  totalHmr: number;
  activeFilter: string;
  isSelectionOnly: boolean;
}

function MachineDirectoryReportContent({
  machines,
  totalAvailable,
  totalRented,
  totalBreakdowns,
  totalMaintenance,
  totalHmr,
  activeFilter,
  isSelectionOnly,
}: ReportContentProps) {
  const { displayDateTime } = formatMachinesExportDateTimeSlug();

  let filterLabel = "All Fleet Assets";
  if (isSelectionOnly) {
    filterLabel = `Selected Fleet (${machines.length} Machines)`;
  } else if (activeFilter !== "all") {
    const tab = FILTER_TABS.find((t) => t.value === activeFilter);
    if (tab) filterLabel = `Filtered: ${tab.label}`;
  }

  return (
    <div className="bg-white text-black p-2.5 sm:p-4 rounded-xl border border-neutral-300 shadow-sm flex flex-col justify-between text-xs font-sans max-w-[210mm] mx-auto space-y-2 sm:space-y-2.5 w-full">
      {/* 1. TOP HEADING & METADATA STRIP */}
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

          {/* Report Title */}
          <div className="text-center min-w-0">
            <h2 className="text-sm sm:text-base font-black uppercase text-neutral-900 tracking-wider text-center">
              MACHINE FLEET DIRECTORY REPORT
            </h2>
            <p className="text-[9.5px] sm:text-[10.5px] text-neutral-600 font-semibold uppercase tracking-tight text-center">
              Enterprise Machinery Inventory, Meter Telemetry & Site Allocations
            </p>
          </div>

          {/* Right Spacer for Balance */}
          <div className="hidden sm:block w-[110px] sm:w-[140px] shrink-0"></div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-4 sm:gap-x-5 gap-y-1 text-[9.5px] sm:text-[10px] text-neutral-800 font-medium leading-tight pt-1 border-t border-neutral-200">
          <div><strong>Report Scope:</strong> {filterLabel}</div>
          <div><strong>Total Machines:</strong> {machines.length} Units</div>
          <div><strong>Export Date:</strong> {displayDateTime}</div>
          <div><strong>Authorized By:</strong> Operations Division</div>
        </div>
      </div>

      {/* 2. KPI SUMMARY STRIP */}
      <div className="grid grid-cols-4 gap-1 sm:gap-1.5 bg-neutral-900 text-white p-1.5 rounded-lg text-center font-mono">
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">
            Total Fleet
          </span>
          <span className="text-[10px] sm:text-[11px] font-black">
            {machines.length} Units
          </span>
        </div>
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">
            Available Fleet
          </span>
          <span className="text-[10px] sm:text-[11px] font-black text-emerald-400">
            {totalAvailable} Avail
          </span>
        </div>
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">
            On Rent
          </span>
          <span className="text-[10px] sm:text-[11px] font-black text-sky-400">
            {totalRented} Rented
          </span>
        </div>
        <div>
          <span className="text-[7.5px] sm:text-[8.5px] text-neutral-400 block font-sans font-extrabold uppercase truncate">
            Total Fleet HMR
          </span>
          <span className="text-[10px] sm:text-[11px] font-black text-amber-400">
            {Math.round(totalHmr * 10) / 10} hrs
          </span>
        </div>
      </div>

      {/* 3. DETAILED MACHINES TABLE */}
      <div className="w-full overflow-x-auto custom-scrollbar print-table-wrap">
        <table className="w-full text-left border border-neutral-900 border-collapse print-table min-w-[700px] sm:min-w-0">
          <thead>
            <tr className="bg-neutral-900 text-white font-bold text-[8px] uppercase tracking-wider">
              <th className="p-0.5 border border-neutral-800 w-[3%] text-center align-middle">S.N</th>
              <th className="p-0.5 border border-neutral-800 w-[11%] font-mono align-middle whitespace-nowrap">MACHINE ID</th>
              <th className="p-1 border border-neutral-800 w-[11%] align-middle font-mono">MODEL</th>
              <th className="p-1 border border-neutral-800 w-[12%] align-middle font-mono">SERIAL NO.</th>
              <th className="p-0.5 border border-neutral-800 w-[6%] text-center align-middle">YUM</th>
              <th className="p-0.5 border border-neutral-800 w-[8%] font-mono text-center align-middle whitespace-nowrap">HMR (HRS)</th>
              <th className="p-1 border border-neutral-800 w-[18%] align-middle">ASSIGNED CLIENT</th>
              <th className="p-1 border border-neutral-800 w-[15%] align-middle">SUPERVISOR / OPERATOR</th>
              <th className="p-0.5 border border-neutral-800 w-[8%] text-center align-middle whitespace-nowrap">HEALTH</th>
              <th className="p-0.5 border border-neutral-800 w-[8%] text-center align-middle whitespace-nowrap">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-300">
            {machines.length > 0 ? (
              machines.map((m, idx) => {
                const supervisorName = m.current_supervisor?.full_name || "Unassigned";
                const operatorName = m.current_operator?.full_name || "Unassigned";
                const clientName = m.client?.company_name
                  ? `${m.client.company_name}${m.client.code ? ` (${m.client.code})` : ""}`
                  : (m.customer_name || "—");
                const location = m.client?.city
                  ? `${m.client.city}${m.client.state ? `, ${m.client.state}` : ""}`
                  : ((m as any).customer_address || (m as any).city || "");

                const isBreakdown = m.health_status === "breakdown";
                const isMaint = m.health_status === "under_maintenance";
                const isRented = m.status === "rented";

                return (
                  <tr key={m.id || idx} className="bg-white">
                    <td className="p-0.5 border border-neutral-300 text-center align-middle font-bold text-[8.5px]">
                      {idx + 1}
                    </td>
                    <td className="p-0.5 border border-neutral-300 font-mono font-bold text-neutral-900 align-middle text-[8.5px] whitespace-nowrap">
                      {m.machine_id || "—"}
                    </td>
                    <td className="p-1 border border-neutral-300 font-semibold text-neutral-900 align-middle text-[8.5px]">
                      {m.model || "—"}
                    </td>
                    <td className="p-1 border border-neutral-300 font-mono text-neutral-700 align-middle text-[8px] whitespace-nowrap">
                      {m.serial_number || "—"}
                    </td>
                    <td className="p-0.5 border border-neutral-300 text-center text-neutral-600 align-middle text-[8px] whitespace-nowrap">
                      {m.year_of_mfg || "—"}
                    </td>
                    <td className="p-0.5 border border-neutral-300 font-mono font-bold text-neutral-900 text-center align-middle text-[8.5px] whitespace-nowrap">
                      {m.hour_meter ?? 0}
                    </td>
                    <td className="p-1 border border-neutral-300 text-neutral-900 align-middle text-[8.5px] leading-tight">
                      <div className="font-bold">{clientName}</div>
                      {location && (
                        <div className="text-[7.5px] text-neutral-600 font-normal truncate max-w-[140px]">
                          {location}
                        </div>
                      )}
                    </td>
                    <td className="p-1 border border-neutral-300 text-neutral-800 align-middle text-[8px] leading-tight">
                      <div><strong className="text-neutral-500">Sup:</strong> {supervisorName}</div>
                      <div><strong className="text-neutral-500">Op:</strong> {operatorName}</div>
                    </td>
                    <td className="p-0.5 border border-neutral-300 text-center align-middle whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[7.5px] font-extrabold uppercase ${
                          isBreakdown
                            ? "bg-rose-100 text-rose-800"
                            : isMaint
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {formatHealthStatus(m.health_status)}
                      </span>
                    </td>
                    <td className="p-0.5 border border-neutral-300 text-center align-middle whitespace-nowrap">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[7.5px] font-extrabold uppercase ${
                          isRented
                            ? "bg-sky-100 text-sky-800"
                            : "bg-neutral-100 text-neutral-800"
                        }`}
                      >
                        {formatRentalStatus(m.status)}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-white">
                <td colSpan={10} className="p-3 border border-neutral-300 text-center text-neutral-500 font-medium">
                  No machine inventory records match the selected filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. VERIFICATION SIGNATURES SECTION */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-3 border-t border-neutral-300 text-center text-[9.5px] text-neutral-600 print-signature-block">
        {/* Column 1: Fleet Supervisor */}
        <div className="flex flex-col items-center space-y-0.5">
          <span className="font-extrabold text-neutral-900 text-[9.5px] uppercase">Prepared By</span>
          <div className="w-28 sm:w-36 border-b border-neutral-400 mb-0.5 h-6 flex items-end justify-center font-sans text-neutral-900 text-[9.5px] font-bold">
            Fleet Supervisor
          </div>
          <span className="font-bold text-neutral-800 text-[8.5px]">
            (Machinery Operations)
          </span>
          <div className="flex items-center justify-between w-full max-w-[135px] text-[8px] text-neutral-700 pt-1 font-mono">
            <span>Sign: _______</span>
            <span>Date: _______</span>
          </div>
        </div>

        {/* Column 2: Site Sign-Off */}
        <div className="flex flex-col items-center space-y-0.5">
          <span className="font-extrabold text-neutral-900 text-[9.5px] uppercase">Site Verification</span>
          <div className="w-28 sm:w-36 border-b border-neutral-400 mb-0.5 h-6 flex items-end justify-center font-sans text-neutral-900 text-[9.5px] font-bold">
            Client Representative
          </div>
          <span className="font-bold text-neutral-800 text-[8.5px]">
            (Equipment Acceptance)
          </span>
          <div className="flex items-center justify-between w-full max-w-[135px] text-[8px] text-neutral-700 pt-1 font-mono">
            <span>Sign: _______</span>
            <span>Date: _______</span>
          </div>
        </div>

        {/* Column 3: Approved By */}
        <div className="flex flex-col items-center space-y-0.5">
          <span className="font-extrabold text-neutral-900 text-[9.5px] uppercase">Verified & Approved By</span>
          <div className="w-28 sm:w-36 border-b border-neutral-400 mb-0.5 h-6 flex items-end justify-center font-sans text-neutral-900 text-[9.5px] font-extrabold tracking-wider">
            REACH INTERNATIONAL
          </div>
          <span className="font-bold text-neutral-800 text-[8.5px]">
            (Service & Fleet Manager)
          </span>
          <div className="flex items-center justify-between w-full max-w-[135px] text-[8px] text-neutral-700 pt-1 font-mono">
            <span>Sign: _______</span>
            <span>Date: _______</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrintableMachineDirectoryModal({
  open,
  onClose,
  machines = [],
  selectedIds = [],
  title = "Machine Fleet Directory PDF Report",
}: PrintableMachineDirectoryModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [useSelectionOnly, setUseSelectionOnly] = useState<boolean>(selectedIds.length > 0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selectedIds.length > 0) {
      setUseSelectionOnly(true);
    } else {
      setUseSelectionOnly(false);
    }
  }, [selectedIds]);

  // Base pool of machines: selected machines or all machines
  const baseMachines = useSelectionOnly && selectedIds.length > 0
    ? machines.filter((m) => selectedIds.includes(m.id))
    : machines;

  // Apply tab filter
  const filteredMachines = baseMachines.filter((m) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "available") return m.status === "available";
    if (activeFilter === "rented") return m.status === "rented";
    if (activeFilter === "breakdown") return m.health_status === "breakdown";
    if (activeFilter === "under_maintenance") return m.health_status === "under_maintenance";
    return true;
  });

  // Calculate KPIs
  let totalAvailable = 0;
  let totalRented = 0;
  let totalBreakdowns = 0;
  let totalMaintenance = 0;
  let totalHmr = 0;

  filteredMachines.forEach((m) => {
    if (m.status === "rented") totalRented++;
    else totalAvailable++;

    if (m.health_status === "breakdown") totalBreakdowns++;
    if (m.health_status === "under_maintenance") totalMaintenance++;
    totalHmr += Number(m.hour_meter) || 0;
  });

  const handlePrint = () => {
    const originalTitle = document.title;
    const prefix = useSelectionOnly ? `Machines-Selected-${filteredMachines.length}` : "Machine-Fleet-Directory";
    const pdfFileName = buildMachinesExportFileName(prefix, "pdf");
    document.title = pdfFileName.replace(/\.pdf$/, "");
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleExportExcel = () => {
    const prefix = useSelectionOnly ? `Machines-Selected-${filteredMachines.length}` : "Machine-Directory";
    exportMachinesToExcel(filteredMachines, prefix);
  };

  const handleExportCSV = () => {
    const prefix = useSelectionOnly ? `Machines-Selected-${filteredMachines.length}` : "Machine-Directory";
    exportMachinesToCSV(filteredMachines, prefix);
  };

  const reportProps: ReportContentProps = {
    machines: filteredMachines,
    totalAvailable,
    totalRented,
    totalBreakdowns,
    totalMaintenance,
    totalHmr,
    activeFilter,
    isSelectionOnly: useSelectionOnly && selectedIds.length > 0,
  };

  return (
    <>
      {/* Screen & Print Media Stylesheet */}
      <style>{`
        @media screen {
          #printable-machines-document {
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
          body > *:not(#printable-machines-document) {
            display: none !important;
          }
          #printable-machines-document,
          #printable-machines-document * {
            visibility: visible !important;
          }
          #printable-machines-document {
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

      {/* Render Portal to document.body for clean print rendering */}
      {mounted && open && createPortal(
        <div id="printable-machines-document">
          <MachineDirectoryReportContent {...reportProps} />
        </div>,
        document.body
      )}

      {/* Modal for Interactive Preview */}
      <Modal
        open={open}
        onClose={onClose}
        title={
          <div className="flex items-center justify-between w-full pr-6">
            <span className="text-base font-extrabold text-[var(--color-ink)]">
              {title}
            </span>
          </div>
        }
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full pt-2 no-print">
            <div className="text-xs text-[var(--color-mute)] font-medium">
              Showing <strong>{filteredMachines.length}</strong> machines{" "}
              {useSelectionOnly && selectedIds.length > 0 ? (
                <span className="text-sky-600 font-semibold">(Selected Subset)</span>
              ) : (
                "(Full Directory)"
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-2 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold text-xs hover:bg-sky-500/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Export CSV (.csv)
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Export Excel (.xlsx)
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 max-w-full">
          {/* Controls Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-2.5 sm:p-3.5 max-w-[210mm] mx-auto w-full rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] no-print">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-ink)] shrink-0">
                <SlidersHorizontal className="h-4 w-4 text-sky-500" />
                <span>Filter Report:</span>
              </div>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUseSelectionOnly(!useSelectionOnly)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                    useSelectionOnly
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                      : "bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] border-[var(--color-hairline)]"
                  }`}
                >
                  {useSelectionOnly ? `Selected (${selectedIds.length})` : "Show All"}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar flex-nowrap w-full sm:w-auto p-1 bg-[var(--color-canvas-elevated)] rounded-lg border border-[var(--color-hairline)]">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveFilter(tab.value)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeFilter === tab.value
                      ? "bg-sky-600 text-white shadow-2xs"
                      : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div id="printable-machines-document-preview" className="max-w-full overflow-x-auto custom-scrollbar">
            <MachineDirectoryReportContent {...reportProps} />
          </div>
        </div>
      </Modal>
    </>
  );
}
