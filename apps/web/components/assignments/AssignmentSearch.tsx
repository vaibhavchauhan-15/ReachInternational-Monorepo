"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AssignmentSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  totalCount?: number;
  filteredCount?: number;
  isLoading?: boolean;
  debounceMs?: number;
  className?: string;
  autoFocus?: boolean;
}

export function AssignmentSearch({
  value,
  onChange,
  placeholder = "Search candidates by name, employee ID, phone...",
  totalCount,
  filteredCount,
  isLoading = false,
  debounceMs = 250,
  className,
  autoFocus = false,
}: AssignmentSearchProps) {
  const [internalValue, setInternalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync incoming value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Debounce notification to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      if (internalValue !== value) {
        onChange(internalValue);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [internalValue, value, onChange, debounceMs]);

  const handleClear = () => {
    setInternalValue("");
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative flex items-center w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-mute)]">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={internalValue}
          onChange={(e) => setInternalValue(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full h-10 pl-9 pr-8 text-xs sm:text-sm rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all"
          aria-label={placeholder}
        />
        {internalValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            aria-label="Clear search input"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {(totalCount !== undefined || filteredCount !== undefined) && (
        <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)] px-0.5">
          <span>
            {filteredCount !== undefined && totalCount !== undefined
              ? `Showing ${filteredCount} of ${totalCount}`
              : totalCount !== undefined
              ? `${totalCount} available`
              : `${filteredCount} results`}
          </span>
          {internalValue && (
            <span className="font-mono text-[10px] text-[var(--color-primary)]">
              Filtered by &ldquo;{internalValue}&rdquo;
            </span>
          )}
        </div>
      )}
    </div>
  );
}
