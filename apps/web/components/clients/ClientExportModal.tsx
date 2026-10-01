"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, X } from "lucide-react";
import type { ClientDirectoryFilter } from "@reachinternational/utils";
import { getClientExportDataAction } from "@/app/actions/client-export";
import {
  exportClientsToExcel,
  exportClientsToCSV,
  exportClientsToPDF,
} from "@/lib/utils/clients-export";

interface ClientExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilter: ClientDirectoryFilter;
}

export function ClientExportModal({ isOpen, onClose, currentFilter }: ClientExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<"current" | "all" | "active">("current");
  const [format, setFormat] = useState<"xlsx" | "csv" | "pdf">("xlsx");

  if (!isOpen) return null;

  async function handleExport() {
    setIsExporting(true);
    try {
      const filterToApply: ClientDirectoryFilter =
        exportType === "all"
          ? { status: "all" }
          : exportType === "active"
          ? { status: "active" }
          : currentFilter;

      const records = await getClientExportDataAction(filterToApply);

      if (!records || records.length === 0) {
        alert("No client records found matching the selected export filter.");
        setIsExporting(false);
        return;
      }

      const scopeName =
        exportType === "all"
          ? "All Master Clients"
          : exportType === "active"
          ? "Active Clients"
          : "Filtered Results";

      if (format === "xlsx") {
        exportClientsToExcel(records, "Client-Directory");
      } else if (format === "csv") {
        exportClientsToCSV(records, "Client-Directory");
      } else if (format === "pdf") {
        exportClientsToPDF(records, "Client-Directory", scopeName);
      }

      setIsExporting(false);
      onClose();
    } catch (err: any) {
      console.error("Export failed:", err);
      alert(err.message || "Failed to generate export file.");
      setIsExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--color-ink)]">Export Client Directory</h3>
              <p className="text-xs text-[var(--color-mute)]">Download Excel, CSV or PDF report</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="rounded-lg p-1.5 text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="space-y-1.5 text-xs">
          <p className="font-semibold text-[var(--color-ink)]">Select Format:</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setFormat("xlsx")}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                format === "xlsx"
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20"
                  : "border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat("csv")}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                format === "csv"
                  ? "bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/20"
                  : "border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>CSV (.csv)</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat("pdf")}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                format === "pdf"
                  ? "bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/20"
                  : "border-[var(--color-hairline)] text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>PDF (.pdf)</span>
            </button>
          </div>
        </div>

        {/* Export Scope Radio Selection */}
        <div className="space-y-2.5 text-xs">
          <p className="font-semibold text-[var(--color-ink)]">Select Records to Export:</p>

          <label className="flex items-center gap-2.5 rounded-lg border border-[var(--color-hairline)] p-2.5 hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer transition-colors">
            <input
              type="radio"
              name="exportType"
              checked={exportType === "current"}
              onChange={() => setExportType("current")}
              className="accent-sky-600 cursor-pointer"
            />
            <div>
              <span className="font-semibold text-[var(--color-ink)] block">
                Current Filtered Results
              </span>
              <span className="text-[11px] text-[var(--color-mute)]">
                Exports all records matching your active search and status filter
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 rounded-lg border border-[var(--color-hairline)] p-2.5 hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer transition-colors">
            <input
              type="radio"
              name="exportType"
              checked={exportType === "active"}
              onChange={() => setExportType("active")}
              className="accent-sky-600 cursor-pointer"
            />
            <div>
              <span className="font-semibold text-[var(--color-ink)] block">
                Active Clients Only
              </span>
              <span className="text-[11px] text-[var(--color-mute)]">
                Exports all active clients across the entire organization
              </span>
            </div>
          </label>

          <label className="flex items-center gap-2.5 rounded-lg border border-[var(--color-hairline)] p-2.5 hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer transition-colors">
            <input
              type="radio"
              name="exportType"
              checked={exportType === "all"}
              onChange={() => setExportType("all")}
              className="accent-sky-600 cursor-pointer"
            />
            <div>
              <span className="font-semibold text-[var(--color-ink)] block">
                Complete Directory Master
              </span>
              <span className="text-[11px] text-[var(--color-mute)]">
                Exports all active, inactive, and historical clients
              </span>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-hairline)] pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-4 py-2 text-xs font-medium text-[var(--color-body)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-ink)] px-4 py-2 text-xs font-semibold text-[var(--color-canvas)] hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Export...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
