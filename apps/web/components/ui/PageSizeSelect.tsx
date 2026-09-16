"use client";

import { useState, useRef, useEffect, memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronUp } from "lucide-react";

export interface PageSizeSelectProps {
  value: number;
  onChange: (pageSize: number) => void;
  options?: number[];
  className?: string;
  ariaLabel?: string;
}

/**
 * Reusable, accessible custom dropdown for selecting pagination row size.
 * Styled with Vercel Geist design tokens and pops upward by default for table footers.
 */
export const PageSizeSelect = memo(function PageSizeSelect({
  value,
  onChange,
  options = [10, 25, 50, 100],
  className = "",
  ariaLabel = "Select rows per page",
}: PageSizeSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="h-8 sm:h-7 px-2 sm:px-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-xs text-[var(--color-ink)] font-mono font-medium flex items-center justify-between gap-1.5 transition-all cursor-pointer select-none active:scale-[0.98] shadow-2xs focus:outline-none focus:border-[var(--color-ink)]"
      >
        <span>{value}</span>
        <ChevronUp
          className={`h-3 w-3 text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
            open ? "rotate-180 text-[var(--color-ink)]" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="listbox"
            aria-label={ariaLabel}
            className="absolute bottom-full mb-1.5 left-0 z-50 min-w-[100px] overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1 shadow-xl"
          >
            <div className="px-2 py-1 text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider border-b border-[var(--color-hairline)] mb-1">
              Rows / page
            </div>
            <div className="flex flex-col gap-0.5">
              {options.map((opt) => {
                const isSelected = opt === value;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    className={`w-full min-h-[30px] flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium text-left transition-all cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? "bg-[var(--color-ink)] text-[var(--color-canvas)] font-bold shadow-xs"
                        : "text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
                    }`}
                  >
                    <span>{opt} rows</span>
                    {isSelected && <Check className="h-3 w-3 shrink-0 ml-1.5" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
