"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import {
  AnimatedChevronDown,
  AnimatedCheck,
  AnimatedX,
} from "./animated-icons";
import { Search } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  icon?: ReactNode;
  description?: string;
  badge?: string;
  badgeClassName?: string;
}

export interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string, option?: SelectOption | null) => void;
  placeholder?: string;
  label?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  allowAll?: boolean;
  allLabel?: string;
  compact?: boolean;
  className?: string;
  triggerClassName?: string;
  icon?: ReactNode;
  error?: string;
}

export function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Select option...",
  label,
  disabled = false,
  required = false,
  clearable = false,
  allowAll = false,
  allLabel = "All",
  compact = false,
  className = "",
  triggerClassName = "",
  icon,
  error,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isAllSelected = allowAll && (value === "all" || value === "");

  const selectedOption = useMemo(() => {
    if (isAllSelected) return null;
    return options.find((opt) => opt.value === value) || null;
  }, [options, value, isAllSelected]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query)) ||
        (opt.group && opt.group.toLowerCase().includes(query)) ||
        (opt.badge && opt.badge.toLowerCase().includes(query))
    );
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpenToggle = () => {
    if (disabled) return;
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  };

  const handleSelect = (val: string) => {
    if (val === "all") {
      onChange("all", null);
    } else {
      const opt = options.find((o) => o.value === val) || null;
      onChange(val, opt);
    }
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(allowAll ? "all" : "", null);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearch("");
    }
  };

  return (
    <div
      className={`relative flex flex-col gap-1 w-full ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="block text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] mb-1 flex items-center justify-between select-none">
          <span>
            {label} {required && <span className="text-rose-500 font-semibold">*</span>}
          </span>
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpenToggle}
        className={`w-full px-3 sm:px-3.5 rounded-lg border text-xs sm:text-[13px] font-medium text-[var(--color-ink)] flex items-center justify-between transition-all shadow-2xs ${
          compact ? "h-[38px] min-h-[38px] py-1.5" : "h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px]"
        } ${
          error
            ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
            : isOpen
            ? "border-sky-500 dark:border-sky-400 bg-[var(--color-canvas)] ring-2 ring-sky-500/15"
            : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas)] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${triggerClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate flex items-center gap-2 pr-1">
          {isAllSelected ? (
            <span className="font-bold text-[var(--color-ink)] flex items-center gap-2">
              <span>{allLabel}</span>
              <span className="px-1.5 py-0.5 rounded bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] font-mono text-[10px]">
                {options.length} Total
              </span>
            </span>
          ) : selectedOption ? (
            <>
              {selectedOption.icon || icon}
              <span className="truncate font-bold">
                {selectedOption.label}
              </span>
              {selectedOption.badge && (
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                    selectedOption.badgeClassName ||
                    "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  }`}
                >
                  {selectedOption.badge}
                </span>
              )}
              {!compact && selectedOption.description && (
                <span className="text-[10px] text-[var(--color-mute)] truncate hidden md:inline">
                  ({selectedOption.description})
                </span>
              )}
            </>
          ) : (
            <>
              {icon}
              <span className="text-[var(--color-mute)] font-normal">{placeholder}</span>
            </>
          )}
        </span>

        <span className="flex items-center gap-1.5 shrink-0">
          {clearable && selectedOption && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
            >
              <AnimatedX size={12} />
            </span>
          )}
          <AnimatedChevronDown
            size={16}
            className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-sky-500" : ""
            }`}
          />
        </span>
      </button>

      {error && (
        <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
          {error}
        </p>
      )}

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xl overflow-hidden max-h-72 flex flex-col backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-[var(--color-hairline)] flex items-center gap-2 bg-[var(--color-canvas)]">
            <Search className="h-3.5 w-3.5 text-[var(--color-mute)] shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-transparent text-xs text-[var(--color-ink)] focus:outline-none placeholder:text-[var(--color-mute)] py-1"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[var(--color-mute)] hover:text-[var(--color-ink)] p-1 cursor-pointer"
              >
                <AnimatedX size={12} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {allowAll && !search.trim() && (
              <button
                type="button"
                onClick={() => handleSelect("all")}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                  isAllSelected
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                    : "hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold">{allLabel}</span>
                  <span className="text-[10px] text-[var(--color-mute)] font-mono">
                    ({options.length} options)
                  </span>
                </div>
                {isAllSelected && (
                  <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                )}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-[var(--color-mute)]">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                        : "hover:bg-[var(--color-canvas)] text-[var(--color-ink)]"
                    }`}
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="font-bold flex items-center gap-2 truncate">
                        {opt.icon}
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${
                              opt.badgeClassName || "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                            }`}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.description && (
                        <div className="text-[10px] text-[var(--color-mute)] truncate mt-0.5">
                          {opt.description}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
