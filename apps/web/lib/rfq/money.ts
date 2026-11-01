/**
 * RFQ Money & Tax Calculations (Paise Integer Precision)
 * Mirrors PostgreSQL generated columns in public.quotation_items
 */

export function computeLineNetPaise(
  quantity: number,
  unitPricePaise: number,
  durationValue: number | null | undefined,
  discountPct: number = 0
): number {
  const duration = durationValue && durationValue > 0 ? durationValue : 1;
  const rawNet = quantity * unitPricePaise * duration * (1 - discountPct / 100);
  return Math.round(rawNet);
}

export function computeLineTaxPaise(lineNetPaise: number, gstRate: number = 18): number {
  return Math.round((lineNetPaise * gstRate) / 100);
}

export function formatPaiseToInr(paise: number | bigint | null | undefined): string {
  if (paise == null) return "₹0.00";
  const num = typeof paise === "bigint" ? Number(paise) : paise;
  const rupees = num / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function formatPaiseToCompactInr(paise: number | bigint | null | undefined): string {
  if (paise == null) return "₹0";
  const num = typeof paise === "bigint" ? Number(paise) : paise;
  const rupees = num / 100;
  if (rupees >= 10000000) {
    return `₹${(rupees / 10000000).toFixed(2)} Cr`;
  }
  if (rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(2)} L`;
  }
  if (rupees >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)}k`;
  }
  return `₹${rupees.toLocaleString("en-IN")}`;
}

export function parseInrToPaise(inrString: string | number): number {
  if (typeof inrString === "number") return Math.round(inrString * 100);
  const clean = inrString.replace(/[^0-9.-]+/g, "");
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}
