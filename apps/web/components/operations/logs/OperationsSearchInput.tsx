"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";

export interface OperationsSearchInputProps {
  initialValue?: string;
  isSearching?: boolean;
  onSearch: (value: string) => void;
  onExpandFilters?: () => void;
}

export const OperationsSearchInput = React.memo(function OperationsSearchInput({
  initialValue = "",
  isSearching = false,
  onSearch,
  onExpandFilters,
}: OperationsSearchInputProps) {
  const [localValue, setLocalValue] = useState<string>(initialValue);
  const lastCommittedRef = useRef<string>(initialValue);

  // Synchronize when initialValue prop updates externally (e.g., URL query change or filter clear)
  useEffect(() => {
    if (initialValue !== lastCommittedRef.current) {
      lastCommittedRef.current = initialValue;
      setLocalValue(initialValue);
    }
  }, [initialValue]);

  // Debounced search commit (350ms) - only fires onSearch when user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== lastCommittedRef.current) {
        lastCommittedRef.current = localValue;
        onSearch(localValue);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [localValue, onSearch]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setLocalValue("");
      if (lastCommittedRef.current !== "") {
        lastCommittedRef.current = "";
        onSearch("");
      }
    },
    [onSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (localValue !== lastCommittedRef.current) {
          lastCommittedRef.current = localValue;
          onSearch(localValue);
        }
      }
    },
    [localValue, onSearch]
  );

  return (
    <div
      onClick={onExpandFilters}
      className="relative flex-1 min-w-[200px] max-w-none sm:max-w-md lg:max-w-xl mx-0 sm:mx-2"
    >
      {isSearching ? (
        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sky-600 dark:text-sky-400 animate-spin pointer-events-none" />
      ) : (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-mute)] pointer-events-none" />
      )}
      <input
        type="text"
        placeholder="Search machine, operator, remarks, location..."
        value={localValue}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        onChange={(e) => setLocalValue(e.target.value)}
        className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-xs text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-hidden focus:border-sky-500 transition-colors h-8.5"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-[var(--color-canvas-subtle)] text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});
