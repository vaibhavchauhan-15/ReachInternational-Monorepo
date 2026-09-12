/**
 * PDFSignatureBlock — Reusable 3-column verification & signature section.
 *
 * Used consistently across all PDF reports for "Prepared By", "Client Sign-off",
 * and "Verified & Approved By" columns.
 */

export interface PDFSignatureColumn {
  /** Column heading (e.g. "Prepared By") */
  heading: string;
  /** Name displayed on the signature line */
  name: string;
  /** Role description below the name (e.g. "(Machine Operator)") */
  role: string;
  /** Optional additional detail text below the role (e.g. site location) */
  detail?: string;
  /** Whether the name should use bold uppercase tracking-wider style */
  nameUppercase?: boolean;
}

export interface PDFSignatureBlockProps {
  /** Array of 3 signature columns */
  columns: PDFSignatureColumn[];
}

export function PDFSignatureBlock({ columns }: PDFSignatureBlockProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-3 border-t border-neutral-300 text-center text-[9.5px] text-neutral-600 print-signature-block">
      {columns.map((col, idx) => (
        <div key={idx} className="flex flex-col items-center space-y-0.5">
          <span className="font-extrabold text-neutral-900 text-[9.5px] uppercase tracking-wider">
            {col.heading}
          </span>
          <div
            className={`w-28 sm:w-36 border-b border-neutral-400 mb-0.5 min-h-6 flex items-end justify-center text-neutral-900 text-center px-1 ${
              col.nameUppercase
                ? "font-sans text-[9.5px] font-extrabold tracking-wider"
                : "font-serif text-[10.5px] italic font-bold"
            }`}
          >
            {col.name}
          </div>
          <span className="font-bold text-neutral-800 text-[8.5px] text-center max-w-[170px] truncate">
            {col.role}
          </span>
          {col.detail && (
            <span className="font-bold text-neutral-800 text-[8.5px] text-center max-w-[170px] truncate">
              {col.detail}
            </span>
          )}
          <div className="flex items-center justify-between w-full max-w-[135px] text-[8px] text-neutral-700 pt-1 font-mono">
            <span>Sign: _______</span>
            <span>Date: _______</span>
          </div>
        </div>
      ))}
    </div>
  );
}
