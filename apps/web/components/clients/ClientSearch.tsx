"use client";

import React, { memo, useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X } from "lucide-react";

interface ClientSearchProps {
  initialSearch: string;
  isPending: boolean;
  onSearchChange: (search: string) => void;
  placeholder?: string;
}

/**
 * C8 — High-Performance Client Directory Global Search Input
 * 
 * Features:
 * - 350ms debounced user typing
 * - lastCommittedSearchRef to prevent server transition desync and typing race conditions
 * - Immediate Enter key execution
 * - Immediate clear (X) reset
 * - Loading spinner during in-flight server transitions
 * - Searches across 8 PostgreSQL GIN trigram indexed dimensions:
 *   company name, code, GSTIN, PAN, contact, city, district, state
 */
export const ClientSearch = memo(function ClientSearch({
  initialSearch,
  isPending,
  onSearchChange,
  placeholder = "Search by company name, code, GSTIN, PAN, contact, city, district, state...",
}: ClientSearchProps) {
  const [localSearch, setLocalSearch] = useState(initialSearch);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommittedSearchRef = useRef(initialSearch);

  // Sync with external initialSearch changes (e.g. browser back/forward or clear filters)
  useEffect(() => {
    if (initialSearch !== lastCommittedSearchRef.current) {
      lastCommittedSearchRef.current = initialSearch;
      setLocalSearch(initialSearch);
    }
  }, [initialSearch]);

  // Commit helper to avoid duplicate transitions
  const commitSearch = useCallback(
    (value: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const trimmed = value.trim();
      if (trimmed !== lastCommittedSearchRef.current) {
        lastCommittedSearchRef.current = trimmed;
        onSearchChange(trimmed);
      }
    },
    [onSearchChange]
  );

  // 350ms Debounce effect
  useEffect(() => {
    // If local search matches the committed search, no debounce needed
    if (localSearch.trim() === lastCommittedSearchRef.current) {
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      commitSearch(localSearch);
    }, 350);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localSearch, commitSearch]);

  // Immediate Enter key handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitSearch(localSearch);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setLocalSearch("");
      commitSearch("");
    }
  };

  // Immediate clear button handler
  const handleClear = () => {
    setLocalSearch("");
    commitSearch("");
  };

  return (
    <div className="relative flex-1 min-w-[260px]">
      <label htmlFor="client-directory-search-input" className="sr-only">
        Search Clients
      </label>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-mute)] pointer-events-none"
        aria-hidden="true"
      />
      <input
        id="client-directory-search-input"
        type="text"
        role="searchbox"
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-9 pr-9 py-2 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:bg-[var(--color-canvas-elevated)] focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isPending ? (
          <Loader2 className="h-4 w-4 text-sky-600 animate-spin" aria-label="Searching..." />
        ) : localSearch.length > 0 ? (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer focus:outline-hidden"
            title="Clear search"
            aria-label="Clear search query"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
});
