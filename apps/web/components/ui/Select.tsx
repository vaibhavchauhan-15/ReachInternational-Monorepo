"use client";

import React, { forwardRef, useState, useRef, useEffect, useMemo, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnimatedChevronDown, AnimatedCheck, AnimatedSearch, AnimatedX } from "./animated-icons";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
  icon?: ReactNode;
  description?: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  error?: string;
  hint?: string;
  options?: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement> | any) => void;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options: optionsProp,
      placeholder,
      className = "",
      id,
      name,
      value: valueProp,
      defaultValue,
      disabled = false,
      required = false,
      searchable,
      onChange,
      children,
      ...props
    },
    ref
  ) => {
    const selectId = id || name;
    const containerRef = useRef<HTMLDivElement>(null);
    const hiddenSelectRef = useRef<HTMLSelectElement | null>(null);

    // Extract options from children if options prop is not provided
    const parsedOptions: SelectOption[] = useMemo(() => {
      if (optionsProp && optionsProp.length > 0) {
        return optionsProp;
      }
      if (!children) return [];

      const extracted: SelectOption[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === "option") {
          const props = child.props as any;
          extracted.push({
            value: props.value !== undefined ? String(props.value) : String(props.children || ""),
            label: String(props.children || props.value || ""),
            disabled: !!props.disabled,
          });
        }
      });
      return extracted;
    }, [optionsProp, children]);

    // Internal value state for controlled / uncontrolled mode
    const [internalValue, setInternalValue] = useState<string>(() => {
      if (valueProp !== undefined) return String(valueProp);
      if (defaultValue !== undefined) return String(defaultValue);
      if (placeholder) return "";
      return parsedOptions[0]?.value || "";
    });

    const isControlled = valueProp !== undefined;
    const currentValue = isControlled ? String(valueProp) : internalValue;

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    // Auto-enable search bar if > 6 options or explicitly searchable
    const isSearchable = searchable ?? parsedOptions.length > 6;

    const selectedOption = useMemo(
      () => parsedOptions.find((opt) => opt.value === currentValue),
      [parsedOptions, currentValue]
    );

    const filteredOptions = useMemo(() => {
      if (!searchQuery.trim()) return parsedOptions;
      const query = searchQuery.toLowerCase();
      return parsedOptions.filter(
        (opt) =>
          opt.label.toLowerCase().includes(query) ||
          opt.value.toLowerCase().includes(query) ||
          (opt.description && opt.description.toLowerCase().includes(query))
      );
    }, [parsedOptions, searchQuery]);

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

    const handleSelectOption = (opt: SelectOption) => {
      if (opt.disabled || disabled) return;

      if (!isControlled) {
        setInternalValue(opt.value);
      }

      setIsOpen(false);
      setSearchQuery("");

      if (onChange) {
        // Create synthetic ChangeEvent for HTMLSelectElement compatibility
        const syntheticEvent = {
          target: {
            name: name || "",
            id: selectId || "",
            value: opt.value,
          },
          currentTarget: {
            name: name || "",
            id: selectId || "",
            value: opt.value,
          },
          preventDefault: () => {},
          stopPropagation: () => {},
        } as unknown as React.ChangeEvent<HTMLSelectElement>;

        onChange(syntheticEvent);
      }
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
        setSearchQuery("");
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
          handleSelectOption(filteredOptions[highlightedIndex]);
        }
      }
    };

    return (
      <div className={`flex flex-col gap-1 w-full relative ${className}`} ref={containerRef} onKeyDown={handleKeyDown}>
        {label && (
          <label htmlFor={selectId} className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none flex items-center justify-between">
            <span>{label}</span>
            {required && <span className="text-[10px] text-rose-500 font-bold">* Required</span>}
          </label>
        )}

        {/* Hidden form input for standard form submission / FormData */}
        {name && <input type="hidden" name={name} value={currentValue} />}

        {/* Hidden select for ref forwarded access */}
        <select
          ref={(node) => {
            hiddenSelectRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = node;
          }}
          id={selectId}
          name={name}
          value={currentValue}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {parsedOptions.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Custom Interactive Dropdown Trigger */}
        <div className="relative w-full">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!disabled) setIsOpen((prev) => !prev);
            }}
            className={`w-full h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px] px-3.5 rounded-lg border text-xs sm:text-[13px] font-medium text-[var(--color-ink)] flex items-center justify-between transition-all shadow-2xs ${
              error
                ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                : isOpen
                ? "border-sky-500 dark:border-sky-400 bg-[var(--color-canvas)] ring-2 ring-sky-500/15"
                : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas)] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className="flex items-center gap-2 truncate">
              {selectedOption ? (
                <span className="flex items-center gap-2 text-[var(--color-ink)] truncate font-medium">
                  {selectedOption.icon}
                  {selectedOption.label}
                </span>
              ) : (
                <span className="text-[var(--color-mute)] opacity-75 truncate">
                  {placeholder || "Select option..."}
                </span>
              )}
            </span>

            <AnimatedChevronDown
              size={16}
              className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 ${
                isOpen ? "rotate-180 text-sky-500" : ""
              }`}
            />
          </button>

          {/* Animated Custom Options Popover */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute z-50 top-full left-0 right-0 mt-1.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-2xl overflow-hidden max-h-64 flex flex-col backdrop-blur-md"
              >
                {/* Optional Search Filter Bar */}
                {isSearchable && (
                  <div className="p-2 border-b border-[var(--color-hairline)] flex items-center gap-2 bg-[var(--color-canvas)]/50">
                    <AnimatedSearch size={14} className="text-[var(--color-mute)] shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setHighlightedIndex(0);
                      }}
                      placeholder="Search..."
                      className="w-full bg-transparent text-xs text-[var(--color-ink)] focus:outline-none placeholder:text-[var(--color-mute)]"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-[var(--color-mute)] hover:text-[var(--color-ink)] text-xs p-0.5"
                      >
                        <AnimatedX size={12} />
                      </button>
                    )}
                  </div>
                )}

                {/* Custom Options List */}
                <div className="overflow-y-auto p-1.5 max-h-52 space-y-0.5 custom-scrollbar">
                  {filteredOptions.length === 0 ? (
                    <div className="py-4 text-center text-xs text-[var(--color-mute)]">
                      No matching options found
                    </div>
                  ) : (
                    filteredOptions.map((opt, idx) => {
                      const isSelected = opt.value === currentValue;
                      const isHighlighted = idx === highlightedIndex;

                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={opt.disabled}
                          onClick={() => handleSelectOption(opt)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                            opt.disabled
                              ? "opacity-40 cursor-not-allowed"
                              : isSelected
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-semibold"
                              : isHighlighted
                              ? "bg-[var(--color-canvas)] text-[var(--color-ink)]"
                              : "text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            {opt.icon}
                            <span className="truncate">{opt.label}</span>
                            {opt.description && (
                              <span className="text-[10px] text-[var(--color-mute)] font-normal truncate">
                                ({opt.description})
                              </span>
                            )}
                          </span>
                          {isSelected && (
                            <AnimatedCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0 ml-2" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {error && <p className="body-sm text-[var(--color-error)] mt-0.5">{error}</p>}
        {hint && !error && <p className="body-sm text-[var(--color-mute)] mt-0.5">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const textareaId = id || props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="label-sm text-[var(--color-ink)]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`input-base min-h-[80px] resize-y ${
            error ? "!border-[var(--color-error)]" : ""
          } ${className}`}
          {...props}
        />
        {error && <p className="body-sm text-[var(--color-error)]">{error}</p>}
        {hint && !error && <p className="body-sm text-[var(--color-mute)]">{hint}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";