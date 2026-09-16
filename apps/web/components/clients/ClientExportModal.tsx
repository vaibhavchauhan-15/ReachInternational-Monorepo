"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, Loader2, X, CheckCircle2 } from "lucide-react";
import type { ClientDirectoryFilter } from "@reachinternational/utils";
import { getClientExportDataAction } from "@/app/actions/client-export";

interface ClientExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilter: ClientDirectoryFilter;
}

export function ClientExportModal({ isOpen, onClose, currentFilter }: ClientExportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<"current" | "all" | "active">("current");

  if (!isOpen) return null;

  async function handleDownloadCsv() {
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

      // Convert records to CSV format with Excel UTF-8 BOM
      const headers = [
        "Client Code",
        "Company Name",
        "Contact Person",
        "Phone",
        "GSTIN",
        "PAN",
        "Site Address",
        "City",
        "District",
        "State",
        "Pincode",
        "Separate Billing",
        "Billing Address",
        "Status",
        "Registered On",
      ];

      const csvRows = [headers.join(",")];

      records.forEach((row) => {
        const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;
        const values = [
          escapeCsv(row.code),
          escapeCsv(row.company_name),
          escapeCsv(row.contact_person),
          escapeCsv(row.phone),
          escapeCsv(row.gstin),
          escapeCsv(row.pan_number),
          escapeCsv(row.site_address),
          escapeCsv(row.city),
          escapeCsv(row.district),
          escapeCsv(row.state),
          escapeCsv(row.pincode),
          escapeCsv(row.is_billing_different ? "Yes" : "No"),
          escapeCsv(row.billing_address),
          escapeCsv(row.status),
          escapeCsv(row.created_at),
        ];
        csvRows.push(values.join(","));
      });

      const csvContent = "\uFEFF" + csvRows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute("download", `ReachInternational_Clients_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

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
              <p className="text-xs text-[var(--color-mute)]">Download structured CSV/Excel report</p>
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
            onClick={handleDownloadCsv}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Export...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
