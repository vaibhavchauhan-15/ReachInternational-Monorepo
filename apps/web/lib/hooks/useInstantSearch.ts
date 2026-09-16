"use client";

import { useState, useMemo, useCallback, useRef, useEffect, type ReactNode } from "react";
import {
  buildSearchIndex,
  searchIndexedItems,
  type SearchOptions,
} from "@reachinternational/utils";
import { highlightText } from "@/components/ui/Highlight";

export interface UseInstantSearchOptions<T> {
  /**
   * The paginated items currently rendered by RSC or server pagination.
   * Used as the display items when no search query is active.
   */
  initialItems: T[];

  /**
   * Extractor function that returns the search fields for an item (for Client mode).
   * e.g. (user) => [user.full_name, user.email, user.phone, user.role]
   */
  extractSearchFields: (item: T) => (string | number | null | undefined)[];

  /**
   * Optional Server Action or API caller to fetch the full unpaginated dataset
   * for the active filter scope (used in Client mode when dataset <= scaleThreshold).
   */
  fetchFullDataset?: () => Promise<T[]>;

  /**
   * Server-side search caller for large scale (100,000+ items).
   * Queries PostgreSQL using GIN Trigram indexes, returning top matching items (e.g. LIMIT 50).
   * Supports AbortSignal to cancel in-flight requests on new keystrokes.
   */
  fetchServerSearch?: (query: string, signal?: AbortSignal) => Promise<T[]>;

  /**
   * Total count of records in this directory. Used by "adaptive" mode to decide
   * between Client In-Memory (<1ms) and Server-Side GIN Trigram (100k scale).
   */
  totalCount?: number;

  /**
   * Operating Mode:
   * - "adaptive" (default): Auto-switches between Client Mode (<= scaleThreshold)
   *   and Server Mode (> scaleThreshold).
   * - "client": Always load full dataset into memory (<1ms per keystroke).
   * - "server": Always query database on debounced input (optimized for 100,000+ records).
   */
  mode?: "client" | "server" | "adaptive";

  /**
   * Threshold to switch from Client to Server mode in adaptive mode.
   * Defaults to 1,500 items. Datasets above 1,500 will not download to memory.
   */
  scaleThreshold?: number;

  /**
   * Cache key representing active server-side filters (e.g. "role=operator&status=active").
   * When this key changes, cached data is invalidated and refetched.
   */
  filterKey?: string;

  /**
   * Whether to prefetch the full dataset in the background on mount / filterKey change (Client mode).
   * Defaults to true so that the first keystroke is 0ms instant.
   */
  prefetch?: boolean;

  /**
   * Debounce delay in milliseconds for server search mode. Defaults to 200ms.
   */
  debounceMs?: number;

  /**
   * Search algorithm matching options (default: AND semantics, numeric digit matching).
   */
  searchOptions?: SearchOptions;
}

export interface UseInstantSearchResult<T> {
  /** Current search input value */
  searchTerm: string;
  /** Set search term directly */
  setSearchTerm: (term: string) => void;
  /** Input onChange handler (accepts raw string or React change event) */
  onSearchChange: (val: string | React.ChangeEvent<HTMLInputElement>) => void;
  /** Form onSubmit handler (prevents default; search is instant so no-op) */
  onSubmitSearch: (e?: React.FormEvent) => void;
  /** Clear search input */
  resetSearch: () => void;
  /** Whether search query is non-empty */
  isSearchActive: boolean;
  /** Whether background or on-demand search query is in progress */
  isSearchLoading: boolean;
  /** Search matching items */
  filteredItems: T[];
  /** Items to render: `filteredItems` when searching, `initialItems` when not searching */
  displayItems: T[];
  /** Total matching items count */
  totalCount: number;
  /** Total pages to display in table/pagination: 1 when searching (pagination disabled) */
  searchTotalPages: number;
  /** Pre-bound highlight helper for this search term */
  highlight: (text: string | null | undefined, matchClassName?: string) => ReactNode;
  /** Optimistic update helper: update a specific item across both datasets */
  mutateItem: (id: string, updater: (prev: T) => T) => void;
  /** Optimistic delete helper: remove a specific item from both datasets */
  removeItem: (id: string) => void;
  /** Active execution mode ("client" for small/medium, "server" for 100k+ scale) */
  activeMode: "client" | "server";
  /** Manually trigger refetch of the full dataset (Client mode) */
  refetchFullDataset: () => Promise<void>;
  /** The full dataset currently in memory (null in server mode) */
  fullDataset: T[] | null;
}

export function useInstantSearch<T extends { id?: string | number }>({
  initialItems,
  extractSearchFields,
  fetchFullDataset,
  fetchServerSearch,
  totalCount: providedTotalCount,
  mode = "adaptive",
  scaleThreshold = 1500,
  filterKey = "",
  prefetch = true,
  debounceMs = 200,
  searchOptions,
}: UseInstantSearchOptions<T>): UseInstantSearchResult<T> {
  const [searchTerm, setSearchTerm] = useState("");
  const [fullDataset, setFullDataset] = useState<T[] | null>(null);
  const [serverResults, setServerResults] = useState<T[] | null>(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // Determine active mode: if records exceed threshold and server search is provided, use Server mode
  const effectiveCount = providedTotalCount ?? initialItems.length;
  const activeMode: "client" | "server" = useMemo(() => {
    if (mode === "server") return "server";
    if (mode === "client") return "client";
    // Adaptive mode:
    if (fetchServerSearch && effectiveCount > scaleThreshold) {
      return "server";
    }
    return "client";
  }, [mode, fetchServerSearch, effectiveCount, scaleThreshold]);

  const isFetchingRef = useRef(false);
  const cacheRef = useRef<{ data: T[]; filterKey: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Invalidate cache when external filter key changes
  useEffect(() => {
    cacheRef.current = null;
    setFullDataset(null);
    setServerResults(null);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [filterKey]);

  // Clean up timers and in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // -------------------------------------------------------------------------
  // 1. Client Mode: Fetch full dataset for in-memory indexing (<= scaleThreshold)
  // -------------------------------------------------------------------------
  const loadFullDataset = useCallback(async () => {
    if (activeMode !== "client" || !fetchFullDataset || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsSearchLoading(true);

    try {
      const data = await fetchFullDataset();
      cacheRef.current = { data, filterKey };
      setFullDataset(data);
    } catch (err) {
      console.error("[useInstantSearch] Failed to fetch full dataset:", err);
    } finally {
      setIsSearchLoading(false);
      isFetchingRef.current = false;
    }
  }, [activeMode, fetchFullDataset, filterKey]);

  // Background prefetch in Client Mode
  useEffect(() => {
    if (
      activeMode === "client" &&
      prefetch &&
      fetchFullDataset &&
      !cacheRef.current &&
      !isFetchingRef.current
    ) {
      loadFullDataset();
    }
  }, [activeMode, prefetch, fetchFullDataset, loadFullDataset, filterKey]);

  // -------------------------------------------------------------------------
  // 2. Server Mode: Debounced server query with AbortController (> scaleThreshold)
  // -------------------------------------------------------------------------
  const executeServerSearch = useCallback(
    (query: string) => {
      if (!fetchServerSearch) return;

      const trimmed = query.trim();
      if (!trimmed) {
        setServerResults(null);
        setIsSearchLoading(false);
        return;
      }

      // Abort any preceding in-flight server search request to prevent race conditions
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsSearchLoading(true);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const results = await fetchServerSearch(trimmed, controller.signal);
          if (!controller.signal.aborted) {
            setServerResults(results);
            setIsSearchLoading(false);
          }
        } catch (err: any) {
          if (err?.name !== "AbortError" && !controller.signal.aborted) {
            console.error("[useInstantSearch] Server search error:", err);
            setIsSearchLoading(false);
          }
        }
      }, debounceMs);
    },
    [fetchServerSearch, debounceMs]
  );

  // -------------------------------------------------------------------------
  // 3. Search Input Handlers
  // -------------------------------------------------------------------------
  const onSearchChange = useCallback(
    (val: string | React.ChangeEvent<HTMLInputElement>) => {
      const text = typeof val === "string" ? val : val.target.value;
      setSearchTerm(text);

      if (activeMode === "server") {
        executeServerSearch(text);
      } else {
        // Client Mode: trigger fetch on first keystroke if cache not yet populated
        if (text.trim() && fetchFullDataset && !cacheRef.current) {
          loadFullDataset();
        }
      }
    },
    [activeMode, executeServerSearch, fetchFullDataset, loadFullDataset]
  );

  const onSubmitSearch = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
  }, []);

  const resetSearch = useCallback(() => {
    setSearchTerm("");
    setServerResults(null);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
  }, []);

  const isSearchActive = searchTerm.trim().length > 0;

  // -------------------------------------------------------------------------
  // 4. Result Computation
  // -------------------------------------------------------------------------
  // In Client Mode: filter index locally. In Server Mode: use serverResults.
  const searchSource = fullDataset ?? initialItems;

  const clientSearchIndex = useMemo(() => {
    if (activeMode !== "client") return [];
    return buildSearchIndex(searchSource, extractSearchFields);
  }, [activeMode, searchSource, extractSearchFields]);

  const clientFilteredItems = useMemo(() => {
    if (activeMode !== "client") return [];
    return searchIndexedItems(clientSearchIndex, searchTerm, searchOptions);
  }, [activeMode, clientSearchIndex, searchTerm, searchOptions]);

  const filteredItems = useMemo(() => {
    if (!isSearchActive) return [];
    if (activeMode === "server") {
      return serverResults ?? [];
    }
    return clientFilteredItems;
  }, [isSearchActive, activeMode, serverResults, clientFilteredItems]);

  const displayItems = isSearchActive ? filteredItems : initialItems;

  // Bound highlight helper
  const highlight = useCallback(
    (text: string | null | undefined, matchClassName?: string) =>
      highlightText(text, searchTerm, matchClassName),
    [searchTerm]
  );

  // Optimistic update helpers
  const mutateItem = useCallback((id: string, updater: (prev: T) => T) => {
    setFullDataset((prev) =>
      prev
        ? prev.map((item) => (String(item.id) === String(id) ? updater(item) : item))
        : null
    );
    setServerResults((prev) =>
      prev
        ? prev.map((item) => (String(item.id) === String(id) ? updater(item) : item))
        : null
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setFullDataset((prev) =>
      prev ? prev.filter((item) => String(item.id) !== String(id)) : null
    );
    setServerResults((prev) =>
      prev ? prev.filter((item) => String(item.id) !== String(id)) : null
    );
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    onSearchChange,
    onSubmitSearch,
    resetSearch,
    isSearchActive,
    isSearchLoading,
    filteredItems,
    displayItems,
    totalCount: isSearchActive ? filteredItems.length : initialItems.length,
    searchTotalPages: 1,
    highlight,
    mutateItem,
    removeItem,
    activeMode,
    refetchFullDataset: loadFullDataset,
    fullDataset,
  };
}
