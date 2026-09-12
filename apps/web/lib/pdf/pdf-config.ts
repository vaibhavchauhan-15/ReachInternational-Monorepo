/**
 * Centralized PDF Configuration & Constants
 *
 * Single source of truth for page dimensions, margins, branding, month names,
 * filename builder utilities, and date/time slug formatters used across all
 * PDF/print/export features in the application.
 */
import { formatDate, getISTDateString } from "@reachinternational/utils";

// ─── Page Dimensions & Margins ───────────────────────────────────────────────
export const PDF_PAGE = {
  size: "portrait" as const,
  format: "A4" as const,
  width: "210mm",
  height: "297mm",
  margin: {
    top: "5mm",
    right: "8mm",
    bottom: "5mm",
    left: "8mm",
  },
} as const;

// ─── Branding ────────────────────────────────────────────────────────────────
export const PDF_BRANDING = {
  logoSrc: "/pdf-logo.png",
  logoAlt: "Reach International",
  companyName: "REACH INTERNATIONAL",
  approverRole: "(Operations / Service Manager)",
} as const;

// ─── Month Names (shared across exports, filters, PDF reports) ───────────────
export const MONTH_NAMES = [
  { value: "all", label: "All Months", short: "All" },
  { value: "01", label: "January", short: "Jan" },
  { value: "02", label: "February", short: "Feb" },
  { value: "03", label: "March", short: "Mar" },
  { value: "04", label: "April", short: "Apr" },
  { value: "05", label: "May", short: "May" },
  { value: "06", label: "June", short: "Jun" },
  { value: "07", label: "July", short: "Jul" },
  { value: "08", label: "August", short: "Aug" },
  { value: "09", label: "September", short: "Sep" },
  { value: "10", label: "October", short: "Oct" },
  { value: "11", label: "November", short: "Nov" },
  { value: "12", label: "December", short: "Dec" },
  { value: "custom", label: "Custom Range", short: "Custom" },
] as const;

// ─── Date / Month Utilities ──────────────────────────────────────────────────

/** Returns current 2-digit month string ("01" to "12") pinned to IST */
export function getCurrentMonthNumber(): string {
  try {
    const istDate = getISTDateString();
    const parts = istDate.split("-");
    if (parts.length >= 2 && parts[1]) {
      return parts[1];
    }
  } catch {
    // fallback below
  }
  const m = new Date().getMonth() + 1;
  return m < 10 ? `0${m}` : `${m}`;
}

/** Extract 2-digit month string ("01" to "12") from a log date string */
export function getLogMonthNumber(logDateStr: string): string {
  if (!logDateStr) return "";
  const isoMatch = logDateStr.match(/^\d{4}-(\d{2})-\d{2}/);
  if (isoMatch) return isoMatch[1];
  const dmyMatch = logDateStr.match(/^\d{2}-(\d{2})-\d{4}/);
  if (dmyMatch) return dmyMatch[1];

  const d = new Date(logDateStr);
  if (!isNaN(d.getTime())) {
    const m = d.getMonth() + 1;
    return m < 10 ? `0${m}` : `${m}`;
  }
  return "";
}

// ─── Export Date/Time Slug Formatters ─────────────────────────────────────────

/** Format date & time slug for filenames (e.g. display: "21-08-2026 16:16", slug: "21-08-2026-16-16") */
export function formatExportDateTimeSlug(dateObj: Date = new Date()): {
  displayDateTime: string;
  slugDateTime: string;
} {
  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, "0");
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");

  const displayDateTime = `${day}-${month}-${year} ${hours}:${minutes}`;
  const slugDateTime = `${day}-${month}-${year}-${hours}-${minutes}`;
  return { displayDateTime, slugDateTime };
}

// ─── Export Filename Builders ────────────────────────────────────────────────

/** Build standardized operator export filename: Operator-Name-Month-Datetime.ext */
export function buildExportFileName(
  operatorName: string,
  selectedMonthValue: string,
  extension: "xlsx" | "pdf",
  customStartDate?: string,
  customEndDate?: string
): string {
  const rawName = (operatorName || "").trim() || "Operator";
  const nameWords = rawName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const operatorSlug =
    nameWords.length > 0
      ? nameWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("-")
      : "Operator";

  let periodSlug = "";
  if (selectedMonthValue === "custom") {
    const s = customStartDate ? formatDate(customStartDate).replace(/\s+/g, "") : "Start";
    const e = customEndDate ? formatDate(customEndDate).replace(/\s+/g, "") : "End";
    periodSlug = `Custom-${s}-to-${e}`;
  } else if (
    selectedMonthValue &&
    selectedMonthValue.toLowerCase() !== "all" &&
    selectedMonthValue.toLowerCase() !== "all months"
  ) {
    const monthObj = MONTH_NAMES.find(
      (m) =>
        m.value === selectedMonthValue ||
        m.short.toLowerCase() === selectedMonthValue.toLowerCase() ||
        m.label.toLowerCase() === selectedMonthValue.toLowerCase()
    );
    if (monthObj && monthObj.value !== "all") {
      periodSlug = monthObj.label;
    } else if (!monthObj) {
      const monthWords = selectedMonthValue.split(/[^a-zA-Z0-9]+/).filter(Boolean);
      periodSlug =
        monthWords.length > 0
          ? monthWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("-")
          : selectedMonthValue;
    }
  }

  const { slugDateTime } = formatExportDateTimeSlug();
  if (periodSlug) {
    return `${operatorSlug}-${periodSlug}-${slugDateTime}.${extension}`;
  }
  return `${operatorSlug}-${slugDateTime}.${extension}`;
}

/** Build standardized machine export filename: SerialNumber-Datetime.ext */
export function buildMachineExportFileName(
  serialNumberOrCode: string,
  extension: "xlsx" | "pdf",
  customStartDate?: string,
  customEndDate?: string
): string {
  const rawSerial = (serialNumberOrCode || "").trim() || "Machine";
  const words = rawSerial.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  const serialSlug = words.length > 0 ? words.join("-") : "Machine";

  let rangeSlug = "";
  if (customStartDate && customEndDate) {
    rangeSlug = `-${formatDate(customStartDate).replace(/\s+/g, "")}-to-${formatDate(customEndDate).replace(/\s+/g, "")}`;
  }

  const { slugDateTime } = formatExportDateTimeSlug();
  return `${serialSlug}${rangeSlug}-${slugDateTime}.${extension}`;
}

/** Build standardized machines directory export filename */
export function buildMachinesExportFileName(prefix: string, extension: "xlsx" | "csv" | "pdf"): string {
  const { slugDateTime } = formatExportDateTimeSlug();
  return `${prefix}-${slugDateTime}.${extension}`;
}
