/**
 * Barrel export for all centralized PDF components and utilities.
 */

// ─── Components ──────────────────────────────────────────────────────────────
export { PDFReportHeader } from "./PDFReportHeader";
export type { PDFReportHeaderProps } from "./PDFReportHeader";

export { PDFKPIStrip } from "./PDFKPIStrip";
export type { PDFKPIItem, PDFKPIStripProps } from "./PDFKPIStrip";

export { PDFSignatureBlock } from "./PDFSignatureBlock";
export type { PDFSignatureColumn, PDFSignatureBlockProps } from "./PDFSignatureBlock";

export { PDFTableWrapper } from "./PDFTableWrapper";
export type { PDFTableWrapperProps } from "./PDFTableWrapper";

// ─── Utilities ───────────────────────────────────────────────────────────────
export {
  isUuid,
  formatCompactTiming,
  computeDurationHours,
  resolveCleanClientName,
  resolvePeriodLabel,
  resolveClientLocation,
  handleBrowserPrint,
} from "@/lib/pdf/pdf-utils";

// ─── Configuration ───────────────────────────────────────────────────────────
export {
  PDF_PAGE,
  PDF_BRANDING,
  MONTH_NAMES,
  getCurrentMonthNumber,
  getLogMonthNumber,
  formatExportDateTimeSlug,
  buildExportFileName,
  buildMachineExportFileName,
  buildMachinesExportFileName,
} from "@/lib/pdf/pdf-config";

// ─── Print Styles ────────────────────────────────────────────────────────────
export { getPrintStylesheet } from "@/lib/pdf/pdf-print-styles";
export type { PrintStylesheetOptions } from "@/lib/pdf/pdf-print-styles";
