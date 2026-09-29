/**
 * Centralized PDF Utility Functions
 *
 * Shared helpers used across all PDF/print report components — eliminates
 * duplicate implementations of UUID detection, timing formatters, client name
 * resolution, period label builders, and browser print handlers.
 */
import { formatDate, formatTo12Hour } from "@reachinternational/utils";
import { MONTH_NAMES } from "./pdf-config";

// ─── UUID Detection ──────────────────────────────────────────────────────────

/** Check whether a string is a UUID (never display raw UUIDs to users) */
export function isUuid(val?: string | null): boolean {
  return Boolean(
    val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())
  );
}

// ─── Timing Formatters ───────────────────────────────────────────────────────

/** Compact timing range with zero spaces (e.g. "06:00AM-06:00PM") */
export function formatCompactTiming(startStr?: string | null, endStr?: string | null): string {
  const formattedStart = formatTo12Hour(startStr) || "06:00 AM";
  const formattedEnd = formatTo12Hour(endStr) || "02:00 PM";
  return `${formattedStart.replace(/\s+/g, "")}-${formattedEnd.replace(/\s+/g, "")}`;
}

/** Compute operating duration hours from start/end time strings (fallback: 8h) */
export function computeDurationHours(startStr?: string, endStr?: string): number {
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

// ─── Client Name Resolution ─────────────────────────────────────────────────

interface ClientNameResolutionParams {
  selectedClientName?: string;
  selectedEntityName?: string;
  selectedClientId?: string;
  selectedEntityId: string;
  machines?: any[];
  logs?: any[];
}

/**
 * Resolve a human-readable client company name using a robust cascade.
 * Never returns a raw UUID — falls back to "Client Representative".
 */
export function resolveCleanClientName(params: ClientNameResolutionParams): string {
  const {
    selectedClientName,
    selectedEntityName,
    selectedClientId,
    selectedEntityId,
    machines = [],
    logs = [],
  } = params;

  // 1. Direct props
  if (selectedClientName && !isUuid(selectedClientName)) return selectedClientName;
  if (selectedEntityName && !isUuid(selectedEntityName)) return selectedEntityName;

  // 2. From machines array
  const matchMachine = machines.find(
    (m) =>
      (selectedClientId && m.client_id === selectedClientId) ||
      (selectedEntityId && m.client_id === selectedEntityId)
  );
  const mClient = matchMachine?.client as any;
  if (mClient?.company_name && !isUuid(mClient.company_name)) return mClient.company_name;
  if (mClient?.client_name && !isUuid(mClient.client_name)) return mClient.client_name;

  // 3. From logs array
  const logWithClient = logs.find(
    (l: any) =>
      (l?.client?.company_name && !isUuid(l.client.company_name)) ||
      (l?.client?.client_name && !isUuid(l.client.client_name)) ||
      (l?.machine?.customer_name && !isUuid(l.machine?.customer_name))
  );
  if (logWithClient) {
    const c = (logWithClient as any).client;
    const m = (logWithClient as any).machine;
    const name = c?.company_name || c?.client_name || m?.customer_name;
    if (name && !isUuid(name)) return name;
  }

  // 4. Entity ID if not a UUID
  if (selectedEntityId && !isUuid(selectedEntityId) && selectedEntityId !== "all") {
    return selectedEntityId;
  }

  return "Client Representative";
}

// ─── Period Label ────────────────────────────────────────────────────────────

/** Build a human-readable period label from month selection and custom date range */
export function resolvePeriodLabel(
  selectedMonth: string,
  customStartDate?: string,
  customEndDate?: string
): string {
  if (selectedMonth === "custom") {
    if (customStartDate && customEndDate) {
      return `${formatDate(customStartDate)} to ${formatDate(customEndDate)}`;
    }
    if (customStartDate) return `From ${formatDate(customStartDate)}`;
    if (customEndDate) return `Up to ${formatDate(customEndDate)}`;
    return "Custom Range";
  }
  if (selectedMonth !== "all") {
    const mObj = MONTH_NAMES.find((m) => m.value === selectedMonth);
    if (mObj) return mObj.label;
  }
  return "All Months";
}

// ─── Client Location Resolution ──────────────────────────────────────────────

/** Resolve a display-ready client location string from site selection and log data */
export function resolveClientLocation(
  selectedSite?: string,
  logs?: any[]
): string {
  if (selectedSite && selectedSite !== "all") {
    return selectedSite;
  }
  if (logs && logs.length > 0) {
    const uniqueLogLocations = Array.from(
      new Set(logs.map((l: any) => l.location?.trim()).filter(Boolean))
    );
    if (uniqueLogLocations.length === 1) {
      return uniqueLogLocations[0] as string;
    }
    return "ALL SITES";
  }
  return "—";
}

// ─── Browser Print Handler ───────────────────────────────────────────────────

/**
 * Open a dedicated blank print window containing the serialized report HTML.
 *
 * Why a dedicated window instead of `window.print()` on the main page:
 * - `window.print()` with CSS `position:absolute` overlays produces only ONE
 *   page regardless of content height.
 * - A blank window receives a full flowing document, so the browser naturally
 *   paginates across as many A4 pages as needed — giving 100% preview fidelity.
 *
 * @param reportHtml  - The innerHTML of the already-rendered preview container.
 * @param pdfFileName - Desired PDF filename (used as the document title).
 * @param extraStyles - Optional additional CSS injected into the print window.
 */
export function openPrintWindow(
  reportHtml: string,
  pdfFileName: string,
  extraStyles = ""
): void {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    // Popup blocked - fall back gracefully
    alert("Please allow popups for this page to save as PDF, then try again.");
    return;
  }

  const titleText = pdfFileName.replace(/\.pdf$/i, "");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Collect all <link rel="stylesheet"> hrefs from the parent page so Tailwind
  // classes (colors, font sizes, spacing) render correctly in the popup.
  const parentStylesheets = Array.from(
    document.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']")
  )
    .map((l) => `<link rel="stylesheet" href="${l.href}" />`)
    .join("\n");

  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <base href="${origin}/" />
  <title>${titleText}</title>
  ${parentStylesheets}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      background: #ffffff !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    /* A4 page shell for screen preview inside the popup */
    #print-root {
      width: 210mm;
      margin: 0 auto;
      padding: 0;
      background: #ffffff;
    }
    .print-page {
      width: 210mm;
      min-height: 287mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 4mm 6mm;
      margin: 0 auto 8mm auto;
      background: #ffffff;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 5mm 8mm;
      }
      html, body {
        width: 210mm !important;
        height: auto !important;
        overflow: visible !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
      #print-root {
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print { display: none !important; }
      .print-page {
        width: 210mm !important;
        height: 287mm !important;
        max-height: 287mm !important;
        min-height: 287mm !important;
        page-break-after: always !important;
        break-after: page !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
        padding: 1.5mm 0 !important;
        margin: 0 !important;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
        overflow: hidden !important;
      }
      .print-page:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      /* Do NOT break inside a data row - JS sizes them dynamically */
      tbody tr { page-break-inside: avoid !important; break-inside: avoid !important; }
      thead { display: table-header-group !important; }
      .print-signature-block { page-break-inside: avoid !important; break-inside: avoid !important; }
      /* Preserve background colors (table header stripes, KPI strip) */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .kpi-strip {
        background-color: #f3f4f6 !important;
        border: 1px solid #d4d4d4 !important;
      }
      .print-table thead th {
        background-color: #f3f4f6 !important;
      }
    }
    /* Table styles for the report */
    .print-table {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      table-layout: fixed !important;
      border-collapse: collapse !important;
    }
    .print-table thead th {
      color: #000 !important;
      font-weight: 900 !important;
      background-color: #f3f4f6 !important;
      border: 1px solid #171717 !important;
      padding: 2.5px 3px !important;
      font-size: 8pt !important;
      line-height: 1.1 !important;
      vertical-align: middle !important;
      text-align: center !important;
    }
    .print-table tbody td {
      border: 1px solid #d4d4d4 !important;
      padding: 3px 2px !important;
      font-size: 8.5pt !important;
      line-height: 1.2 !important;
      vertical-align: middle !important;
      text-align: center !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    .print-table tbody td * {
      text-align: center !important;
    }
    .print-table tfoot td {
      border: 1px solid #171717 !important;
      padding: 2.5px 2px !important;
      font-size: 8.5pt !important;
      vertical-align: middle !important;
      text-align: center !important;
    }
    .print-table-wrap {
      overflow: visible !important;
      width: 100% !important;
    }
    .print-document-container {
      width: 100% !important;
    }
    ${extraStyles}
  </style>
</head>
<body>
  <div id="print-root">${reportHtml}</div>
  <script>
    // --- Dynamic Row-Height Fill for A4 pages ---
    // Measures all fixed elements (header, KPI, machine banner, thead, tfoot,
    // signature) then distributes remaining space evenly across tbody rows,
    // clamped between MIN (5.5mm for 31 days) and MAX (10.5mm for fewer days).
    function adjustPDFRowHeights() {
      var PAGE_H_MM  = 278;           // Target safe printable height guaranteeing zero page overflow
      var PX_PER_MM  = 96 / 25.4;    // CSS px per mm at standard 96dpi

      var MIN_ROW_MM  = 5.4;          // smallest readable row height (fits 31 days nicely)
      var MAX_ROW_MM  = 10.5;         // upper bound so fewer rows (15-20) don't look huge
      var MIN_FOOT_MM = 5;
      var MAX_FOOT_MM = 9;

      function pxToMm(px) { return px / PX_PER_MM; }
      function elH(el) { return el ? pxToMm(el.getBoundingClientRect().height) : 0; }

      var pages = document.querySelectorAll('.print-page');
      if (!pages || !pages.length) {
        var container = document.querySelector('.print-document-container');
        if (container) pages = [container];
      }
      if (!pages || !pages.length) return;

      pages.forEach(function(page) {
        var tbody = page.querySelector('tbody');
        if (!tbody) return;
        var rows = tbody.querySelectorAll('tr');
        if (!rows.length) return;

        var header    = page.querySelector('.pdf-report-header');
        var kpi       = page.querySelector('.kpi-strip');
        var banner    = page.querySelector('[data-machine-banner]');
        var table     = tbody.closest('table') || page.querySelector('table');
        var thead     = table ? table.querySelector('thead') : null;
        var tfoot     = table ? table.querySelector('tfoot') : null;
        var signature = page.querySelector('.print-signature-block');

        var fixedH = 0;
        if (header) fixedH += elH(header);
        if (kpi) fixedH += elH(kpi) + 2;
        if (banner) fixedH += elH(banner) + 2;
        if (thead) fixedH += elH(thead);
        if (tfoot) fixedH += elH(tfoot);
        if (signature) fixedH += elH(signature) + 3;
        fixedH += 5; // tolerance for borders, row gaps, padding

        var availH = PAGE_H_MM - fixedH;
        var rawRowH = availH / rows.length;
        var rowH_mm = Math.min(MAX_ROW_MM, Math.max(MIN_ROW_MM, rawRowH));

        rows.forEach(function(row) {
          row.style.height    = rowH_mm + 'mm';
          row.style.minHeight = rowH_mm + 'mm';
          row.style.maxHeight = rowH_mm + 'mm';
          var cells = row.querySelectorAll('td');
          cells.forEach(function(c) {
            c.style.height = rowH_mm + 'mm';
            c.style.minHeight = rowH_mm + 'mm';
            c.style.maxHeight = rowH_mm + 'mm';
            c.style.verticalAlign = 'middle';
            c.style.whiteSpace = 'nowrap';
            c.style.overflow = 'hidden';
            c.style.textOverflow = 'ellipsis';
          });
        });

        if (tfoot) {
          var tfootH_mm = Math.min(MAX_FOOT_MM, Math.max(MIN_FOOT_MM, rowH_mm * 0.85));
          tfoot.querySelectorAll('tr').forEach(function(row) {
            row.style.height    = tfootH_mm + 'mm';
            row.style.minHeight = tfootH_mm + 'mm';
            var cells = row.querySelectorAll('td');
            cells.forEach(function(c) {
              c.style.height = tfootH_mm + 'mm';
              c.style.minHeight = tfootH_mm + 'mm';
              c.style.verticalAlign = 'middle';
              c.style.whiteSpace = 'nowrap';
              c.style.overflow = 'hidden';
              c.style.textOverflow = 'ellipsis';
            });
          });
        }
      });
    }

    function initPrint() {
      adjustPDFRowHeights();
      setTimeout(function() { window.print(); }, 250);
    }

    if (document.readyState === 'complete') {
      setTimeout(initPrint, 250);
    } else {
      window.addEventListener('load', function() {
        setTimeout(initPrint, 250);
      });
    }

    // Close popup after print dialog is dismissed
    window.addEventListener('afterprint', function() {
      window.close();
    });
  </script>
</body>
</html>`);
  win.document.close();
}

/**
 * @deprecated Use openPrintWindow instead.
 * Execute browser print with temporary document title swap for PDF filename.
 */
export function handleBrowserPrint(pdfFileName: string): void {
  const originalTitle = document.title;
  document.title = pdfFileName.replace(/\.pdf$/, "");
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}

// ─── Shift Code Resolution ───────────────────────────────────────────────────

export function getShiftOrderWeight(log: any): number {
  if (log?.shift_code) {
    const c = String(log.shift_code).trim().toUpperCase();
    if (c === "S1" || c === "A" || c === "1") return 1;
    if (c === "S2" || c === "B" || c === "2") return 2;
    if (c === "S3" || c === "C" || c === "3") return 3;
    if (c === "S4" || c === "D" || c === "4") return 4;
  }
  const s = String(log?.shift || "").trim().toLowerCase();
  if (s.includes("morn") || s === "s1" || s === "1" || s === "a") return 1;
  if (s.includes("after") || s.includes("day") || s === "s2" || s === "2" || s === "b") return 2;
  if (s.includes("even") || s === "s3" || s === "3" || s === "c") return 3;
  if (s.includes("night") || s === "s4" || s === "4" || s === "d") return 4;

  const time = String(log?.start_time || "").trim();
  if (time >= "06:00" && time < "12:00") return 1;
  if (time >= "12:00" && time < "18:00") return 2;
  if (time >= "18:00") return 3;
  if (time >= "00:00" && time < "06:00") return 4;

  return 5;
}

export function resolveShiftCode(log: any): string {
  if (log?.shift_code && String(log.shift_code).trim()) {
    const c = String(log.shift_code).trim().toUpperCase();
    return c.startsWith("SHIFT") ? c.replace(/^SHIFT\s*/i, "") : c;
  }
  if (log?.shift && String(log.shift).trim()) {
    const s = String(log.shift).trim();
    if (/^(S\d|[A-D]|\d)$/i.test(s)) return s.toUpperCase();
    if (s.toLowerCase().startsWith("shift")) return s.replace(/^shift\s*/i, "").toUpperCase();
    const w = getShiftOrderWeight(log);
    return `S${w <= 4 ? w : 1}`;
  }
  const weight = getShiftOrderWeight(log);
  return `S${weight <= 4 ? weight : 1}`;
}
