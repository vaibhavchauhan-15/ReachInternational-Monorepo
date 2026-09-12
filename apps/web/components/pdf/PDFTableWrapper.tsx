/**
 * PDFTableWrapper — Reusable print-optimized table container for all PDF reports.
 *
 * Provides consistent overflow handling, centering, print-optimized CSS classes,
 * and proper table layout for both screen preview and printed output.
 */
import React from "react";

export interface PDFTableWrapperProps {
  /** Table element as children */
  children: React.ReactNode;
  /** Additional CSS classes for the wrapper div */
  className?: string;
}

export function PDFTableWrapper({ children, className = "" }: PDFTableWrapperProps) {
  return (
    <div className={`w-full overflow-x-auto custom-scrollbar print-table-wrap flex justify-center ${className}`}>
      {children}
    </div>
  );
}
