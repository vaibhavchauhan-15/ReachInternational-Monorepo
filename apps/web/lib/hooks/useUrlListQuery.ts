"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export interface UseUrlListQueryOptions<TFilters extends Record<string, string | undefined>> {
  defaultFilters: TFilters;
  defaultSort?: string;
  defaultOrder?: "asc" | "desc";
  debounceMs?: number;
}

export interface UseUrlListQueryReturn<TFilters extends Record<string, string | undefined>> {
  search: string;
  localSearch: string;
  setLocalSearch: (val: string) => void;
  page: number;
  setPage: (page: number) => void;
  sort: string;
  order: "asc" | "desc";
  setSort: (sortField: string, sortOrder?: "asc" | "desc") => void;
  filters: TFilters;
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  setFilters: (updates: Partial<TFilters>) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  isPending: boolean;
}

/**
 * Standard Web URL List Query Hook
 * Encapsulates debounced search, active filters, sorting, and pagination
 * synchronized seamlessly with Next.js App Router searchParams.
 */
export function useUrlListQuery<TFilters extends Record<string, string | undefined>>({
  defaultFilters,
  defaultSort = "",
  defaultOrder = "asc",
  debounceMs = 280,
}: UseUrlListQueryOptions<TFilters>): UseUrlListQueryReturn<TFilters> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const urlSearch = searchParams?.get("search") || "";
  const [localSearch, setLocalSearchState] = useState(urlSearch);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Parse page from URL
  const page = useMemo(() => {
    const raw = searchParams?.get("page");
    const parsed = parseInt(raw || "1", 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
  }, [searchParams]);

  // Parse sort from URL
  const sort = useMemo(() => {
    return searchParams?.get("sort") || defaultSort;
  }, [searchParams, defaultSort]);

  const order = useMemo<"asc" | "desc">(() => {
    const raw = searchParams?.get("order");
    if (raw === "asc" || raw === "desc") return raw;
    return defaultOrder;
  }, [searchParams, defaultOrder]);

  // Parse filters from URL
  const filters = useMemo<TFilters>(() => {
    const current = { ...defaultFilters };
    Object.keys(defaultFilters).forEach((key) => {
      const val = searchParams?.get(key);
      if (val !== null && val !== undefined) {
        (current as Record<string, string | undefined>)[key] = val;
      }
    });
    return current;
  }, [searchParams, defaultFilters]);

  // Sync URL parameters
  const updateUrl = useCallback(
    (updates: Record<string, string | number | undefined>, resetPage = false) => {
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : searchParams.toString()
      );

      Object.entries(updates).forEach(([key, val]) => {
        if (
          val === undefined ||
          val === "" ||
          val === "all" ||
          (key === "page" && (val === 1 || val === "1"))
        ) {
          params.delete(key);
        } else {
          params.set(key, String(val));
        }
      });

      if (resetPage) {
        params.delete("page");
      }

      const nextQuery = params.toString();
      const currentQuery =
        typeof window !== "undefined"
          ? window.location.search.replace(/^\?/, "")
          : searchParams.toString();

      if (nextQuery === currentQuery) return;

      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  // Synchronize local search with URL parameter when navigated externally
  useEffect(() => {
    setLocalSearchState(urlSearch);
  }, [urlSearch]);

  // Debounced search handler
  const setLocalSearch = useCallback(
    (newTerm: string) => {
      setLocalSearchState(newTerm);
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = setTimeout(() => {
        const trimmed = newTerm.trim();
        updateUrl({ search: trimmed || undefined }, true);
      }, debounceMs);
    },
    [debounceMs, updateUrl]
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const setPage = useCallback(
    (newPage: number) => {
      updateUrl({ page: newPage });
    },
    [updateUrl]
  );

  const setSort = useCallback(
    (sortField: string, sortOrder?: "asc" | "desc") => {
      updateUrl({
        sort: sortField,
        order: sortOrder || (order === "asc" ? "desc" : "asc"),
      });
    },
    [order, updateUrl]
  );

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      updateUrl({ [key as string]: value }, true);
    },
    [updateUrl]
  );

  const setFilters = useCallback(
    (updates: Partial<TFilters>) => {
      updateUrl(updates as Record<string, string | number | undefined>, true);
    },
    [updateUrl]
  );

  const resetFilters = useCallback(() => {
    const cleared: Record<string, undefined> = {
      search: undefined,
      sort: undefined,
      order: undefined,
      page: undefined,
    };
    Object.keys(defaultFilters).forEach((k) => {
      cleared[k] = undefined;
    });
    setLocalSearchState("");
    updateUrl(cleared, true);
  }, [defaultFilters, updateUrl]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (localSearch.trim()) count++;
    Object.entries(filters).forEach(([key, val]) => {
      const def = defaultFilters[key];
      if (val && val !== "all" && val !== def) {
        count++;
      }
    });
    if (sort && sort !== defaultSort) count++;
    return count;
  }, [localSearch, filters, defaultFilters, sort, defaultSort]);

  return {
    search: urlSearch,
    localSearch,
    setLocalSearch,
    page,
    setPage,
    sort,
    order,
    setSort,
    filters,
    setFilter,
    setFilters,
    resetFilters,
    activeFilterCount,
    isPending,
  };
}
