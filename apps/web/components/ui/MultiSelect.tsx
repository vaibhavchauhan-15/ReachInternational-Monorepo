"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AnimatedChevronDown,
  AnimatedCheck,
  AnimatedSearch,
  AnimatedX,
} from "./animated-icons";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
  icon?: React.ReactNode;
  description?: string;
}

export interface MultiSelectProps {
  label?: string;
  error?: string;
  hint?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  required?: boolean;
  maxDisplayChips?: number;
  className?: string;
  id?: string;
  name?: string;
}

export function MultiSelect({
  label,
  error,
  hint,
  options,
  value = [],
  onChange,
  placeholder = "Select multiple options...",
  searchable = true,
  disabled = false,
  required = false,
  maxDisplayChips = 3,
  className = "",
  id,
  name,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const selectId = id || name;

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query))
    );
  }, [options, searchQuery]);

  const selectedOptions = useMemo(
    () => options.filter((opt) => value.includes(opt.value)),
    [options, value]
  );

  // Outside click dismissal
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleOption = (optValue: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (disabled) return;

    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allEnabledValues = options.filter((opt) => !opt.disabled).map((opt) => opt.value);
    onChange(allEnabledValues);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleRemoveChip = (optValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optValue));
  };

  return (
    <div className={`flex flex-col gap-1 w-full relative ${className}`} ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={selectId}
            className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none"
          >
            {label}
            {required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>

          {value.length > 0 && (
            <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
              {value.length} selected
            </span>
          )}
        </div>
      )}

      {/* Hidden input for standard forms */}
      {name && <input type="hidden" name={name} value={value.join(",")} />}

      {/* Trigger Button */}
      <button
        type="button"
        id={selectId}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full min-h-[42px] sm:min-h-[44px] px-3 py-1.5 rounded-lg border text-xs sm:text-[13px] font-medium text-[var(--color-ink)] flex items-center justify-between gap-2 transition-all shadow-2xs ${
          error
            ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
            : isOpen
            ? "border-sky-500 dark:border-sky-400 bg-[var(--color-canvas)] ring-2 ring-sky-500/15"
            : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas)] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedOptions.length === 0 ? (
            <span className="text-[var(--color-mute)] opacity-75 truncate">
              {placeholder}
            </span>
          ) : (
            <>
              {selectedOptions.slice(0, maxDisplayChips).map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[11px] font-semibold border border-sky-500/20"
                >
                  <span className="truncate max-w-[120px]">{opt.label}</span>
                  <span
                    role="button"
                    onClick={(e) => handleRemoveChip(opt.value, e)}
                    className="hover:text-rose-500 transition-colors p-0.5"
                    title={`Remove ${opt.label}`}
                  >
                    <AnimatedX size={11} />
                  </span>
                </span>
              ))}
              {selectedOptions.length > maxDisplayChips && (
                <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] text-[11px] font-bold">
                  +{selectedOptions.length - maxDisplayChips} more
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value.length > 0 && !disabled && (
            <span
              role="button"
              onClick={handleClearAll}
              className="p-1 rounded hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-rose-500 transition-colors"
              title="Clear all selected"
            >
              <AnimatedX size={13} />
            </span>
          )}
          <AnimatedChevronDown
            size={16}
            className={`text-[var(--color-mute)] transition-transform duration-200 ${
              isOpen ? "rotate-180 text-sky-500" : ""
            }`}
          />
        </div>
      </button>

      {/* Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xl overflow-hidden max-h-72 flex flex-col backdrop-blur-md"
          >
            {/* Search and Action Bar */}
            <div className="p-2 border-b border-[var(--color-hairline)] flex flex-col gap-2 bg-[var(--color-canvas)]/50">
              {searchable && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
                  <AnimatedSearch size={13} className="text-[var(--color-mute)] shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search options..."
                    className="w-full bg-transparent text-xs text-[var(--color-ink)] focus:outline-none placeholder:text-[var(--color-mute)]"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-[var(--color-mute)] hover:text-[var(--color-ink)] text-xs"
                    >
                      <AnimatedX size={12} />
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-mute)] px-1">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="hover:text-rose-500 cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto p-1.5 max-h-48 space-y-0.5 custom-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-[var(--color-mute)]">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = value.includes(opt.value);

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={(e) => handleToggleOption(opt.value, e)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                        opt.disabled
                          ? "opacity-40 cursor-not-allowed"
                          : isSelected
                          ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                          : "text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? "bg-sky-600 border-sky-600 text-white"
                              : "border-[var(--color-hairline)] bg-[var(--color-canvas)]"
                          }`}
                        >
                          {isSelected && <AnimatedCheck size={11} />}
                        </div>
                        {opt.icon}
                        <span className="truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="text-[10px] text-[var(--color-mute)] font-normal truncate">
                            ({opt.description})
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-[11px] sm:text-xs font-medium text-rose-500 dark:text-rose-400 mt-0.5 flex items-center gap-1 form-error-enter">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-[11px] text-[var(--color-mute)] mt-0.5">{hint}</p>
      )}
    </div>
  );
}
