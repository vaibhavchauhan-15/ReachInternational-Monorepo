"use client";

import { useState, useTransition, useRef } from "react";
import { Modal, Button, useToast } from "@/components/ui";
import { importMachinesFromExcel } from "@/app/actions/machine-import";
import { getSampleExcelTemplate } from "@/lib/utils/excel-template";
import type { BulkImportResult } from "@/app/actions/machine-import";
import {
  AnimatedUpload,
  AnimatedDownload,
  AnimatedCheckCircle,
  AnimatedXCircle,
  AnimatedAlertTriangle,
  AnimatedFileText,
} from "@/components/ui/animated-icons";

interface MachineImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MachineImportModal({ open, onClose, onSuccess }: MachineImportModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const validExtensions = [".xlsx", ".xls"];
    const hasValidExtension = validExtensions.some((ext) => file.name.endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExtension) {
      toast("error", "Invalid file type", "Please upload an Excel file (.xlsx or .xls)");
      return;
    }

    const formData = new FormData();
    formData.append("excel_file", file);

    startTransition(async () => {
      try {
        const importResult = await importMachinesFromExcel(formData);
        setResult(importResult);

        if (importResult.failed === 0) {
          toast("success", `Successfully imported ${importResult.success} machines`);
        } else if (importResult.success > 0) {
          toast(
            "warning",
            `Imported ${importResult.success} machines, ${importResult.failed} failed`,
            "Check the results below for details"
          );
        } else {
          toast("error", "Import failed", "All rows failed to import. Check the errors below.");
        }

        onSuccess();
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Failed to import file";
        toast("error", "Import error", errorMsg);
        setResult({
          success: 0,
          failed: 0,
          errors: [{ row: 0, reason: errorMsg }],
        });
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFileChange(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadSample = () => {
    const blob = getSampleExcelTemplate();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `machine_import_template_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast("success", "Sample template downloaded");
  };

  const handleReset = () => {
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Bulk Import Machines"
      description="Upload an Excel file to import multiple machines at once. Machine codes will be auto-generated."
      size="lg"
    >
      <div className="flex flex-col gap-5">
        {/* Download Sample Button */}
        <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)]">
          <div className="flex items-center gap-2">
            <AnimatedFileText size={16} className="text-[var(--color-link)]" />
            <span className="text-xs font-medium text-[var(--color-ink)]">
              Need a template? Download the sample Excel file with correct column headers.
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownloadSample}
            disabled={isPending}
            className="flex items-center gap-1.5"
          >
            <AnimatedDownload size={14} />
            Sample Template
          </Button>
        </div>

        {/* Upload Area */}
        {!result && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-[var(--radius-md)] border-2 border-dashed transition-all cursor-pointer ${
              dragActive
                ? "border-[var(--color-link)] bg-[var(--color-link-soft)]/10"
                : "border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-mute)]"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleInputChange}
              className="hidden"
              disabled={isPending}
            />

            <div className={`p-3 rounded-full ${dragActive ? "bg-[var(--color-link-soft)]" : "bg-[var(--color-hairline-soft-surface)]"}`}>
              <AnimatedUpload size={24} className={dragActive ? "text-[var(--color-link)]" : "text-[var(--color-mute)]"} />
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {dragActive ? "Drop your Excel file here" : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-[var(--color-mute)] mt-1">
                Supported formats: .xlsx, .xls
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isPending && !result && (
          <div className="flex flex-col items-center justify-center gap-3 py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-ink)]"></div>
            <p className="text-sm text-[var(--color-mute)]">Processing your Excel file...</p>
          </div>
        )}

        {/* Results */}
        {result && !isPending && (
          <div className="flex flex-col gap-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--color-success-soft)] border border-[var(--color-success-border)]">
                <div className="flex items-center gap-2">
                  <AnimatedCheckCircle size={16} className="text-[var(--color-success-deep)]" />
                  <span className="text-xs font-medium text-[var(--color-ink)]">Success</span>
                </div>
                <p className="text-2xl font-bold text-[var(--color-success-deep)] mt-1">{result.success}</p>
              </div>

              <div className="p-3 rounded-[var(--radius-sm)] bg-[rgba(238,0,0,0.06)] border border-red-200 dark:border-red-900/50">
                <div className="flex items-center gap-2">
                  <AnimatedXCircle size={16} className="text-[var(--color-error-deep)]" />
                  <span className="text-xs font-medium text-[var(--color-ink)]">Failed</span>
                </div>
                <p className="text-2xl font-bold text-[var(--color-error-deep)] mt-1">{result.failed}</p>
              </div>

              <div className="p-3 rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)]">
                <div className="flex items-center gap-2">
                  <AnimatedAlertTriangle size={16} className="text-[var(--color-warning-deep)]" />
                  <span className="text-xs font-medium text-[var(--color-ink)]">Total Rows</span>
                </div>
                <p className="text-2xl font-bold text-[var(--color-ink)] mt-1">{result.success + result.failed}</p>
              </div>
            </div>

            {/* Error List */}
            {result.errors.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas)]">
                <div className="p-3 bg-[var(--color-hairline-soft-surface)] border-b border-[var(--color-hairline)] sticky top-0">
                  <p className="text-xs font-semibold text-[var(--color-ink)]">Import Errors</p>
                </div>
                <div className="divide-y divide-[var(--color-hairline)]">
                  {result.errors.map((error, idx) => (
                    <div key={idx} className="p-3 flex items-start gap-2">
                      <AnimatedAlertTriangle size={16} className="text-[var(--color-warning-deep)] flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--color-ink)]">
                          Row {error.row}
                        </p>
                        <p className="text-xs text-[var(--color-body)] mt-0.5">{error.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-hairline)]">
              <Button type="button" variant="secondary" onClick={handleReset}>
                Import Another File
              </Button>
              <Button type="button" variant="primary" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Info Text */}
        {!result && !isPending && (
          <div className="text-xs text-[var(--color-mute)] space-y-1">
            <p>• Machine codes will be auto-generated (format: MCH-XXXXXX)</p>
            <p>• Required columns: Machine Name, Customer Name, Customer Mobile, City, State</p>
            <p>• Assigned Engineer column accepts either engineer name or engineer email ID</p>
            <p>• Mobile numbers must be valid 10-digit Indian numbers</p>
          </div>
        )}
      </div>
    </Modal>
  );
}