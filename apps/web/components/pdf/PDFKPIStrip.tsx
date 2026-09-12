/**
 * PDFKPIStrip — Reusable KPI summary strip for all PDF/print reports.
 *
 * Renders a horizontal row of metric cards with label + value.
 * Supports "light" (neutral-100 bg) and "dark" (neutral-900 bg) variants.
 */

export interface PDFKPIItem {
  /** Metric label (e.g. "Total Logs") */
  label: string;
  /** Metric value (e.g. "86 Logs") */
  value: string;
  /** Optional color class for the value text (e.g. "text-sky-700", "text-sky-400") */
  valueColor?: string;
}

export interface PDFKPIStripProps {
  /** Array of metric items to display */
  items: PDFKPIItem[];
  /** Visual variant: "light" uses neutral-100 bg, "dark" uses neutral-900 bg with white text */
  variant?: "light" | "dark";
}

export function PDFKPIStrip({ items, variant = "light" }: PDFKPIStripProps) {
  const isLight = variant === "light";

  return (
    <div
      className={`grid gap-1.5 p-2 rounded-lg text-center font-mono kpi-strip ${
        isLight
          ? "bg-neutral-100 border border-neutral-300"
          : "bg-neutral-900 text-white"
      }`}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item, idx) => (
        <div key={idx} className="flex flex-col items-center justify-center">
          <span
            className={`text-[8px] sm:text-[9px] block font-sans font-extrabold uppercase tracking-wide truncate ${
              isLight ? "text-neutral-600" : "text-neutral-400"
            }`}
          >
            {item.label}
          </span>
          <span
            className={`text-[11px] sm:text-[12px] font-black ${
              item.valueColor || (isLight ? "text-neutral-900" : "text-white")
            }`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
