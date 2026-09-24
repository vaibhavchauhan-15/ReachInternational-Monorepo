import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PersistentListState<TFilters extends Record<string, any>> {
  search: string;
  sort: string;
  order: 'asc' | 'desc';
  filters: TFilters;
}

export interface UsePersistentListStateConfig<TFilters extends Record<string, any>> {
  storageKey: string;
  defaultSearch?: string;
  defaultSort?: string;
  defaultOrder?: 'asc' | 'desc';
  defaultFilters: TFilters;
  debounceMs?: number;
  onStateHydrated?: (state: PersistentListState<TFilters>) => void;
}

export interface UsePersistentListStateReturn<TFilters extends Record<string, any>> {
  search: string;
  inputValue: string;
  page: number;
  sort: string;
  order: 'asc' | 'desc';
  filters: TFilters;
  isHydrated: boolean;
  isDebouncing: boolean;
  activeFilterCount: number;
  setSearch: (term: string, immediate?: boolean) => void;
  setPage: (page: number | ((prev: number) => number)) => void;
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K] | ((prev: TFilters[K]) => TFilters[K])) => void;
  setFilters: (updates: Partial<TFilters>) => void;
  setSorting: (sort: string, order?: 'asc' | 'desc') => void;
  resetFilters: () => void;
}

/**
 * Reusable Mobile Standard Hook: Persists Search, Filters, and Sorting in AsyncStorage
 * while strictly resetting pagination back to Page 1 on initial screen mounts.
 *
 * Implements ReachInternational Cross-Platform State Protocol:
 * - Fluid local text input state (inputValue)
 * - 280ms debounced storage write and state dispatch
 * - Restores user preferences seamlessly across app restarts and tab transitions
 * - Guarantees fresh data views on reopening without stale pagination offsets
 */
export function usePersistentListState<TFilters extends Record<string, any>>(
  config: UsePersistentListStateConfig<TFilters>
): UsePersistentListStateReturn<TFilters> {
  const {
    storageKey,
    defaultSearch = '',
    defaultSort = '',
    defaultOrder = 'asc',
    defaultFilters,
    debounceMs = 280,
    onStateHydrated,
  } = config;

  const [inputValue, setInputValue] = useState(defaultSearch);
  const [search, setSearchState] = useState(defaultSearch);
  const [page, setPageState] = useState(1);
  const [sort, setSortState] = useState(defaultSort);
  const [order, setOrderState] = useState<'asc' | 'desc'>(defaultOrder);
  const [filters, setFiltersState] = useState<TFilters>(defaultFilters);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHydratedRef = useRef(onStateHydrated);
  onHydratedRef.current = onStateHydrated;

  // 1. Restore persisted state from AsyncStorage on initial mount
  useEffect(() => {
    let isMounted = true;

    async function hydrateState() {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (stored && isMounted) {
          const parsed = JSON.parse(stored);
          const restoredSearch = typeof parsed.search === 'string' ? parsed.search : defaultSearch;
          const restoredSort = typeof parsed.sort === 'string' ? parsed.sort : defaultSort;
          const restoredOrder = parsed.order === 'desc' ? 'desc' : (defaultOrder as 'asc' | 'desc');
          const restoredFilters = {
            ...defaultFilters,
            ...(parsed.filters || {}),
          };

          setInputValue(restoredSearch);
          setSearchState(restoredSearch);
          setSortState(restoredSort);
          setOrderState(restoredOrder);
          setFiltersState(restoredFilters);
          setPageState(1); // Explicit rule: Reset pagination to Page 1 on screen mount

          if (onHydratedRef.current) {
            onHydratedRef.current({
              search: restoredSearch,
              sort: restoredSort,
              order: restoredOrder,
              filters: restoredFilters,
            });
          }
        }
      } catch (err) {
        console.warn(`[usePersistentListState] Failed to hydrate ${storageKey}:`, err);
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    }

    hydrateState();

    return () => {
      isMounted = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [storageKey, defaultSearch, defaultSort, defaultOrder, defaultFilters]);

  // Helper to persist state to AsyncStorage
  const persistState = useCallback(
    async (payload: { search: string; sort: string; order: 'asc' | 'desc'; filters: TFilters }) => {
      try {
        await AsyncStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (err) {
        console.warn(`[usePersistentListState] Failed to persist ${storageKey}:`, err);
      }
    },
    [storageKey]
  );

  // Set Search with fluid debounce
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
        persistState({ search: term, sort, order, filters });
        return;
      }

      setIsDebouncing(true);
      debounceTimerRef.current = setTimeout(() => {
        setIsDebouncing(false);
        setSearchState(term);
        setPageState(1);
        persistState({ search: term, sort, order, filters });
      }, debounceMs);
    },
    [debounceMs, persistState, sort, order, filters]
  );

  // Set Page (in-memory only, pagination is not persisted across re-opens)
  const setPage = useCallback((newPage: number | ((prev: number) => number)) => {
    setPageState(newPage);
  }, []);

  // Set single filter
  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K] | ((prev: TFilters[K]) => TFilters[K])) => {
      setFiltersState((prev) => {
        const resolvedValue =
          typeof value === 'function'
            ? (value as (prevVal: TFilters[K]) => TFilters[K])(prev[key])
            : value;
        const next = { ...prev, [key]: resolvedValue };
        setPageState(1);
        persistState({ search, sort, order, filters: next });
        return next;
      });
    },
    [persistState, search, sort, order]
  );

  // Set multiple filters
  const setFilters = useCallback(
    (updates: Partial<TFilters>) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...updates };
        setPageState(1);
        persistState({ search, sort, order, filters: next });
        return next;
      });
    },
    [persistState, search, sort, order]
  );

  // Set Sorting
  const setSorting = useCallback(
    (newSort: string, newOrder: 'asc' | 'desc' = 'asc') => {
      setSortState(newSort);
      setOrderState(newOrder);
      setPageState(1);
      persistState({ search, sort: newSort, order: newOrder, filters });
    },
    [persistState, search, filters]
  );

  // Reset all filters & search back to defaults and clear storage
  const resetFilters = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setIsDebouncing(false);
    setInputValue(defaultSearch);
    setSearchState(defaultSearch);
    setPageState(1);
    setSortState(defaultSort);
    setOrderState(defaultOrder);
    setFiltersState({ ...defaultFilters });

    persistState({
      search: defaultSearch,
      sort: defaultSort,
      order: defaultOrder,
      filters: { ...defaultFilters },
    });
  }, [defaultSearch, defaultSort, defaultOrder, defaultFilters, persistState]);

  // Compute active non-default filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search.trim() !== defaultSearch.trim()) count++;
    if (sort !== defaultSort || order !== defaultOrder) count++;

    for (const [key, val] of Object.entries(filters)) {
      const def = defaultFilters[key];
      if (val !== undefined && val !== null && val !== '' && val !== 'all' && val !== def) {
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
    isHydrated,
    isDebouncing,
    activeFilterCount,
    setSearch,
    setPage,
    setFilter,
    setFilters,
    setSorting,
    resetFilters,
  };
}
