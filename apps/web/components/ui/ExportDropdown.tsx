"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileSpreadsheet, FileText, Printer, ChevronDown } from "lucide-react";
import { Button } from "./Button";

export interface ExportDropdownProps {
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onExportPDF?: () => void;
  onPrint?: () => void;
  loading?: boolean;
  label?: string;
  align?: "left" | "right";
  className?: string;
}

export function ExportDropdown({
  onExportExcel,
  onExportCSV,
  onExportPDF,
  onPrint,
  loading = false,
  label = "Export",
  align = "right",
  className = "",
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleAction = (fn?: () => void) => {
    if (fn) {
      fn();
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <Button
        variant="secondary"
        size="md"
        loading={loading}
        icon={<Download className="h-4 w-4 text-[var(--color-ink)] shrink-0" />}
        trailingIcon={
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          />
        }
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-9 px-3 text-xs font-semibold whitespace-nowrap"
      >
        {label}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute top-full mt-1.5 min-w-[180px] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1.5 shadow-2xl space-y-0.5 z-50 backdrop-blur-md ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {onExportExcel && (
              <button
                type="button"
                onClick={() => handleAction(onExportExcel)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Export Excel (.xlsx)</span>
              </button>
            )}

            {onExportCSV && (
              <button
                type="button"
                onClick={() => handleAction(onExportCSV)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left"
              >
                <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>Export CSV (.csv)</span>
              </button>
            )}

            {onExportPDF && (
              <button
                type="button"
                onClick={() => handleAction(onExportPDF)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left"
              >
                <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Export PDF (.pdf)</span>
              </button>
            )}

            {onPrint && (
              <button
                type="button"
                onClick={() => handleAction(onPrint)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left border-t border-[var(--color-hairline)] mt-1 pt-1.5"
              >
                <Printer className="h-4 w-4 text-[var(--color-ink)] shrink-0" />
                <span>Print Document</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
