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
 * Execute browser print with temporary document title swap for PDF filename.
 * Restores original title after 1 second.
 */
export function handleBrowserPrint(pdfFileName: string): void {
  const originalTitle = document.title;
  document.title = pdfFileName.replace(/\.pdf$/, "");
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
}
