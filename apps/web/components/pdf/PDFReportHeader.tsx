/**
 * PDFReportHeader — Reusable report header for all PDF/print reports.
 *
 * Renders: Logo (left) | Title + Subtitle (center) | Metadata strip (below)
 * Supports pipe-separated subtitle parts and flexible metadata items.
 */
import React from "react";
import { PDF_BRANDING } from "@/lib/pdf/pdf-config";

export interface PDFReportHeaderProps {
  /** Report title (e.g. "SUPERVISOR MACHINE RUNNING HOURS REPORT") */
  title: string;
  /** Optional subtitle text (plain string, displayed below title) */
  subtitle?: string;
  /** Pipe-separated subtitle parts for single-line display (overrides `subtitle`) */
  subtitleParts?: string[];
  /** Key-value metadata items rendered in a horizontal strip */
  metadataItems: { label: string; value: string }[];
  /** Logo image source (default: /pdf-logo.png) */
  logoSrc?: string;
  /** Whether to use the centered layout (supervisor-style) vs grid layout */
  centeredLayout?: boolean;
}

export function PDFReportHeader({
  title,
  subtitle,
  subtitleParts,
  metadataItems,
  logoSrc = PDF_BRANDING.logoSrc,
  centeredLayout = false,
}: PDFReportHeaderProps) {
  if (centeredLayout) {
    // Supervisor-style: Logo absolute-left, title centered spanning full width
    return (
      <div className="pb-2 border-b-2 border-neutral-900 space-y-1.5">
        <div className="relative flex items-center justify-center min-h-[44px] sm:min-h-[50px] w-full">
          {/* Top Left Logo */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center shrink-0">
            <img
              src={logoSrc}
              alt={PDF_BRANDING.logoAlt}
              className="h-9 sm:h-11 w-auto object-contain"
            />
          </div>

          {/* Report Title & Subheading (center-aligned across full width) */}
          <div className="text-center w-full px-20 sm:px-28">
            <h2 className="text-[13px] sm:text-base font-black uppercase text-neutral-900 tracking-wider text-center leading-tight">
              {title}
            </h2>

            {/* Pipe-separated subtitle parts */}
            {subtitleParts && subtitleParts.length > 0 && (
              <div className="text-[10px] sm:text-[11px] font-extrabold uppercase text-neutral-900 tracking-tight pt-0.5 text-center whitespace-nowrap overflow-hidden text-ellipsis flex items-center justify-center gap-2 max-w-full">
                {subtitleParts.map((part, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-neutral-400 font-normal">|</span>}
                    <span>{part}</span>
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Plain subtitle (if no parts) */}
            {!subtitleParts && subtitle && (
              <p className="text-[9.5px] sm:text-[10.5px] text-neutral-600 font-semibold uppercase tracking-tight text-center">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-4 sm:gap-x-5 gap-y-1 text-[9.5px] sm:text-[10px] text-neutral-800 font-medium leading-tight pt-1 border-t border-neutral-200">
          {metadataItems.map((item, idx) => (
            <div key={idx}>
              <strong>{item.label}:</strong> {item.value}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Grid layout: Logo | Title | Spacer (operator/machine style)
  return (
    <div className="pb-2 border-b-2 border-neutral-900 space-y-1.5">
      <div className="grid grid-cols-[110px_1fr_110px] sm:grid-cols-[140px_1fr_140px] items-center gap-2">
        {/* Top Left Logo */}
        <div className="flex items-center justify-start shrink-0">
          <img
            src={logoSrc}
            alt={PDF_BRANDING.logoAlt}
            className="h-10 sm:h-12 w-auto object-contain"
          />
        </div>

        {/* Report Title */}
        <div className="text-center min-w-0">
          <h2 className="text-sm sm:text-base font-black uppercase text-neutral-900 tracking-wider text-center">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[9.5px] sm:text-[10.5px] text-neutral-600 font-semibold uppercase tracking-tight text-center">
              {subtitle}
            </p>
          )}
        </div>

        {/* Right Spacer for Balance */}
        <div className="hidden sm:block w-[110px] sm:w-[140px] shrink-0"></div>
      </div>

      {/* Metadata Strip */}
      <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-4 sm:gap-x-5 gap-y-1 text-[9.5px] sm:text-[10px] text-neutral-800 font-medium leading-tight pt-1 border-t border-neutral-200">
        {metadataItems.map((item, idx) => (
          <div key={idx}>
            <strong>{item.label}:</strong> {item.value}
          </div>
        ))}
      </div>
    </div>
  );
}
