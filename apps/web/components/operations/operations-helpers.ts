/**
 * Pure helper functions for the Operations module.
 */

export function formatMachineSelectLabel(m: {
  machine_id?: string;
  machine_code?: string;
  id?: string;
  model?: string | null;
  manufacturer?: string | null;
  serial_number?: string | null;
  machine_name?: string;
}): string {
  if (!m) return "Machine";
  const code = m.machine_id || m.machine_code || m.id || "Machine";
  const model = [m.manufacturer?.trim(), m.model?.trim()].filter(Boolean).join(" ");
  const serial = m.serial_number && m.serial_number !== code ? `S/N: ${m.serial_number}` : null;
  const details = [model, serial].filter(Boolean).join(" — ");
  return details ? `${code} (${details})` : code;
}

/**
 * Format client full address: street + city + district + state + pincode.
 * Treats these 5 fields as the single canonical address of the client site.
 */
export function formatClientFullAddress(c?: any): string {
  if (!c) return "";
  const street = (c.street || "").trim();
  const city = (c.city || "").trim();
  const district = (c.district || "").trim();
  const state = (c.state || "").trim();
  const pincode = (c.pincode || "").trim();
  const parts = [street, city, district, state, pincode].filter(Boolean);
  return parts.join(", ");
}

import { getOperationsCurrentMonth } from "@reachinternational/utils";

/**
 * Helper for current month value ("01" to "12") in IST.
 */
export function getCurrentMonthValue(): string {
  return getOperationsCurrentMonth();
}
