/**
 * Centralized Print CSS Stylesheet Generator
 *
 * Single source of truth for all @media print and @media screen rules used by
 * PDF/print report components. Each report passes its unique document portal ID.
 */

import { PDF_PAGE } from "./pdf-config";

export interface PrintStylesheetOptions {
  /** Include screen-mode preview table styles (centered, bordered, bold headers) */
  includePreviewStyles?: boolean;
  /** Include KPI strip print color-adjust rules */
  includeKpiStrip?: boolean;
}

/**
 * Generate the complete print stylesheet string for a given document portal ID.
 *
 * @param documentId - The DOM id of the portal container (e.g. "printable-supervisor-logs-document")
 * @param previewId  - Optional DOM id of the screen preview container (e.g. "printable-supervisor-logs-document-preview")
 * @param options    - Optional style feature flags
 */
export function getPrintStylesheet(
  documentId: string,
  previewId?: string,
  options: PrintStylesheetOptions = {}
): string {
  const { includePreviewStyles = false, includeKpiStrip = false } = options;

  const screenPreviewStyles = includePreviewStyles && previewId
    ? `
          #${previewId} .print-table {
            table-layout: fixed !important;
            width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
            text-align: center !important;
          }
          #${previewId} .print-table thead th {
            color: #000000 !important;
            font-weight: 900 !important;
            text-align: center !important;
            vertical-align: middle !important;
            background-color: #f3f4f6 !important;
            border: 1px solid #171717 !important;
          }
          #${previewId} .print-table tbody td {
            text-align: center !important;
            vertical-align: middle !important;
            border: 1px solid #d4d4d4 !important;
          }
          #${previewId} .print-table tbody td * {
            text-align: center !important;
          }`
    : "";

  const kpiStripPrintStyles = includeKpiStrip
    ? `
          .kpi-strip {
            background-color: #f3f4f6 !important;
            border: 1px solid #d4d4d4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }`
    : "";

  return `
        @media screen {
          #${documentId} {
            display: none !important;
          }${screenPreviewStyles}
        }
        @media print {
          @page {
            size: ${PDF_PAGE.size};
            margin: ${PDF_PAGE.margin.top} ${PDF_PAGE.margin.right} ${PDF_PAGE.margin.bottom} ${PDF_PAGE.margin.left};
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
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body > *:not(#${documentId}) {
            display: none !important;
          }
          #${documentId},
          #${documentId} * {
            visibility: visible !important;
          }
          #${documentId} {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
            z-index: 999999 !important;
          }
          .print-document-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 auto !important;
          }
          .print-table-wrap {
            overflow: visible !important;
            width: 100% !important;
            display: flex !important;
            justify-content: center !important;
          }
          .print-table {
            min-width: 0 !important;
            width: 100% !important;
            table-layout: fixed !important;
            margin-left: auto !important;
            margin-right: auto !important;
            text-align: center !important;
          }
          .print-table thead th {
            color: #000000 !important;
            font-weight: 900 !important;
            text-align: center !important;
            vertical-align: middle !important;
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            border: 1px solid #171717 !important;
          }
          .print-table tbody td {
            text-align: center !important;
            vertical-align: middle !important;
            border: 1px solid #d4d4d4 !important;
          }
          .print-table tbody td * {
            text-align: center !important;
          }${kpiStripPrintStyles}
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
      `;
}
