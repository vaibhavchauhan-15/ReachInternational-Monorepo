"use client";

import React from "react";
import { Button } from "@/components/ui";
import { Download } from "lucide-react";

export interface OperationsHeaderProps {
  onOpenPrintModal?: () => void;
  title?: string;
}

export const OperationsHeader = React.memo(function OperationsHeader({
  onOpenPrintModal,
  title = "Fleet Operations",
}: OperationsHeaderProps) {
  return (
    <div className="hidden md:flex items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold text-[var(--color-ink)]">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onOpenPrintModal && (
          <Button
            variant="ghost"
            onClick={onOpenPrintModal}
            icon={<Download size={14} className="w-3.5 h-3.5 shrink-0 text-sky-500" />}
            className="h-9 px-3.5 font-bold inline-flex flex-row items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap cursor-pointer shadow-xs border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
            title="Export Report"
            aria-label="Export Report"
          >
            Export Report
          </Button>
        )}
      </div>
    </div>
  );
});
