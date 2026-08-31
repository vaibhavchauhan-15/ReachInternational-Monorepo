"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedChevronDown, AnimatedCheck } from "./animated-icons";

export interface FilterDropdownOption {
  value: string;
  label: string;
  dotColor?: string; // Tailwind background class, e.g. "bg-emerald-500"
  icon?: React.ReactNode;
  count?: number;
}

export interface FilterDropdownProps {
  label: string;
  options: FilterDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  align?: "left" | "right";
  compact?: boolean;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
}

export function FilterDropdown({
  label,
  options,
  value,
  onChange,
  align = "left",
  compact = false,
  disabled = false,
  className = "",
  dropdownClassName = "",
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  // Outside click & touch dismissal
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isOpen]);

  // Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const isFiltered = value !== "" && value !== "all" && value !== options[0]?.value;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${isOpen ? "z-40" : "z-10"} ${className}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-1.5 rounded-lg border text-xs font-semibold select-none transition-all cursor-pointer shadow-2xs ${
          compact ? "h-8 px-2.5" : "h-[38px] sm:h-9 px-3"
        } ${
          isFiltered
            ? "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/20"
            : isOpen
            ? "border-sky-500 bg-[var(--color-canvas)] text-[var(--color-ink)] ring-2 ring-sky-500/15"
            : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-[var(--color-mute)] font-normal shrink-0">{label}:</span>
          {selectedOption?.dotColor && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${selectedOption.dotColor}`} />
          )}
          {selectedOption?.icon}
          <span className="truncate font-semibold text-[var(--color-ink)]">
            {selectedOption?.label || label}
          </span>
          {selectedOption?.count !== undefined && (
            <span className="text-[10px] text-[var(--color-mute)] font-mono">
              ({selectedOption.count})
            </span>
          )}
        </div>

        <AnimatedChevronDown
          size={13}
          className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ml-1 ${
            isOpen ? "rotate-180 text-sky-500" : ""
          }`}
        />
      </button>

      {/* Animated Floating Popover Listbox */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute top-full mt-1.5 min-w-[200px] sm:min-w-[220px] max-w-[calc(100vw-24px)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xl p-1.5 space-y-0.5 max-h-64 overflow-y-auto custom-scrollbar backdrop-blur-md z-50 ${
              align === "right" ? "right-0 left-auto" : "left-0 right-auto"
            } ${dropdownClassName}`}
            role="listbox"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer min-h-[36px] ${
                    isSelected
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                      : "text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.dotColor && (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dotColor}`} />
                    )}
                    {opt.icon}
                    <span className="truncate">{opt.label}</span>
                    {opt.count !== undefined && (
                      <span className="text-[10px] text-[var(--color-mute)] font-mono font-normal">
                        ({opt.count})
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
