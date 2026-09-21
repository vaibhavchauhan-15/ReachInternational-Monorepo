/**
 * Formatting helpers for profile and display views.
 * Standalone, lightweight formatters matching monorepo rules.
 */

export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar || !aadhaar.trim()) return "—";
  const clean = aadhaar.replace(/[^0-9]/g, "");
  if (clean.length < 4) return aadhaar.trim();
  return `XXXX-XXXX-${clean.slice(-4)}`;
}

export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
