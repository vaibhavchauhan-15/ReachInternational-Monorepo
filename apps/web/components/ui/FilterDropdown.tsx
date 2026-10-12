"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Search, X } from "lucide-react";
import { AnimatedCheck } from "./animated-icons";

export interface FilterDropdownOption {
  value?: string;
  id?: string;
  label: string;
  dotColor?: string; // Tailwind background class, e.g. "bg-emerald-500"
  icon?: React.ReactNode;
  count?: number;
  activeColor?: string;
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
  searchable?: boolean;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
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
  searchable,
  searchPlaceholder,
  icon,
  ariaLabel,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const getOptionKey = (opt?: FilterDropdownOption) => opt?.value ?? opt?.id ?? "";

  const selectedOption =
    options.find((opt) => getOptionKey(opt) === value) || options[0];

  const hasSearch =
    searchable !== undefined ? searchable : options.length > 5;

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase().trim();
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, searchTerm]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen && hasSearch) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen, hasSearch]);

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

  const firstOptionKey = getOptionKey(options[0]);
  const isFiltered = value !== "" && value !== "all" && value !== firstOptionKey;

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
          compact ? "h-8 px-2.5" : "h-11 sm:h-9 px-3"
        } ${
          isFiltered
            ? "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/20"
            : isOpen
            ? "border-sky-500 bg-[var(--color-canvas)] text-[var(--color-ink)] ring-2 ring-sky-500/15"
            : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:border-[#0284c7]/40 dark:hover:border-[#0284c7]/40 [html:not(.dark)_&]:hover:border-[#0284c7]/40"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || `${label} filter`}
      >
        <div className="flex items-center gap-1.5 truncate min-w-0">
          <span className="text-[var(--color-mute)] font-medium shrink-0">{label}:</span>
          {selectedOption?.dotColor && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${selectedOption.dotColor}`} />
          )}
          {selectedOption?.icon}
          <span
            className={`truncate font-semibold ${
              isFiltered
                ? selectedOption?.activeColor || "text-[#0284c7] dark:text-sky-400"
                : "text-[var(--color-ink)]"
            }`}
          >
            {selectedOption?.label || label}
          </span>
          {selectedOption?.count !== undefined && (
            <span className="text-[10px] text-[var(--color-mute)] font-mono">
              ({selectedOption.count})
            </span>
          )}
        </div>

        {icon ? (
          React.isValidElement(icon) ? (
            React.cloneElement(icon as React.ReactElement<any>, {
              size: (icon as any).props?.size ?? 13,
              className: `shrink-0 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-sky-500" : "text-[var(--color-mute)]"
              } ${(icon as any).props?.className || ""}`,
            })
          ) : (
            icon
          )
        ) : (
          <ChevronDown
            size={13}
            className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ml-1 ${
              isOpen ? "rotate-180 text-sky-500" : ""
            }`}
          />
        )}
      </button>

      {/* Animated Floating Popover Listbox */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute top-full mt-1.5 min-w-[200px] sm:min-w-[220px] max-w-[calc(100vw-24px)] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xl p-1 max-h-64 overflow-y-auto custom-scrollbar backdrop-blur-md z-50 ${
              align === "right" ? "right-0 left-auto" : "left-0 right-auto"
            } ${dropdownClassName}`}
            role="listbox"
          >
            {/* Sticky Static Search Box at top with full interactivity */}
            {hasSearch && (
              <div
                className="sticky top-0 z-20 bg-[var(--color-canvas-elevated)] p-1 pb-1.5 mb-1 border-b border-[var(--color-hairline)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative flex items-center">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)] pointer-events-none"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Escape") {
                        setIsOpen(false);
                      }
                    }}
                    placeholder={searchPlaceholder || `Search ${label.toLowerCase()}...`}
                    className="w-full h-8 pl-8 pr-7 text-xs rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm("");
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-4 px-2 text-center text-xs text-[var(--color-mute)] italic">
                No matching {label.toLowerCase()} found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const optKey = getOptionKey(opt);
                const isSelected = optKey === value;

                return (
                  <button
                    key={optKey || opt.label}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(optKey);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer min-h-[36px] ${
                      isSelected
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                        : "text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:bg-[var(--color-hairline-soft-surface)]"
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
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
