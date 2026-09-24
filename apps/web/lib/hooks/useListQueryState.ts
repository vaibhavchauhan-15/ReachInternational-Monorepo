"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export interface ListQueryState<TFilters extends Record<string, any>> {
  search: string;
  page: number;
  sort: string;
  order: "asc" | "desc";
  filters: TFilters;
}

export interface UseListQueryStateConfig<TFilters extends Record<string, any>> {
  defaultSearch?: string;
  defaultSort?: string;
  defaultOrder?: "asc" | "desc";
  defaultPage?: number;
  defaultFilters: TFilters;
  debounceMs?: number;
  pathname?: string;
  /**
   * Optional custom parsers for filter fields (e.g. numbers, booleans, dates)
   */
  parsers?: {
    [K in keyof TFilters]?: (val: string | null) => TFilters[K];
  };
  /**
   * Optional custom serializers for filter fields to string
   */
  serializers?: {
    [K in keyof TFilters]?: (val: TFilters[K]) => string | undefined;
  };
  /**
   * Callback invoked whenever query state changes (debounced search or immediate filter)
   */
  onQueryChange?: (state: ListQueryState<TFilters>) => void;
}

export interface UseListQueryStateReturn<TFilters extends Record<string, any>> {
  search: string;
  inputValue: string;
  page: number;
  sort: string;
  order: "asc" | "desc";
  filters: TFilters;
  activeFilterCount: number;
  isDebouncing: boolean;
  setSearch: (term: string, immediate?: boolean) => void;
  setPage: (page: number) => void;
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  setFilters: (updates: Partial<TFilters>) => void;
  setSorting: (sort: string, order?: "asc" | "desc") => void;
  resetFilters: () => void;
  syncToUrl: (overrides?: Partial<ListQueryState<TFilters>>) => void;
}

/**
 * Reusable monorepo standard hook to synchronize and persist list search, filters,
 * sorting, and pagination in URL query parameters.
 *
 * Adheres to ReachInternational Architecture & Performance Standards:
 * 1. Controlled instant local input state for 60fps typing responsiveness.
 * 2. Snappy 300ms debounced URL updates via `window.history.replaceState`, avoiding full RSC tree re-fetches.
 * 3. Bidirectional popstate listener preserving browser Back & Forward navigation.
 * 4. Automatic hydration from URL query parameters on initial page load / hard reload.
 * 5. Clean URLs: omit default parameters to keep URLs concise and shareable.
 */
export function useListQueryState<TFilters extends Record<string, any>>(
  config: UseListQueryStateConfig<TFilters>
): UseListQueryStateReturn<TFilters> {
  const {
    defaultSearch = "",
    defaultSort = "",
    defaultOrder = "asc",
    defaultPage = 1,
    defaultFilters,
    debounceMs = 300,
    parsers,
    serializers,
    onQueryChange,
  } = config;

  const currentPathname = usePathname();
  const searchParams = useSearchParams();
  const effectivePathname = config.pathname || currentPathname || "";

  // Helper to parse query params into filter object
  const parseFiltersFromParams = useCallback(
    (params: URLSearchParams | null): TFilters => {
      const result = { ...defaultFilters };
      if (!params) return result;

      for (const key of Object.keys(defaultFilters) as Array<keyof TFilters>) {
        const raw = params.get(String(key));
        if (raw !== null) {
          if (parsers && parsers[key]) {
            result[key] = parsers[key]!(raw);
          } else {
            result[key] = raw as any;
          }
        }
      }
      return result;
    },
    [defaultFilters, parsers]
  );

  // Initialize state from URL params if available, else defaults
  const initialParams = searchParams;
  const initialSearch = initialParams?.get("search") || defaultSearch;
  const initialPage = initialParams?.get("page")
    ? Math.max(1, parseInt(initialParams.get("page")!, 10) || defaultPage)
    : defaultPage;
  const initialSort = initialParams?.get("sort") || defaultSort;
  const initialOrder = (initialParams?.get("order") as "asc" | "desc") || defaultOrder;
  const initialFilters = useMemo(
    () => parseFiltersFromParams(initialParams),
    [initialParams, parseFiltersFromParams]
  );

  // Local state
  const [inputValue, setInputValue] = useState(initialSearch);
  const [search, setSearchState] = useState(initialSearch);
  const [page, setPageState] = useState(initialPage);
  const [sort, setSortState] = useState(initialSort);
  const [order, setOrderState] = useState<"asc" | "desc">(initialOrder);
  const [filters, setFiltersState] = useState<TFilters>(initialFilters);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onQueryChangeRef = useRef(onQueryChange);
  onQueryChangeRef.current = onQueryChange;

  // Build URL query string from state
  const serializeToQueryString = useCallback(
    (state: {
      search: string;
      page: number;
      sort: string;
      order: "asc" | "desc";
      filters: TFilters;
    }): string => {
      const params = new URLSearchParams();

      if (state.search.trim()) {
        params.set("search", state.search.trim());
      }
      if (state.page > 1) {
        params.set("page", String(state.page));
      }
      if (state.sort && state.sort !== defaultSort) {
        params.set("sort", state.sort);
      }
      if (state.order && state.order !== defaultOrder) {
        params.set("order", state.order);
      }

      for (const [key, val] of Object.entries(state.filters)) {
        const defaultVal = defaultFilters[key];
        if (val !== undefined && val !== null && val !== "" && val !== "all" && val !== defaultVal) {
          if (serializers && serializers[key as keyof TFilters]) {
            const serialized = serializers[key as keyof TFilters]!(val);
            if (serialized !== undefined) params.set(key, serialized);
          } else {
            params.set(key, String(val));
          }
        }
      }

      return params.toString();
    },
    [defaultSort, defaultOrder, defaultFilters, serializers]
  );

  // Write new query state to browser URL via window.history.replaceState
  const syncToUrl = useCallback(
    (overrides?: Partial<ListQueryState<TFilters>>) => {
      if (typeof window === "undefined") return;

      const currentState: ListQueryState<TFilters> = {
        search,
        page,
        sort,
        order,
        filters,
        ...overrides,
      };

      const qs = serializeToQueryString(currentState);
      const newUrl = qs ? `${effectivePathname}?${qs}` : effectivePathname;

      if (window.location.search !== (qs ? `?${qs}` : "")) {
        window.history.replaceState(null, "", newUrl);
      }

      if (onQueryChangeRef.current) {
        onQueryChangeRef.current(currentState);
      }
    },
    [search, page, sort, order, filters, effectivePathname, serializeToQueryString]
  );

  // Set Search with debounce
  const setSearch = useCallback(
    (term: string, immediate = false) => {
      setInputValue(term);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (immediate) {
        setIsDebouncing(false);
        setSearchState(term);
        setPageState(1);
        syncToUrl({ search: term, page: 1 });
        return;
      }

      setIsDebouncing(true);
      debounceTimerRef.current = setTimeout(() => {
        setIsDebouncing(false);
        setSearchState(term);
        setPageState(1);
        syncToUrl({ search: term, page: 1 });
      }, debounceMs);
    },
    [debounceMs, syncToUrl]
  );

  // Set Page
  const setPage = useCallback(
    (newPage: number) => {
      setPageState(newPage);
      syncToUrl({ page: newPage });
    },
    [syncToUrl]
  );

  // Set a single filter
  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      setFiltersState((prev) => {
        const next = { ...prev, [key]: value };
        setPageState(1);
        syncToUrl({ filters: next, page: 1 });
        return next;
      });
    },
    [syncToUrl]
  );

  // Set multiple filters at once
  const setFilters = useCallback(
    (updates: Partial<TFilters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...updates };
        setPageState(1);
        syncToUrl({ filters: next, page: 1 });
        return next;
      });
    },
    [syncToUrl]
  );

  // Set Sorting
  const setSorting = useCallback(
    (newSort: string, newOrder: "asc" | "desc" = "asc") => {
      setSortState(newSort);
      setOrderState(newOrder);
      setPageState(1);
      syncToUrl({ sort: newSort, order: newOrder, page: 1 });
    },
    [syncToUrl]
  );

  // Reset all filters & search back to defaults
  const resetFilters = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setIsDebouncing(false);
    setInputValue(defaultSearch);
    setSearchState(defaultSearch);
    setPageState(defaultPage);
    setSortState(defaultSort);
    setOrderState(defaultOrder);
    setFiltersState({ ...defaultFilters });

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", effectivePathname);
    }

    if (onQueryChangeRef.current) {
      onQueryChangeRef.current({
        search: defaultSearch,
        page: defaultPage,
        sort: defaultSort,
        order: defaultOrder,
        filters: { ...defaultFilters },
      });
    }
  }, [defaultSearch, defaultPage, defaultSort, defaultOrder, defaultFilters, effectivePathname]);

  // Listen to popstate (browser back/forward button navigation)
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      const urlSearch = params.get("search") || defaultSearch;
      const urlPage = params.get("page")
        ? Math.max(1, parseInt(params.get("page")!, 10) || defaultPage)
        : defaultPage;
      const urlSort = params.get("sort") || defaultSort;
      const urlOrder = (params.get("order") as "asc" | "desc") || defaultOrder;
      const urlFilters = parseFiltersFromParams(params);

      setInputValue(urlSearch);
      setSearchState(urlSearch);
      setPageState(urlPage);
      setSortState(urlSort);
      setOrderState(urlOrder);
      setFiltersState(urlFilters);
      setIsDebouncing(false);

      if (onQueryChangeRef.current) {
        onQueryChangeRef.current({
          search: urlSearch,
          page: urlPage,
          sort: urlSort,
          order: urlOrder,
          filters: urlFilters,
        });
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [defaultSearch, defaultPage, defaultSort, defaultOrder, parseFiltersFromParams]);

  // Compute active non-default filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim() !== defaultSearch.trim()) count++;
    if (sort !== defaultSort || order !== defaultOrder) count++;

    for (const [key, val] of Object.entries(filters)) {
      const def = defaultFilters[key];
      if (val !== undefined && val !== null && val !== "" && val !== "all" && val !== def) {
        count++;
      }
    }
    return count;
  }, [search, sort, order, filters, defaultSearch, defaultSort, defaultOrder, defaultFilters]);

  return {
    search,
    inputValue,
    page,
    sort,
    order,
    filters,
    activeFilterCount,
    isDebouncing,
    setSearch,
    setPage,
    setFilter,
    setFilters,
    setSorting,
    resetFilters,
    syncToUrl,
  };
}
