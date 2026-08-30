"use client";

import { useState, useRef, useEffect, useMemo, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedSearch, AnimatedChevronDown, AnimatedCheck, AnimatedX } from "./animated-icons";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  icon?: ReactNode;
  description?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: ReactNode;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  icon?: ReactNode;
  error?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  label,
  disabled = false,
  clearable = true,
  className = "",
  icon,
  error,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query)) ||
        (opt.group && opt.group.toLowerCase().includes(query))
    );
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
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
      setHighlightedIndex(0);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen && (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ")) {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex(0);
      return;
    }

    if (!isOpen) return;

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearch("");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredOptions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev - 1 < 0 ? Math.max(0, filteredOptions.length - 1) : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
        setSearch("");
      }
    }
  };

  return (
    <div className={`relative flex flex-col gap-1 ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
      {label && (
        <label className="label-sm text-[var(--color-ink)] flex items-center justify-between">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={handleOpenToggle}
        className={`flex items-center justify-between h-9 w-full px-3 rounded-[var(--radius-sm)] border text-left body-md transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-2 ${error
            ? "!border-rose-500 dark:!border-rose-400 !bg-rose-500/5 dark:!bg-rose-500/10 focus:!ring-rose-500/20"
            : isOpen
              ? "border-primary bg-card ring-1 ring-primary text-foreground"
              : "border-border bg-card text-foreground hover:border-muted-foreground/50"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <span className="flex items-center gap-2 text-foreground font-medium truncate">
              {selectedOption.icon || icon}
              {selectedOption.label}
            </span>
          ) : (
            <>
              {icon}
              <span className="text-muted-foreground">{placeholder}</span>
            </>
          )}
        </span>

        <span className="flex items-center gap-1">
          {clearable && selectedOption && selectedOption.value !== "all" && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("all");
              }}
              className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <AnimatedX size={14} />
            </span>
          )}
          <AnimatedChevronDown
            size={14}
            className={`text-muted-foreground transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 form-error-enter">{error}</p>}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute z-50 top-full left-0 right-0 mt-1 card-elevated border border-border bg-card text-card-foreground shadow-lg overflow-hidden max-h-64 flex flex-col"
          >
            {/* Search Input */}
            <div className="p-2 border-b border-border flex items-center gap-2 bg-muted/30">
              <AnimatedSearch size={14} className="text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search..."
                className="w-full bg-transparent text-xs body-md text-foreground focus:outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Options List */}
            <div className="overflow-y-auto p-1 max-h-48 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((option, idx) => {
                  const isSelected = option.value === value;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                        setSearch("");
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[var(--radius-sm)] text-xs text-left transition-colors ${isHighlighted
                          ? "bg-muted text-foreground"
                          : "text-foreground hover:bg-muted/60"
                        } ${isSelected ? "font-semibold text-primary" : ""}`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {option.icon}
                        <span className="truncate">{option.label}</span>
                        {option.description && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            ({option.description})
                          </span>
                        )}
                      </span>
                      {isSelected && <AnimatedCheck size={14} className="text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
