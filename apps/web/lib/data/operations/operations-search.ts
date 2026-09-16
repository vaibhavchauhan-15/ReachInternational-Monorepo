import "server-only";

import {
  getCachedOperationsOperators,
  getCachedOperationsMachines,
  getCachedOperationsClients,
} from "./operations-filters";

export type OperationsLogViewMode = "machine" | "client" | "operator";

/**
 * Builds a view-tailored, multi-attribute PostgREST OR clause for searching machine hour logs.
 * 
 * Searches globally across the active view's supported entity fields:
 * - Machine View: Operator name (e.g. "Ashwini"), Client name, Location, Remarks, Shift
 * - Client View: Operator name (e.g. "Ashwini"), Machine code/model/serial, Location, Remarks, Shift
 * - Operator View: Machine code/model/serial, Client name, Location, Remarks, Shift
 * 
 * Uses SWR-cached option lists to map names/codes to UUID foreign keys in < 1ms memory,
 * allowing PostgreSQL to execute index scans across:
 * - idx_machine_hour_logs_operator_date (B-tree)
 * - idx_machine_hour_logs_machine_date (B-tree)
 * - idx_machine_hour_logs_client_date (B-tree)
 * - idx_mhl_location_trgm (GIN trigram)
 * - idx_mhl_remarks_trgm (GIN trigram)
 */
export async function resolveOperationsSearchClause(
  rawSearch: string | undefined | null,
  view: OperationsLogViewMode
): Promise<string | null> {
  if (!rawSearch) return null;

  // Sanitize search string to prevent PostgREST syntax injection/delimiter issues
  const s = rawSearch.replace(/[,()"\n\r\\]/g, " ").trim();
  if (!s || s.length === 0) return null;

  const lower = s.toLowerCase();
  const orParts: string[] = [];

  // 1. Direct text columns with GIN trigram indexes
  orParts.push(`location.ilike.%${s}%`);
  orParts.push(`remarks.ilike.%${s}%`);

  // 2. Shift matching (if search term matches standard shift values)
  const shiftKeywords = ["day", "night", "general", "morning", "evening", "ot", "overtime"];
  if (shiftKeywords.some((k) => lower.includes(k) || k.includes(lower))) {
    orParts.push(`shift.ilike.%${s}%`);
  }

  // 3. Multi-entity cross-field resolution based on active view
  if (view === "client" || view === "machine") {
    // Resolve matching operators
    const cachedOperators = await getCachedOperationsOperators();
    const matchingOps = cachedOperators.filter(
      (op) =>
        op.full_name?.toLowerCase().includes(lower) ||
        op.name?.toLowerCase().includes(lower) ||
        (op.phone && op.phone.includes(s))
    );
    if (matchingOps.length > 0) {
      const opIds = matchingOps.map((o) => o.id).filter(Boolean).join(",");
      if (opIds) {
        orParts.push(`operator_id.in.(${opIds})`);
      }
    }
  }

  if (view === "operator" || view === "client") {
    // Resolve matching machines
    const cachedMachines = await getCachedOperationsMachines();
    const matchingMachines = cachedMachines.filter(
      (m) =>
        m.machine_id?.toLowerCase().includes(lower) ||
        m.machine_code?.toLowerCase().includes(lower) ||
        m.model?.toLowerCase().includes(lower) ||
        m.serial_number?.toLowerCase().includes(lower) ||
        m.manufacturer?.toLowerCase().includes(lower)
    );
    if (matchingMachines.length > 0) {
      const machIds = matchingMachines.map((m) => m.id).filter(Boolean).join(",");
      if (machIds) {
        orParts.push(`machine_id.in.(${machIds})`);
      }
    }
  }

  if (view === "operator" || view === "machine") {
    // Resolve matching clients
    const cachedClients = await getCachedOperationsClients();
    const matchingClients = cachedClients.filter(
      (c) =>
        c.company_name?.toLowerCase().includes(lower) ||
        c.client_name?.toLowerCase().includes(lower) ||
        (c.code && c.code.toLowerCase().includes(lower))
    );
    if (matchingClients.length > 0) {
      const clientIds = matchingClients.map((c) => c.id).filter(Boolean).join(",");
      if (clientIds) {
        orParts.push(`client_id.in.(${clientIds})`);
      }
    }
  }

  return orParts.join(",");
}
