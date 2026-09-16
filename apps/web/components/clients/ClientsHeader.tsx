"use client";

import React, { memo, useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet,
  FileText,
  Printer,
} from "lucide-react";
import {
  AnimatedPlus,
  AnimatedRefresh,
} from "@/components/ui/animated-icons";
import { PageHeader, Button, ExportButton } from "@/components/ui";

interface ClientsHeaderProps {
  canManageClients: boolean;
  totalClients?: number;
  isExporting?: boolean;
  onOpenAddModal: () => void;
  onOpenExportModal?: () => void;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  onRefresh?: () => void;
}

const HeaderMoreMenu = memo(function HeaderMoreMenu({
  canManage,
  onExportExcel,
  onExportCSV,
  onExportPDF,
  onRefresh,
}: {
  canManage: boolean;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; openUpwards: boolean }>({
    top: 0,
    left: 0,
    openUpwards: false,
  });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 208;
    const menuHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const shouldOpenUpwards = spaceBelow < menuHeight + 16;

    let leftPos = rect.right - menuWidth;
    if (leftPos < 12) leftPos = 12;
    if (leftPos + menuWidth > window.innerWidth - 12) {
      leftPos = window.innerWidth - menuWidth - 12;
    }

    let topPos = shouldOpenUpwards ? rect.top - menuHeight - 4 : rect.bottom + 4;
    if (topPos < 12) topPos = 12;

    setCoords({
      top: topPos,
      left: leftPos,
      openUpwards: shouldOpenUpwards,
    });
  }, []);

  const toggleOpen = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!open) {
        updatePosition();
      }
      setOpen((prev) => !prev);
    },
    [open, updatePosition]
  );

  useEffect(() => {
    if (!open) return;

    const handleScrollOrResize = () => {
      updatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className="h-9 w-9 sm:w-auto p-0 sm:px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 shrink-0"
        title="More options"
      >
        <span className="font-bold text-sm leading-none">⋮</span>
        <span className="hidden sm:inline">More</span>
      </button>

      {mounted &&
        open &&
        createPortal(
          <AnimatePresence>
            <div className="fixed inset-0 z-50 pointer-events-none">
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: coords.openUpwards ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: coords.openUpwards ? 4 : -4 }}
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
                style={{
                  position: "fixed",
                  top: `${coords.top}px`,
                  left: `${coords.left}px`,
                  width: "208px",
                }}
                className="pointer-events-auto z-50 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1.5 shadow-xl text-xs space-y-0.5"
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onExportExcel();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Export Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onExportCSV();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                >
                  <FileText size={15} className="text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>Export CSV (.csv)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onExportPDF();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                >
                  <Printer size={15} className="text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>PDF Report / Print</span>
                </button>

                <div className="my-1 border-t border-[var(--color-hairline)]" />

                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onRefresh();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                >
                  <AnimatedRefresh size={15} className="text-amber-500 shrink-0" />
                  <span>Refresh Data</span>
                </button>
              </motion.div>
            </div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
});

export const ClientsHeader = memo(function ClientsHeader({
  canManageClients,
  totalClients,
  isExporting = false,
  onOpenAddModal,
  onOpenExportModal,
  onExportExcel = onOpenExportModal || (() => {}),
  onExportCSV = onOpenExportModal || (() => {}),
  onExportPDF = () => {
    if (typeof window !== "undefined") window.print();
  },
  onRefresh = () => {
    if (typeof window !== "undefined") window.location.reload();
  },
}: ClientsHeaderProps) {
  return (
    <PageHeader
      title="Client Directory"
      breadcrumbs={[{ label: "Clients" }]}
      actions={
        <div className="flex items-center gap-2">
          <ExportButton
            format="xlsx"
            iconOnly
            loading={isExporting}
            onClick={onExportExcel}
            tooltip="Export client directory to Excel (.xlsx)"
          />

          <HeaderMoreMenu
            canManage={canManageClients}
            onExportExcel={onExportExcel}
            onExportCSV={onExportCSV}
            onExportPDF={onExportPDF}
            onRefresh={onRefresh}
          />

          {canManageClients && (
            <Button
              variant="primary"
              icon={<AnimatedPlus size={15} />}
              responsive
              onClick={onOpenAddModal}
              className="h-9 px-3.5 sm:px-4 text-xs font-semibold whitespace-nowrap"
            >
              Add Client
            </Button>
          )}
        </div>
      }
    />
  );
});
