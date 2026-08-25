"use client";

import { useState, useTransition } from "react";
import { Modal, Button, Input, Textarea, useToast, TooltipWrapper } from "@/components/ui";
import { closeComplaintWithFSR } from "@/app/actions/complaints";
import type { ComplaintWithDetails } from "@/lib/types/database";
import {
  AnimatedPrinter,
  AnimatedCheckCircle,
  AnimatedUpload,
  AnimatedShieldCheck,
  AnimatedWrench,
  AnimatedCheck,
  AnimatedX,
  AnimatedEdit,
  AnimatedRotateCw,
  AnimatedPlus,
  AnimatedTrash,
} from "@/components/ui/animated-icons";
import { Shield, CheckCheck, RotateCcw, Check, X, Wrench, Plus, Trash2, Printer, Edit3, CheckCircle } from "lucide-react";


interface FieldServiceReportModalProps {
  open: boolean;
  onClose: () => void;
  complaint: ComplaintWithDetails;
  userRole?: string;
  onSuccess?: () => void;
}

const DEFAULT_CHECKLIST_ITEMS = [
  "Engine Starting",
  "Key Switch",
  "Emergency Platform",
  "Horn",
  "Wheel Rim Nut",
  "Wire Harness",
  "Toggle Switch",
  "Function From Basket",
  "Joy Stick",
  "Machine Free Bypass",
  "Engine Oil Status",
  "Hydraulic Oil Status",
  "Battery Condition",
  "Hour Meter",
  "Emergency Ground",
  "Battery Terminal",
  "Light",
  "Hydraulic Cylinder Leakage",
  "Brake Operation",
  "Fuel Feed Pump",
  "Function From Ground",
  "Hydraulic Pipe Leakage",
  "Engine Oil Qty",
  "Hydraulic Oil Qty",
  "Paint Condition",
];

export function FieldServiceReportModal({
  open,
  onClose,
  complaint,
  userRole,
  onSuccess,
}: FieldServiceReportModalProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const isManagerReview = userRole === "branch_manager" || userRole === "service_manager" || userRole === "admin" || userRole === "super_admin";
  const isResolvedOrClosed = complaint.status === "resolved" || complaint.status === "closed";
  const isReadOnlyUser = userRole === "supervisor" || userRole === "operator";
  const [isEditing, setIsEditing] = useState<boolean>(!isResolvedOrClosed && !isManagerReview && !isReadOnlyUser);

  const [fsrNo, setFsrNo] = useState(`FSR-${complaint.complaint_no.replace("CMP-", "")}`);
  const [reportDate, setReportDate] = useState(
    complaint.end_date || new Date().toISOString().split("T")[0]
  );
  const [workDone, setWorkDone] = useState(complaint.work_done || "");
  const [hourMeter, setHourMeter] = useState(complaint.hour_meter || 0);
  const [status, setStatus] = useState("Repaired & Operational");
  const [pdfFileUrl, setPdfFileUrl] = useState(complaint.pdf_report_url || "");

  // Initialize checklist items state: 'Y' (Passed), 'N' (Failed), or '-' (N/A)
  const [checklist, setChecklist] = useState<Record<string, "Y" | "N" | "-">>(() => {
    if (complaint.checklist_data?.checklist) {
      return complaint.checklist_data.checklist as Record<string, "Y" | "N" | "-">;
    }
    const initial: Record<string, "Y" | "N" | "-"> = {};
    DEFAULT_CHECKLIST_ITEMS.forEach((item) => {
      initial[item] = "Y";
    });
    return initial;
  });

  // Replaced parts state
  const [parts, setParts] = useState<Array<{ partName: string; qty: number; status: string; date: string }>>(() => {
    if (complaint.checklist_data?.parts && Array.isArray(complaint.checklist_data.parts)) {
      return complaint.checklist_data.parts as Array<{ partName: string; qty: number; status: string; date: string }>;
    }
    return [
      {
        partName: complaint.required_part || "Original Spare Part",
        qty: complaint.part_quantity || 1,
        status: "Replaced & Tested",
        date: reportDate,
      },
    ];
  });

  const toggleChecklist = (item: string) => {
    if (!isEditing) return;
    setChecklist((prev) => {
      const current = prev[item] || "Y";
      const next = current === "Y" ? "N" : current === "N" ? "-" : "Y";
      return { ...prev, [item]: next };
    });
  };

  const handleMarkAllPassed = () => {
    const allPassed: Record<string, "Y" | "N" | "-"> = {};
    DEFAULT_CHECKLIST_ITEMS.forEach((item) => {
      allPassed[item] = "Y";
    });
    setChecklist(allPassed);
    toast("info", "All checklist items marked as Passed (Y)");
  };

  const handleResetChecklist = () => {
    const reset: Record<string, "Y" | "N" | "-"> = {};
    DEFAULT_CHECKLIST_ITEMS.forEach((item) => {
      reset[item] = "-";
    });
    setChecklist(reset);
  };

  const handleAddPartRow = () => {
    setParts((prev) => [
      ...prev,
      { partName: "", qty: 1, status: "Replaced & Tested", date: reportDate },
    ]);
  };

  const handleRemovePartRow = (index: number) => {
    setParts((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrintReport = () => {
    const printElement = document.getElementById("printable-fsr-report");
    if (!printElement) {
      window.print();
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Clone element to sanitize inputs for printing
    const printClone = printElement.cloneNode(true) as HTMLElement;

    // Replace all input & textarea elements in the clone with clean text elements for printing
    const inputs = printClone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    inputs.forEach((input) => {
      const val = input.value;
      const span = document.createElement("span");
      span.className = input.className;
      span.style.border = "none";
      span.style.background = "transparent";
      span.style.padding = "0";
      span.style.outline = "none";
      span.style.boxShadow = "none";
      if (input.tagName.toLowerCase() === "textarea") {
        span.style.whiteSpace = "pre-wrap";
      }
      span.textContent = val || "-";
      input.parentNode?.replaceChild(span, input);
    });

    // Remove action columns and buttons in print clone
    const noPrintItems = printClone.querySelectorAll(".no-print, button");
    noPrintItems.forEach((el) => el.remove());

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Field Service Report - ${fsrNo}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              color: #000000;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            }
            #printable-fsr-report {
              width: 210mm !important;
              min-height: 297mm !important;
              margin: 0 auto !important;
              padding: 10mm 12mm !important;
              border: none !important;
              box-shadow: none !important;
              background: #ffffff !important;
              box-sizing: border-box !important;
            }
            button, input[type="file"], .no-print {
              display: none !important;
            }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .items-start { align-items: flex-start; }
            .justify-between { justify-content: space-between; }
            .justify-center { justify-content: center; }
            .gap-1 { gap: 0.25rem; }
            .gap-1.5 { gap: 0.375rem; }
            .gap-2 { gap: 0.5rem; }
            .gap-3 { gap: 0.75rem; }
            .gap-4 { gap: 1rem; }
            .gap-px { gap: 1px; }
            .p-1.5 { padding: 0.375rem; }
            .p-2 { padding: 0.5rem; }
            .p-2.5 { padding: 0.625rem; }
            .p-6 { padding: 1.5rem; }
            .pb-2 { padding-bottom: 0.5rem; }
            .pb-3 { padding-bottom: 0.75rem; }
            .pt-4 { padding-top: 1rem; }
            .pt-6 { padding-top: 1.5rem; }
            .bg-white { background-color: #ffffff !important; }
            .bg-neutral-50 { background-color: #f8fafc !important; }
            .bg-neutral-100 { background-color: #f1f5f9 !important; }
            .bg-neutral-900 { background-color: #0f172a !important; color: #ffffff !important; }
            .bg-emerald-50\\/50, .bg-emerald-50 { background-color: #ecfdf5 !important; }
            .bg-emerald-100 { background-color: #d1fae5 !important; }
            .bg-red-50\\/50, .bg-red-50 { background-color: #fef2f2 !important; }
            .bg-red-100 { background-color: #fee2e2 !important; }
            .text-black { color: #000000 !important; }
            .text-white { color: #ffffff !important; }
            .text-neutral-900 { color: #0f172a !important; }
            .text-neutral-800 { color: #1e293b !important; }
            .text-neutral-700 { color: #334155 !important; }
            .text-neutral-600 { color: #475569 !important; }
            .text-neutral-500 { color: #64748b !important; }
            .text-blue-600, .text-blue-700 { color: #1d4ed8 !important; }
            .text-emerald-600, .text-emerald-700, .text-emerald-800 { color: #047857 !important; }
            .text-red-600, .text-red-800 { color: #b91c1c !important; }
            .border { border: 1px solid #cbd5e1 !important; }
            .border-neutral-200 { border-color: #e2e8f0 !important; }
            .border-neutral-300 { border-color: #cbd5e1 !important; }
            .border-neutral-400 { border-color: #94a3b8 !important; }
            .border-neutral-800, .border-neutral-900 { border-color: #0f172a !important; }
            .border-b-2 { border-bottom: 2px solid #0f172a !important; }
            .border-t { border-top: 1px solid #cbd5e1 !important; }
            .rounded { border-radius: 0.25rem; }
            .rounded-xl { border-radius: 0.5rem; }
            .font-bold { font-weight: 700 !important; }
            .font-extrabold { font-weight: 800 !important; }
            .font-semibold { font-weight: 600 !important; }
            .font-medium { font-weight: 500 !important; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
            .uppercase { text-transform: uppercase !important; }
            .text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
            .text-xl { font-size: 1.25rem !important; line-height: 1.75rem !important; }
            .text-\\[10px\\] { font-size: 10px !important; }
            .text-\\[11px\\] { font-size: 11px !important; }
            .w-full { width: 100% !important; }
            .w-12 { width: 3rem !important; }
            .w-16 { width: 4rem !important; }
            .w-28 { width: 7rem !important; }
            .w-24 { width: 6rem !important; }
            .w-36 { width: 9rem !important; }
            table { width: 100% !important; border-collapse: collapse !important; }
            th { color: #ffffff !important; font-weight: 700 !important; background-color: #0f172a !important; }
          </style>
        </head>
        <body>
          ${printClone.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    }, 300);
  };

  const handleCloseAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDone.trim()) {
      toast("error", "Work Done summary is required to complete FSR report");
      return;
    }

    startTransition(async () => {
      const checklistPayload = {
        fsrNo,
        reportDate,
        checklist,
        parts,
        status,
        engineer: complaint.engineer?.full_name || "Field Engineer",
      };

      const res = await closeComplaintWithFSR(complaint.id, {
        work_done: workDone,
        pdf_report_url: pdfFileUrl || `/reports/${fsrNo}.pdf`,
        checklist_data: checklistPayload,
        hour_meter: hourMeter,
      });

      if (res.error) {
        toast("error", "Failed to save FSR report", res.error);
      } else {
        toast("success", `FSR Report (${fsrNo}) saved & complaint resolved!`);
        if (onSuccess) onSuccess();
        setIsEditing(false);
      }
    });
  };

  const passedCount = Object.values(checklist).filter((v) => v === "Y").length;
  const failedCount = Object.values(checklist).filter((v) => v === "N").length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Field Service Report (${fsrNo})`}
      headerActions={
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="secondary" onClick={handlePrintReport} className="h-7 px-2.5 text-xs font-medium" title="Print / Save PDF">
            <Printer className="h-3.5 w-3.5 mr-1" /> Print / Save PDF
          </Button>

          {isResolvedOrClosed && !isEditing && !isManagerReview && (
            <TooltipWrapper content="Edit Report" side="top">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditing(true)}
                className="h-7 w-7 p-0 flex items-center justify-center font-semibold"
                aria-label="Edit Report"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </Button>
            </TooltipWrapper>
          )}

          {isEditing && isResolvedOrClosed && !isManagerReview && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditing(false)}
              className="h-7 px-2.5 text-xs"
            >
              Cancel Edit
            </Button>
          )}

          {isManagerReview && (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  toast("info", `FSR ${fsrNo} sent back to Engineer for revision`);
                  onClose();
                }}
                className="h-7 px-2.5 text-xs bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 font-bold border-amber-300"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Send Back
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  toast("success", `FSR ${fsrNo} reviewed & approved by Service Manager!`);
                  if (onSuccess) onSuccess();
                  onClose();
                }}
                className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Approve FSR
              </Button>
            </>
          )}

          {isEditing && !isManagerReview && (
            <Button
              type="submit"
              form="fsr-form"
              variant="primary"
              loading={isPending}
              className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />{" "}
              {userRole === "mechanic" ? "Submit Details" : isResolvedOrClosed ? "Save Updates" : "Complete FSR"}
            </Button>
          )}
        </div>
      }
      size="xl"
    >
      <form id="fsr-form" onSubmit={handleCloseAndSubmit} className="flex flex-col gap-5">
        {/* Printable FSR Report Container */}
        <div id="printable-fsr-report" className="bg-white text-black p-6 rounded-xl border border-neutral-300 shadow-sm flex flex-col gap-4 text-xs font-sans">
          {/* FSR Header */}
          <div className="flex items-start justify-between border-b-2 border-neutral-900 pb-3 gap-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-html-element-suppress */}
              <img
                src="/pdf-logo.png"
                alt="Reach International"
                className="h-12 w-auto object-contain shrink-0"
              />
              <div>
                <h2 className="text-xl font-extrabold uppercase tracking-wide text-neutral-900">
                  FIELD SERVICE REPORT
                </h2>
                <p className="text-[11px] text-neutral-600 font-medium">REACH INTERNATIONAL Maintenance & Operational Log</p>
              </div>
            </div>
            <div className="text-right text-[11px] shrink-0">
              <div className="font-bold text-neutral-900">FSR No: <span className="font-mono text-blue-700">{fsrNo}</span></div>
              <div>Date: <strong>{reportDate}</strong></div>
              <div className="text-[10px] text-neutral-500 mt-1 max-w-[220px]">
                Regd off: 21, Palam Matiala Road, Dwarka, New Delhi-110059 | Ph: 91-11-23736256
              </div>
            </div>
          </div>

          {/* Metadata Table */}
          <div className="grid grid-cols-2 gap-px bg-neutral-900 border border-neutral-900 text-[11px]">
            <div className="bg-neutral-50 p-2 flex justify-between">
              <span className="font-semibold text-neutral-600">Service Engineer:</span>
              <span className="font-bold text-neutral-900">{complaint.engineer?.full_name || "Assigned Engineer"}</span>
            </div>
            <div className="bg-neutral-50 p-2 flex justify-between">
              <span className="font-semibold text-neutral-600">Model No:</span>
              <span className="font-bold text-neutral-900">{complaint.machine?.model || "N/A"}</span>
            </div>
            <div className="bg-neutral-50 p-2 flex justify-between">
              <span className="font-semibold text-neutral-600">Machine S. No:</span>
              <span className="font-mono font-bold text-neutral-900">{complaint.machine?.serial_number || complaint.machine?.machine_code}</span>
            </div>
            <div className="bg-neutral-50 p-2 flex justify-between items-center">
              <span className="font-semibold text-neutral-600">Hour Meter:</span>
              {isEditing ? (
                <input
                  type="number"
                  value={hourMeter}
                  onChange={(e) => setHourMeter(parseFloat(e.target.value) || 0)}
                  className="w-24 px-1.5 py-0.5 text-right font-mono font-bold border rounded bg-white text-neutral-900"
                />
              ) : (
                <span className="font-mono font-bold text-neutral-900">{hourMeter} Hours</span>
              )}
            </div>
            <div className="bg-neutral-50 p-2 flex justify-between">
              <span className="font-semibold text-neutral-600">Site Location:</span>
              <span className="font-medium text-neutral-900">{complaint.location || complaint.machine?.city || "On Site"}</span>
            </div>
            <div className="bg-neutral-50 p-2 flex justify-between items-center">
              <span className="font-semibold text-neutral-600">Status:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-36 px-1.5 py-0.5 text-right font-bold text-emerald-700 border rounded bg-white"
                />
              ) : (
                <span className="font-bold text-emerald-700">{status}</span>
              )}
            </div>
          </div>

          {/* Complaint & Correction Section */}
          <div className="border border-neutral-900 divide-y divide-neutral-900 text-[11px]">
            <div className="p-2.5 bg-red-50/50">
              <span className="font-bold uppercase text-red-800 block mb-1">Complaint / Malfunction Reported:</span>
              <p className="text-neutral-800 font-medium">{complaint.complaint}</p>
            </div>
            <div className="p-2.5 bg-emerald-50/50">
              <span className="font-bold uppercase text-emerald-800 block mb-1">Correction / Work Done (Filled by Engineer):</span>
              {isEditing ? (
                <textarea
                  value={workDone}
                  onChange={(e) => setWorkDone(e.target.value)}
                  rows={3}
                  placeholder="Describe corrective actions, repairs, or replacements performed..."
                  className="w-full p-2 border border-neutral-300 rounded text-neutral-900 bg-white font-medium text-xs focus:ring-1 focus:ring-emerald-500"
                  required
                />
              ) : (
                <p className="text-neutral-900 font-medium whitespace-pre-wrap">{workDone || "No work done logged yet."}</p>
              )}
            </div>
          </div>

          {/* Safety & Operational Checklist Y(ok Passed) And N(Failed) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-900 flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-blue-600" /> Operational Inspection Checklist — ({passedCount} Passed / {failedCount} Failed)
              </span>

              {isEditing && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleMarkAllPassed}
                    className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded hover:bg-emerald-200 flex items-center gap-1"
                  >
                    <CheckCheck className="h-3 w-3" /> Mark All Passed (Y)
                  </button>
                  <button
                    type="button"
                    onClick={handleResetChecklist}
                    className="px-2 py-0.5 text-[10px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-300 rounded hover:bg-neutral-200 flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Clear
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px] border border-neutral-300 p-2.5 rounded bg-neutral-50">
              {DEFAULT_CHECKLIST_ITEMS.map((item) => {
                const val = checklist[item] || "Y";
                return (
                  <div
                    key={item}
                    onClick={() => toggleChecklist(item)}
                    className={`flex items-center justify-between p-1.5 bg-white border border-neutral-200 rounded transition-colors ${
                      isEditing ? "cursor-pointer hover:border-neutral-400 select-none" : ""
                    }`}
                  >
                    <span className="text-neutral-700 truncate pr-1 font-medium">{item}</span>
                    {val === "Y" ? (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded flex items-center gap-0.5">
                        <Check className="h-3 w-3 text-emerald-600" /> Y
                      </span>
                    ) : val === "N" ? (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold bg-red-100 text-red-800 border border-red-300 rounded flex items-center gap-0.5">
                        <X className="h-3 w-3 text-red-600" /> N
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 text-[10px] font-bold bg-neutral-100 text-neutral-600 border rounded">
                        -
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Parts Replaced / Added Table */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-900 flex items-center gap-1">
                <Wrench className="h-3.5 w-3.5 text-amber-600" /> Parts Replaced / Added
              </span>

              {isEditing && (
                <button
                  type="button"
                  onClick={handleAddPartRow}
                  className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded hover:bg-amber-200 flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Part Row
                </button>
              )}
            </div>

            <table className="w-full text-left text-[11px] border border-neutral-900 border-collapse">
              <thead>
                <tr className="bg-neutral-900 text-white font-bold text-[10px] uppercase">
                  <th className="p-1.5 border border-neutral-800 w-10 text-center">Sr</th>
                  <th className="p-1.5 border border-neutral-800">Part Name</th>
                  <th className="p-1.5 border border-neutral-800 w-16 text-center">Qty</th>
                  <th className="p-1.5 border border-neutral-800">Status</th>
                  <th className="p-1.5 border border-neutral-800 w-28">Date</th>
                  {isEditing && <th className="p-1.5 border border-neutral-800 w-10 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-300">
                {parts.map((p, idx) => (
                  <tr key={idx} className="bg-white">
                    <td className="p-1.5 border border-neutral-300 text-center font-bold">{idx + 1}</td>
                    <td className="p-1.5 border border-neutral-300 font-semibold">
                      {isEditing ? (
                        <input
                          type="text"
                          value={p.partName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParts((prev) => prev.map((item, i) => (i === idx ? { ...item, partName: val } : item)));
                          }}
                          className="w-full p-1 border rounded text-xs bg-white text-neutral-900"
                          placeholder="e.g. Hydraulic Seal Set"
                        />
                      ) : (
                        p.partName
                      )}
                    </td>
                    <td className="p-1.5 border border-neutral-300 text-center font-mono font-bold">
                      {isEditing ? (
                        <input
                          type="number"
                          value={p.qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setParts((prev) => prev.map((item, i) => (i === idx ? { ...item, qty: val } : item)));
                          }}
                          className="w-12 p-1 border rounded text-xs bg-white text-center text-neutral-900"
                        />
                      ) : (
                        p.qty
                      )}
                    </td>
                    <td className="p-1.5 border border-neutral-300 text-emerald-700 font-medium">
                      {isEditing ? (
                        <input
                          type="text"
                          value={p.status}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParts((prev) => prev.map((item, i) => (i === idx ? { ...item, status: val } : item)));
                          }}
                          className="w-full p-1 border rounded text-xs bg-white text-neutral-900"
                        />
                      ) : (
                        p.status
                      )}
                    </td>
                    <td className="p-1.5 border border-neutral-300 font-mono text-neutral-600">{p.date}</td>
                    {isEditing && (
                      <td className="p-1 border border-neutral-300 text-center">
                        <TooltipWrapper content="Remove part row" side="left">
                          <button
                            type="button"
                            onClick={() => handleRemovePartRow(idx)}
                            className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                            aria-label="Remove part row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipWrapper>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Verification Signatures */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-neutral-300 text-center text-[10px] text-neutral-600">
            <div className="flex flex-col items-center">
              <div className="w-28 border-b border-neutral-400 mb-1 h-6 flex items-end justify-center font-serif text-neutral-800 text-xs italic font-bold">
                {complaint.engineer?.full_name || "Signed"}
              </div>
              <span className="font-bold text-neutral-900">Checked By</span>
              <span>(Service Engineer)</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-28 border-b border-neutral-400 mb-1 h-6 flex items-end justify-center font-serif text-neutral-800 text-xs italic font-bold">
                {complaint.supervisor?.full_name || "Verified"}
              </div>
              <span className="font-bold text-neutral-900">Verified By</span>
              <span>(Supervisor / Manager)</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-28 border-b border-neutral-400 mb-1 h-6 flex items-end justify-center text-neutral-400 text-[9px]">
                Sign Here
              </div>
              <span className="font-bold text-neutral-900">Customer Signature</span>
              <span>(Site In-Charge)</span>
            </div>
          </div>
        </div>

      </form>
    </Modal>
  );
}

