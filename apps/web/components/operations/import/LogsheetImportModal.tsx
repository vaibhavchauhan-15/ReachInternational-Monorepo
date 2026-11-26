"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Modal,
  Button,
  MachineSelect,
  ConfirmationDialog,
  Spinner,
  useToast,
  type MachineSelectItem,
} from "@/components/ui";
import {
  Download,
  FileSpreadsheet,
  UploadCloud,
  RefreshCw,
  CheckCircle2,
  XCircle,
  History,
} from "lucide-react";
import {
  LOGSHEET_IMPORT_MAX_FILE_BYTES,
  LOGSHEET_IMPORT_MAX_ROWS,
  LOGSHEET_IMPORT_TEMPLATE_VERSION,
} from "@reachinternational/validation";
import {
  validateLogsheetImportAction,
  importLogsheetAction,
  getLogsheetImportMachinesAction,
  getLogsheetImportHistoryAction,
} from "@/app/actions/logsheet-import";
import type {
  LogsheetImportHistoryItem,
  LogsheetImportPreview,
  LogsheetImportResult,
} from "@/lib/server/logsheet-import/types";
import {
  LogsheetImportPreviewTable,
  type LogsheetPreviewFilter,
} from "./LogsheetImportPreviewTable";

type ImportStep = "machine" | "template" | "upload" | "review" | "result";

const STEPS: Array<{ id: ImportStep; label: string }> = [
  { id: "machine", label: "Machine" },
  { id: "template", label: "Template" },
  { id: "upload", label: "Upload" },
  { id: "review", label: "Review" },
  { id: "result", label: "Import" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface LogsheetImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

/**
 * Admin-only bulk machine logsheet (Excel) import wizard:
 * select machine → download template → upload workbook → validate & preview →
 * confirm → atomic import with verified commit and audit trail.
 */
export function LogsheetImportModal({ open, onClose, onImported }: LogsheetImportModalProps) {
  const { toast } = useToast();

  const [step, setStep] = useState<ImportStep>("machine");
  const [machines, setMachines] = useState<MachineSelectItem[] | null>(null);
  const machinesLoading = machines === null;
  const [machineId, setMachineId] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [validating, setValidating] = useState(false);
  const [preview, setPreview] = useState<LogsheetImportPreview | null>(null);
  const [filter, setFilter] = useState<LogsheetPreviewFilter>("all");
  const [importToken, setImportToken] = useState<string | null>(null);
  const [acknowledgeDuplicates, setAcknowledgeDuplicates] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isImporting, startImportTransition] = useTransition();
  const [result, setResult] = useState<LogsheetImportResult | null>(null);
  const [history, setHistory] = useState<LogsheetImportHistoryItem[] | null>(null);

  const selectedMachine = useMemo(
    () => (machines ?? []).find((m) => m.id === machineId) || null,
    [machines, machineId]
  );

  // Closing resets the wizard — every open starts a fresh session (event-handler
  // state updates; no effect-based state derivation).
  const handleClose = useCallback(() => {
    if (isImporting || validating) return;
    setStep("machine");
    setMachineId("");
    setFile(null);
    setPreview(null);
    setResult(null);
    setHistory(null);
    setImportToken(null);
    setAcknowledgeDuplicates(false);
    setFilter("all");
    setMachines(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }, [isImporting, validating, onClose]);

  // Load machine options (admin-only action); machines === null means not loaded yet
  useEffect(() => {
    if (!open || machines !== null) return;
    let cancelled = false;
    getLogsheetImportMachinesAction()
      .then((options) => {
        if (!cancelled) setMachines(options as MachineSelectItem[]);
      })
      .catch(() => {
        if (!cancelled) {
          setMachines([]);
          toast("error", "Failed to load machines", "Please close and reopen the importer.");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, machines]);

  const acceptFile = useCallback(
    (candidate: File | undefined) => {
      if (!candidate) return;
      if (!candidate.name.toLowerCase().endsWith(".xlsx")) {
        toast("error", "Unsupported file type", "Only .xlsx workbooks generated from the official template are accepted.");
        return;
      }
      if (candidate.size > LOGSHEET_IMPORT_MAX_FILE_BYTES) {
        toast("error", "File too large", `The file exceeds the ${Math.round(LOGSHEET_IMPORT_MAX_FILE_BYTES / (1024 * 1024))}MB upload limit.`);
        return;
      }
      if (candidate.size === 0) {
        toast("error", "Empty file", "The uploaded file is empty.");
        return;
      }
      setFile(candidate);
      setPreview(null);
      setResult(null);
      setImportToken(null);
      setAcknowledgeDuplicates(false);
    },
    [toast]
  );

  const handleValidate = useCallback(async () => {
    if (!machineId) {
      toast("error", "Select a machine", "Please select the machine these logs belong to.");
      return;
    }
    if (!file) {
      toast("error", "Select a file", "Please upload the completed Excel workbook.");
      return;
    }
    setValidating(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("machine_id", machineId);
      formData.append("excel_file", file);
      const nextPreview = await validateLogsheetImportAction(formData);
      setPreview(nextPreview);
      setFilter("all");
      if (nextPreview.ok && !nextPreview.blocked) {
        setImportToken(crypto.randomUUID());
        setStep("review");
        toast(
          nextPreview.summary.duplicateRows > 0 || nextPreview.summary.warningRows > 0
            ? "warning"
            : "success",
          "Validation complete",
          `${nextPreview.summary.readyRows} of ${nextPreview.summary.totalRows} rows are ready to import.`
        );
      } else if (nextPreview.ok && nextPreview.blocked) {
        setStep("review");
        toast("error", "Validation found blocking issues", "Correct the highlighted rows and upload the file again.");
      } else {
        toast("error", "Validation failed", nextPreview.error || "The workbook could not be validated.");
      }
    } catch (err) {
      toast("error", "Validation failed", err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setValidating(false);
    }
  }, [machineId, file, toast]);

  const handleImport = useCallback(async () => {
    if (!machineId || !file || !importToken || !preview) return;
    setConfirmOpen(false);
    startImportTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("machine_id", machineId);
        formData.append("import_token", importToken);
        formData.append("expected_checksum", preview.fileChecksum);
        formData.append("excel_file", file);
        const importResult = await importLogsheetAction(formData);
        setResult(importResult);
        setStep("result");
        if (importResult.success) {
          toast(
            "success",
            importResult.alreadyImported
              ? "Import was already completed"
              : `Imported ${importResult.importedRows} logsheet records`,
            `Reference ${importResult.importId || "—"}`
          );
          onImported?.();
        } else {
          toast("error", "Import failed", importResult.error || "No records were inserted.");
        }
        getLogsheetImportHistoryAction(machineId)
          .then(setHistory)
          .catch(() => setHistory([]));
      } catch (err) {
        toast("error", "Import failed", err instanceof Error ? err.message : "Unexpected error.");
      }
    });
  }, [machineId, file, importToken, preview, toast, onImported]);

  const handleDownloadTemplate = useCallback(() => {
    const link = document.createElement("a");
    link.href = "/api/operations/logsheet-import/template";
    link.download = `reach-machine-logsheet-import-template-v${LOGSHEET_IMPORT_TEMPLATE_VERSION}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", "Template download started", "Fill the \"Logsheet Data\" sheet and delete the example rows.");
  }, [toast]);

  const handleDownloadErrorReport = useCallback(() => {
    if (!preview) return;
    const lines = [
      ["Excel Row", "Column", "Original Value", "Severity", "Issue Code", "Reason", "Expected"].join(","),
    ];
    for (const row of preview.rows) {
      for (const issue of row.issues) {
        lines.push(
          [
            issue.rowNumber,
            issue.columnLabel,
            `"${(issue.value || "").replace(/"/g, '""')}"`,
            issue.severity,
            issue.code,
            `"${issue.message.replace(/"/g, '""')}"`,
            `"${issue.expected.replace(/"/g, '""')}"`,
          ].join(",")
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `logsheet-validation-report-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast("success", "Validation report downloaded");
  }, [preview, toast]);

  const summary = preview?.summary;
  const canContinueToUpload = Boolean(machineId);
  const showDuplicateAck = (summary?.duplicateRows ?? 0) > 0;

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Import Logsheet (Excel)"
        description="Bulk back-fill historical machine operation records from a validated Excel workbook. Admin only."
        size="xl"
        preventClose={isImporting || validating}
      >
        <div className="flex flex-col gap-5">
          {/* Stepper */}
          <ol className="flex items-center gap-1.5 flex-wrap" aria-label="Import progress">
            {STEPS.map((s, idx) => {
              const state = idx < stepIndex ? "done" : idx === stepIndex ? "current" : "todo";
              return (
                <li key={s.id} className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full text-[11px] font-semibold border ${
                      state === "current"
                        ? "bg-[#0284c7] text-white border-[#0284c7]"
                        : state === "done"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] border-[var(--color-hairline)]"
                    }`}
                  >
                    {state === "done" ? "✓" : idx + 1}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      state === "current" ? "text-[var(--color-ink)]" : "text-[var(--color-mute)]"
                    }`}
                  >
                    {s.label}
                  </span>
                  {idx < STEPS.length - 1 && <span className="w-4 h-px bg-[var(--color-hairline)]" aria-hidden />}
                </li>
              );
            })}
          </ol>

          {/* STEP: MACHINE */}
          {step === "machine" && (
            <div className="flex flex-col gap-4">
              <div className="p-3 rounded-[var(--radius-sm)] border border-sky-500/20 bg-sky-500/[0.06] text-xs text-[var(--color-ink)]">
                Select the machine these historical logs belong to. The selected machine is applied server-side to
                every imported record — the spreadsheet can never override it.
              </div>
              {machinesLoading ? (
                <div className="flex items-center gap-2 text-sm text-[var(--color-mute)] py-8 justify-center">
                  <Spinner /> Loading machines…
                </div>
              ) : (
                <MachineSelect
                  machines={machines ?? []}
                  value={machineId}
                  onChange={(id) => setMachineId(id)}
                  label="Machine"
                  placeholder="Search by machine code, name or model…"
                  required
                />
              )}
            </div>
          )}

          {/* STEP: TEMPLATE */}
          {step === "template" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet size={20} className="text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--color-ink)]">
                      Standardized Import Template
                    </div>
                    <div className="text-xs text-[var(--color-mute)]">
                      Template v{LOGSHEET_IMPORT_TEMPLATE_VERSION} · Logsheet Data + Instructions + Data Dictionary
                    </div>
                    {selectedMachine && (
                      <div className="text-xs text-[var(--color-mute)] mt-0.5">
                        For machine:{" "}
                        <strong className="text-[var(--color-ink)]">
                          {selectedMachine.machine_id || selectedMachine.id}
                          {selectedMachine.machine_name || selectedMachine.model
                            ? ` — ${selectedMachine.machine_name || selectedMachine.model}`
                            : ""}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={handleDownloadTemplate}
                  icon={<Download size={14} />}
                  className="h-9 px-3.5 font-semibold text-xs sm:text-sm whitespace-nowrap"
                >
                  Download Excel Template (.xlsx)
                </Button>
              </div>

              <ul className="flex flex-col gap-1.5 text-xs text-[var(--color-mute)] list-disc pl-5">
                <li>Fill the <strong className="text-[var(--color-ink)]">Logsheet Data</strong> sheet only — keep all worksheets and column headers unchanged.</li>
                <li>Delete the clearly marked <strong className="text-[var(--color-ink)]">example rows</strong> before uploading.</li>
                <li>Mandatory fields: Log Date, Operator Employee ID (or exact Name), Start Time, End Time, Start HMR, End HMR.</li>
                <li>Maximum {LOGSHEET_IMPORT_MAX_ROWS} data rows · dates must not be in the future · historical dates are welcome.</li>
                <li>Every row is validated before import — invalid data can never enter the system silently.</li>
              </ul>
            </div>
          )}

          {/* STEP: UPLOAD */}
          {step === "upload" && (
            <div className="flex flex-col gap-4">
              <div
                className={`relative rounded-[var(--radius-sm)] border-2 border-dashed p-8 text-center transition-colors ${
                  dragActive
                    ? "border-[#0284c7] bg-sky-500/[0.06]"
                    : "border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]"
                }`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  acceptFile(e.dataTransfer.files?.[0]);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  aria-label="Upload completed logsheet workbook"
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileSpreadsheet size={32} className="text-emerald-500" />
                    <div className="text-sm font-semibold text-[var(--color-ink)] break-all">{file.name}</div>
                    <div className="text-xs text-[var(--color-mute)]">{formatBytes(file.size)}</div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      icon={<RefreshCw size={14} />}
                      className="h-9 px-3.5 text-xs font-semibold"
                      disabled={validating || isImporting}
                    >
                      Replace File
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <UploadCloud size={32} className="text-[var(--color-mute)]" />
                    <div className="text-sm font-semibold text-[var(--color-ink)]">
                      Drag &amp; drop the completed workbook, or browse
                    </div>
                    <div className="text-xs text-[var(--color-mute)]">
                      .xlsx only · up to {Math.round(LOGSHEET_IMPORT_MAX_FILE_BYTES / (1024 * 1024))}MB · {LOGSHEET_IMPORT_MAX_ROWS} rows max
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-3.5 font-semibold text-xs sm:text-sm"
                    >
                      Choose File
                    </Button>
                  </div>
                )}
              </div>

              {validating && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-mute)] justify-center" role="status">
                  <Spinner /> Validating every row — structural, field, business rules and duplicates…
                </div>
              )}
            </div>
          )}

          {/* STEP: REVIEW */}
          {step === "review" && preview && summary && (
            <div className="flex flex-col gap-4">
              {/* Summary chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: "Total Rows", value: summary.totalRows, tone: "text-[var(--color-ink)]" },
                  { label: "Ready", value: summary.readyRows, tone: "text-emerald-600" },
                  { label: "Invalid", value: summary.invalidRows, tone: "text-rose-600" },
                  { label: "Duplicates", value: summary.duplicateRows, tone: "text-sky-600" },
                  { label: "Warnings", value: summary.warningRows, tone: "text-amber-600" },
                  { label: "Needs Review", value: summary.reviewRows, tone: "text-orange-600" },
                ].map((chip) => (
                  <div
                    key={chip.label}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-3 py-2"
                  >
                    <div className="text-[10px] uppercase font-semibold text-[var(--color-mute)]">{chip.label}</div>
                    <div className={`text-lg font-extrabold ${chip.tone}`}>{chip.value}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-mute)]">
                <span>Machine: <strong className="text-[var(--color-ink)]">{preview.machineLabel}</strong></span>
                {summary.dateRangeStart && (
                  <span>
                    Date range:{" "}
                    <strong className="text-[var(--color-ink)]">
                      {summary.dateRangeStart} → {summary.dateRangeEnd}
                    </strong>
                  </span>
                )}
                <span>
                  Total running hours (ready rows):{" "}
                  <strong className="text-[var(--color-ink)]">{summary.totalRunningHours.toFixed(2)}h</strong>
                </span>
                <span>Template v{preview.templateVersion}</span>
              </div>

              {preview.structuralIssues.length > 0 && (
                <div className="rounded-[var(--radius-sm)] border border-amber-500/25 bg-amber-500/[0.06] p-3">
                  <div className="text-xs font-semibold text-amber-700 mb-1">File-level notices</div>
                  <ul className="flex flex-col gap-1">
                    {preview.structuralIssues.map((issue, idx) => (
                      <li key={idx} className="text-[11px] text-[var(--color-ink)]">
                        [{issue.severity === "error" ? "ERROR" : "WARN"}] {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.blocked && (
                <div className="rounded-[var(--radius-sm)] border border-rose-500/25 bg-rose-500/[0.06] p-3 flex items-start gap-2">
                  <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-[var(--color-ink)]">
                    The import is blocked because some rows have blocking issues. Correct or remove those rows in the
                    Excel file and upload it again — nothing has been inserted into the database.
                  </div>
                </div>
              )}

              <LogsheetImportPreviewTable
                rows={preview.rows}
                filter={filter}
                onFilterChange={setFilter}
                counts={{
                  all: summary.totalRows,
                  valid: summary.validRows,
                  warning: summary.warningRows,
                  invalid: summary.invalidRows,
                  duplicate: summary.duplicateRows,
                  review: summary.reviewRows,
                }}
              />
            </div>
          )}

          {/* STEP: RESULT */}
          {step === "result" && result && (
            <div className="flex flex-col gap-4">
              <div
                className={`rounded-[var(--radius-sm)] border p-4 flex items-start gap-3 ${
                  result.success
                    ? "border-emerald-500/25 bg-emerald-500/[0.06]"
                    : "border-rose-500/25 bg-rose-500/[0.06]"
                }`}
              >
                {result.success ? (
                  <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                ) : (
                  <XCircle size={22} className="text-rose-600 shrink-0" />
                )}
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="text-sm font-bold text-[var(--color-ink)]">
                    {result.success
                      ? result.alreadyImported
                        ? "This import was already completed — no records were double-inserted"
                        : `Successfully imported ${result.importedRows} logsheet records`
                      : "Import failed — no records were published"}
                  </div>
                  {result.error && <div className="text-xs text-rose-700">{result.error}</div>}
                  {result.success && (
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs mt-1">
                      <div>
                        <dt className="text-[var(--color-mute)]">Import reference</dt>
                        <dd className="font-mono font-semibold text-[var(--color-ink)]">{result.importId || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-mute)]">Machine</dt>
                        <dd className="font-semibold text-[var(--color-ink)]">{result.machineLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-mute)]">File</dt>
                        <dd className="font-semibold text-[var(--color-ink)] break-all">{result.filename}</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-mute)]">Records processed</dt>
                        <dd className="font-semibold text-[var(--color-ink)]">
                          {result.importedRows} imported · {result.skippedDuplicates} duplicates skipped · {result.rejectedRows} rejected
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-mute)]">Total running hours</dt>
                        <dd className="font-semibold text-[var(--color-ink)]">{result.totalRunningHours.toFixed(2)}h</dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-mute)]">Processing duration</dt>
                        <dd className="font-semibold text-[var(--color-ink)]">{(result.durationMs / 1000).toFixed(1)}s</dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>

              {/* Import history */}
              <div className="rounded-[var(--radius-sm)] border border-[var(--color-hairline)]">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-hairline)]">
                  <History size={14} className="text-[var(--color-mute)]" />
                  <span className="text-xs font-semibold text-[var(--color-ink)]">Import History</span>
                </div>
                {history === null ? (
                  <div className="flex items-center gap-2 px-3 py-4 text-xs text-[var(--color-mute)]">
                    <Spinner /> Loading history…
                  </div>
                ) : history.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-[var(--color-mute)]">No imports recorded yet.</div>
                ) : (
                  <ul className="divide-y divide-[var(--color-hairline)]">
                    {history.map((item) => (
                      <li key={item.id} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-[var(--color-ink)] truncate">
                            {item.machineLabel} · {item.importedRows} rows
                          </div>
                          <div className="text-[var(--color-mute)] truncate">
                            {item.adminName} · {new Date(item.createdAt).toLocaleString()} · {item.filename || "—"}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-[var(--color-mute)] shrink-0">
                          {item.id.slice(0, 8)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 mt-6">
          <div className="flex items-center gap-2">
            {step !== "machine" && step !== "result" && (
              <Button
                variant="ghost"
                onClick={() => setStep(step === "review" ? "upload" : step === "upload" ? "template" : "machine")}
                disabled={validating || isImporting}
                className="h-10 px-4 text-xs font-semibold"
              >
                Back
              </Button>
            )}
            {step === "review" && (
              <Button
                variant="ghost"
                onClick={handleDownloadErrorReport}
                icon={<Download size={14} />}
                className="h-10 px-4 text-xs font-semibold"
                disabled={validating || isImporting}
              >
                Download Validation Report
              </Button>
            )}
            {step === "result" && (
              <Button variant="ghost" onClick={handleClose} className="h-10 px-4 text-xs font-semibold">
                Close
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === "machine" && (
              <Button
                variant="primary"
                onClick={() => setStep("template")}
                disabled={!canContinueToUpload}
                className="h-10 px-5 text-xs sm:text-sm font-semibold"
              >
                Continue
              </Button>
            )}
            {step === "template" && (
              <Button variant="primary" onClick={() => setStep("upload")} className="h-10 px-5 text-xs sm:text-sm font-semibold">
                Continue to Upload
              </Button>
            )}
            {step === "upload" && (
              <Button
                variant="primary"
                onClick={handleValidate}
                disabled={!file || validating || isImporting}
                className="h-10 px-5 text-xs sm:text-sm font-semibold"
              >
                {validating ? (
                  <>
                    <Spinner /> Validating…
                  </>
                ) : (
                  "Validate & Preview"
                )}
              </Button>
            )}
            {step === "review" && (
              <Button
                variant="primary"
                onClick={() => setConfirmOpen(true)}
                disabled={
                  Boolean(preview?.blocked) ||
                  (preview?.summary.readyRows ?? 0) === 0 ||
                  (showDuplicateAck && !acknowledgeDuplicates) ||
                  isImporting
                }
                className="h-10 px-5 text-xs sm:text-sm font-semibold"
              >
                {isImporting ? (
                  <>
                    <Spinner /> Importing…
                  </>
                ) : (
                  `Import ${preview?.summary.readyRows ?? 0} Records`
                )}
              </Button>
            )}
          </div>
        </div>

        {step === "review" && showDuplicateAck && !preview?.blocked && (
          <label className="flex items-start gap-2 mt-3 text-xs text-[var(--color-ink)] cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledgeDuplicates}
              onChange={(e) => setAcknowledgeDuplicates(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand that {preview?.summary.duplicateRows} duplicate record(s) will be{" "}
              <strong>excluded</strong> from this import. Existing logsheets are never overwritten or updated.
            </span>
          </label>
        )}
      </Modal>

      <ConfirmationDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleImport}
        title="Confirm logsheet import"
        variant="info"
        confirmLabel="Import Records"
        loading={isImporting}
        description={
          <div className="flex flex-col gap-1.5 text-sm">
            <span>
              You are about to import historical machine logs into the database. This action is recorded in the
              audit trail and cannot be undone through this screen.
            </span>
            <ul className="list-disc pl-5 text-xs text-[var(--color-mute)]">
              <li>Machine: <strong>{preview?.machineLabel}</strong></li>
              <li>Valid records to import: <strong>{preview?.summary.readyRows ?? 0}</strong></li>
              <li>Invalid records: <strong>{preview?.summary.invalidRows ?? 0}</strong></li>
              <li>Duplicate records (excluded): <strong>{preview?.summary.duplicateRows ?? 0}</strong></li>
              <li>Needs review: <strong>{preview?.summary.reviewRows ?? 0}</strong></li>
              <li>
                Date range:{" "}
                <strong>
                  {preview?.summary.dateRangeStart || "—"} → {preview?.summary.dateRangeEnd || "—"}
                </strong>
              </li>
              <li>Total running hours: <strong>{(preview?.summary.totalRunningHours ?? 0).toFixed(2)}h</strong></li>
            </ul>
          </div>
        }
      />
    </>
  );
}
