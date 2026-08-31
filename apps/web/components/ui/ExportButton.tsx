"use client";

import React, { forwardRef } from "react";
import { FileSpreadsheet, FileText, Printer, Download } from "lucide-react";
import { Button, ButtonProps } from "./Button";
import { TooltipWrapper } from "./tooltip";

export type ExportFormat = "xlsx" | "csv" | "pdf" | "print" | "generic";

export interface ExportButtonProps extends Omit<ButtonProps, "icon"> {
  /** The export format */
  format?: ExportFormat;
  /** Custom label, e.g. "Export", "Export Excel", "Download CSV" */
  label?: string;
  /** Tooltip hover text */
  tooltip?: string;
  /** Responsive mode: when true, collapses to icon-only on mobile screens <= 640px */
  responsive?: boolean;
  /** If true, always renders as a compact square icon-only button */
  iconOnly?: boolean;
  /** Custom icon override */
  icon?: React.ReactNode;
}

export const ExportButton = forwardRef<HTMLButtonElement, ExportButtonProps>(
  (
    {
      format = "xlsx",
      label,
      tooltip,
      responsive = true,
      iconOnly = false,
      icon,
      variant = "secondary",
      className = "",
      onClick,
      ...props
    },
    ref
  ) => {
    const configMap: Record<ExportFormat, { icon: React.ReactNode; defaultLabel: string; defaultTooltip: string }> = {
      xlsx: {
        icon: <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />,
        defaultLabel: "Export Excel",
        defaultTooltip: "Export to Excel (.xlsx)",
      },
      csv: {
        icon: <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />,
        defaultLabel: "Export CSV",
        defaultTooltip: "Export to CSV (.csv)",
      },
      pdf: {
        icon: <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />,
        defaultLabel: "Export PDF",
        defaultTooltip: "Export to PDF (.pdf)",
      },
      print: {
        icon: <Printer className="h-4 w-4 text-[var(--color-ink)] shrink-0" />,
        defaultLabel: "Print",
        defaultTooltip: "Print document",
      },
      generic: {
        icon: <Download className="h-4 w-4 text-[var(--color-ink)] shrink-0" />,
        defaultLabel: "Export",
        defaultTooltip: "Export data",
      },
    };

    const currentConfig = configMap[format];
    const effectiveIcon = icon || currentConfig.icon;
    const effectiveLabel = label || currentConfig.defaultLabel;
    const effectiveTooltip = tooltip || currentConfig.defaultTooltip;

    // Icon only mode styling
    if (iconOnly) {
      return (
        <TooltipWrapper content={effectiveTooltip} side="top">
          <Button
            ref={ref as any}
            size="icon"
            variant={variant}
            onClick={onClick}
            aria-label={effectiveTooltip}
            className={`h-9 w-9 p-0 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] shadow-xs flex items-center justify-center cursor-pointer active:scale-[0.98] transition-all ${className}`}
            {...props}
          >
            {effectiveIcon}
          </Button>
        </TooltipWrapper>
      );
    }

    return (
      <TooltipWrapper content={effectiveTooltip} side="top">
        <Button
          ref={ref as any}
          variant={variant}
          icon={effectiveIcon}
          responsive={responsive}
          onClick={onClick}
          className={`h-9 px-3 sm:px-3.5 text-xs font-semibold whitespace-nowrap ${className}`}
          {...props}
        >
          {effectiveLabel}
        </Button>
      </TooltipWrapper>
    );
  }
);

ExportButton.displayName = "ExportButton";
