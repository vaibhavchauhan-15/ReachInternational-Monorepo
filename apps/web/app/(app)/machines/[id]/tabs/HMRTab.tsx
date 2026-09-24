"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef, memo } from "react";
import Link from "next/link";
import { Check, ChevronDown, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedLoader } from "@/components/ui/animated-icons";
import {
  Card,
  Badge,
  Button,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
  FilterToolbar,
} from "@/components/ui";
import { getPaginatedMachineHourLogsAction } from "@/app/actions/machines";
import { formatDate, formatShiftTimingRange } from "@reachinternational/utils";

interface HMRTabProps {
  machineId: string;
}

// Reusable responsive filter selector dropdown with Geist design tokens
const CustomFilterSelector = memo(function CustomFilterSelector({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  align = "left",
  className = "",
  icon,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string; activeColor?: string; dotColor?: string }[];
  ariaLabel?: string;
  align?: "left" | "right";
  className?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<{ startAnimation?: () => void; stopAnimation?: () => void }>(null);

  const selectedOption = options.find((opt) => opt.id === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full group ${open ? "z-40" : "z-10"} ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => iconRef.current?.startAnimation?.()}
        onMouseLeave={() => iconRef.current?.stopAnimation?.()}
        aria-expanded={open}
        aria-label={ariaLabel || label}
        className="w-full h-9 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] text-xs text-[var(--color-ink)] flex items-center justify-between gap-2 transition-all cursor-pointer select-none active:scale-[0.98] shadow-2xs"
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <span className="text-[var(--color-mute)] font-medium shrink-0">{label}:</span>
          {selectedOption?.dotColor && (
            <span className={`h-2 w-2 rounded-full shrink-0 ${selectedOption.dotColor}`} />
          )}
          <span
            className={`truncate font-semibold ${
              selectedOption?.id !== "all"
                ? selectedOption?.activeColor || "text-[var(--color-ink)]"
                : "text-[var(--color-ink)]"
            }`}
          >
            {selectedOption?.label}
          </span>
        </div>
        {icon ? (
          React.isValidElement(icon) ? (
            React.cloneElement(icon as React.ReactElement<any>, {
              ref: (node: any) => {
                iconRef.current = node;
                const orig = (icon as any).ref;
                if (typeof orig === "function") orig(node);
                else if (orig && typeof orig === "object") orig.current = node;
              },
              size: (icon as any).props?.size ?? 14,
              className: `shrink-0 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              } ${(icon as any).props?.className || ""}`,
            })
          ) : (
            icon
          )
        ) : (
          <ChevronDown
            ref={iconRef as any}
            size={14}
            className={`text-[var(--color-mute)] shrink-0 transition-transform duration-200 group-hover:text-[var(--color-ink)] ${
              open ? "rotate-180 text-[var(--color-ink)]" : ""
            }`}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="listbox"
            aria-label={ariaLabel}
            className={`absolute top-full mt-1.5 z-50 min-w-full max-h-60 overflow-y-auto rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1 shadow-xl pointer-events-auto ${
              align === "right"
                ? "right-0 left-auto sm:left-0 sm:right-auto sm:min-w-[200px]"
                : "left-0 right-auto sm:left-0 sm:min-w-[220px]"
            }`}
          >
            {options.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full min-h-[36px] flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer active:scale-[0.98] ${
                    isSelected
                      ? "bg-[var(--color-ink)] text-[var(--color-canvas)] font-semibold shadow-xs"
                      : "text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:bg-[var(--color-hairline-soft-surface)]"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.dotColor && (
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isSelected ? "bg-white" : opt.dotColor
                        }`}
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// Filter & Sort Preset Options
const DATE_OPTIONS = [
  { id: "all", label: "All Dates" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "month", label: "This Month" },
];

const CONDITION_OPTIONS = [
  { id: "all", label: "All Conditions" },
  { id: "breakdown", label: "Breakdown Only", dotColor: "bg-rose-500", activeColor: "text-rose-600 dark:text-rose-400" },
  { id: "normal", label: "Normal Operation", dotColor: "bg-emerald-500", activeColor: "text-emerald-600 dark:text-emerald-400" },
];

const SORT_OPTIONS = [
  { id: "date_desc", label: "Date: Newest First" },
  { id: "date_asc", label: "Date: Oldest First" },
  { id: "hours_desc", label: "Hours: High to Low" },
  { id: "hours_asc", label: "Hours: Low to High" },
  { id: "meter_desc", label: "End Meter: High to Low" },
  { id: "meter_asc", label: "Start Meter: Low to High" },
];

export default function HMRTab({ machineId }: HMRTabProps) {
  // Paginated data state (lazy loaded strictly per page)
  const [hourMeterLogs, setHourMeterLogs] = useState<any[] | null>(null);
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalHoursRun, setTotalHoursRun] = useState(0);
  const [availableOperators, setAvailableOperators] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [hasLoadedLogs, setHasLoadedLogs] = useState(false);

  // Filter & pagination state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d" | "month">("all");
  const [conditionFilter, setConditionFilter] = useState<"all" | "breakdown" | "normal">("all");
  const [operatorFilter, setOperatorFilter] = useState<string>("all");
  const [sortByFilter, setSortByFilter] = useState<string>("date_desc");
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);

  // Mobile Lazy Loading Scroll Stream State
  const [mobileHmrLogs, setMobileHmrLogs] = useState<any[]>([]);
  const [mobileHmrPage, setMobileHmrPage] = useState<number>(1);
  const [mobileHmrHasMore, setMobileHmrHasMore] = useState<boolean>(false);
  const [isLoadingMoreMobileHmr, setIsLoadingMoreMobileHmr] = useState<boolean>(false);
  const isFetchingMobileHmrRef = useRef<boolean>(false);
  const mobileHmrSentinelRef = useRef<HTMLDivElement>(null);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setLogPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Derive sort parameters
  const { sortBy, sortOrder } = useMemo(() => {
    switch (sortByFilter) {
      case "date_asc":
        return { sortBy: "date" as const, sortOrder: "asc" as const };
      case "hours_desc":
        return { sortBy: "running_hours" as const, sortOrder: "desc" as const };
      case "hours_asc":
        return { sortBy: "running_hours" as const, sortOrder: "asc" as const };
      case "meter_desc":
        return { sortBy: "end_meter" as const, sortOrder: "desc" as const };
      case "meter_asc":
        return { sortBy: "start_meter" as const, sortOrder: "asc" as const };
      case "date_desc":
      default:
        return { sortBy: "date" as const, sortOrder: "desc" as const };
    }
  }, [sortByFilter]);

  // Lazy load paginated logs from server action
  const loadPaginatedLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    setLogsError(null);
    try {
      const res = await getPaginatedMachineHourLogsAction({
        machineId,
        page: logPage,
        pageSize: logPageSize,
        search: debouncedSearch,
        condition: conditionFilter,
        datePreset: dateFilter,
        operatorId: operatorFilter,
        sortBy,
        sortOrder,
      });

      if (res.success && res.data) {
        setHourMeterLogs(res.data.logs);
        setTotalLogs(res.data.total);
        setTotalHoursRun(res.data.totalHoursRun);
        if (res.data.availableOperators.length > 0) {
          setAvailableOperators(res.data.availableOperators);
        }
        setHasLoadedLogs(true);
      } else {
        setLogsError(res.error || "Failed to load hour meter running logs.");
        setHourMeterLogs([]);
        setHasLoadedLogs(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected network error occurred.";
      setLogsError(msg);
      setHourMeterLogs([]);
      setHasLoadedLogs(true);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [
    machineId,
    logPage,
    logPageSize,
    debouncedSearch,
    conditionFilter,
    dateFilter,
    operatorFilter,
    sortBy,
    sortOrder,
  ]);

  // Fetch when page, size, or filter dependencies change
  useEffect(() => {
    loadPaginatedLogs();
  }, [loadPaginatedLogs]);

  // Sync mobile stream when hourMeterLogs updates
  useEffect(() => {
    if (hourMeterLogs) {
      setMobileHmrLogs(hourMeterLogs);
      setMobileHmrPage(1);
      setMobileHmrHasMore(hourMeterLogs.length < totalLogs);
    }
  }, [hourMeterLogs, totalLogs]);

  // Mobile load more next chunk
  const handleLoadMoreMobileHmr = useCallback(async () => {
    if (!mobileHmrHasMore || isLoadingMoreMobileHmr || isFetchingMobileHmrRef.current || isLoadingLogs) {
      return;
    }
    isFetchingMobileHmrRef.current = true;
    setIsLoadingMoreMobileHmr(true);

    try {
      const nextPage = mobileHmrPage + 1;
      const res = await getPaginatedMachineHourLogsAction({
        machineId,
        page: nextPage,
        pageSize: logPageSize,
        search: debouncedSearch,
        condition: conditionFilter,
        datePreset: dateFilter,
        operatorId: operatorFilter,
        sortBy,
        sortOrder,
      });

      if (res.success && res.data) {
        const nextLogs = res.data.logs || [];
        const totalCount = res.data.total;
        setMobileHmrLogs((prev) => {
          const existingIds = new Set(prev.map((l: any) => l.id));
          const fresh = nextLogs.filter((l: any) => !existingIds.has(l.id));
          const merged = [...prev, ...fresh];
          setMobileHmrHasMore(merged.length < totalCount);
          return merged;
        });
        setMobileHmrPage(nextPage);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsLoadingMoreMobileHmr(false);
      isFetchingMobileHmrRef.current = false;
    }
  }, [
    mobileHmrHasMore,
    isLoadingMoreMobileHmr,
    isLoadingLogs,
    mobileHmrPage,
    machineId,
    logPageSize,
    debouncedSearch,
    conditionFilter,
    dateFilter,
    operatorFilter,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    const sentinel = mobileHmrSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting) {
          handleLoadMoreMobileHmr();
        }
      },
      { root: null, rootMargin: "350px", threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMoreMobileHmr]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (dateFilter !== "all") count++;
    if (conditionFilter !== "all") count++;
    if (operatorFilter !== "all") count++;
    if (sortByFilter !== "date_desc") count++;
    return count;
  }, [searchTerm, dateFilter, conditionFilter, operatorFilter, sortByFilter]);

  const handleResetFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setDateFilter("all");
    setConditionFilter("all");
    setOperatorFilter("all");
    setSortByFilter("date_desc");
    setLogPage(1);
  };

  // Operator select options
  const operatorOptions = useMemo(() => {
    const list = availableOperators.map((op) => ({
      id: op.id,
      label: op.name,
    }));
    return [{ id: "all", label: "All Operators" }, ...list];
  }, [availableOperators]);

  const isInitialEmpty =
    !isLoadingLogs &&
    !logsError &&
    hasLoadedLogs &&
    totalLogs === 0 &&
    activeFilterCount === 0;

  return (
    <Card padding="md" className="sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-[var(--color-hairline)]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
            Hours Meter Logs
          </h3>
          {hasLoadedLogs && totalHoursRun > 0 && (
            <Badge variant="info" className="font-mono text-xs">
              <span className="font-bold">+{totalHoursRun}</span> hrs Run
            </Badge>
          )}
        </div>
        <div className="flex items-center shrink-0">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={13} className={isLoadingLogs ? "animate-spin text-sky-500" : ""} />}
            onClick={loadPaginatedLogs}
            disabled={isLoadingLogs}
            title="Refresh HMR Logs"
            aria-label="Refresh HMR Logs"
            className="w-8 h-8 p-0 flex items-center justify-center rounded-lg min-h-[36px] min-w-[36px]"
          />
        </div>
      </div>

      {/* Error State */}
      {!isLoadingLogs && logsError && (
        <div className="mt-4 p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-medium">
            <span>{logsError}</span>
          </div>
          <Button size="sm" variant="secondary" onClick={loadPaginatedLogs}>
            Retry
          </Button>
        </div>
      )}

      {/* Initial Clean Empty State (No records recorded ever) */}
      {isInitialEmpty && (
        <div className="py-10 text-center">
          <EmptyState
            title="No Running Meter Logs Logged"
            description="Daily hour meter logbook entries recorded by machine operators for this machine will appear here."
            action={
              <Link href="/operations">
                <Button variant="secondary" size="sm">
                  + Add First Meter Log
                </Button>
              </Link>
            }
          />
        </div>
      )}

      {/* Filter Toolbar & Data Table */}
      {(!isInitialEmpty || activeFilterCount > 0) && (
        <div className="mt-4 space-y-4">
          {/* Reused Machine Directory Search & Filter Toolbar */}
          <FilterToolbar
            searchQuery={searchTerm}
            onSearchChange={(val) => setSearchTerm(val)}
            placeholder="Search remarks, operator, condition..."
            activeFilterCount={activeFilterCount}
            onResetFilters={handleResetFilters}
            isLoading={isLoadingLogs}
            defaultOpen={activeFilterCount > 0}
          >
            <div className="flex flex-col gap-3 w-full">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-center gap-2 sm:gap-2.5 w-full">
                {/* 1. Date Range Preset Filter */}
                <div className="w-full min-w-0">
                  <CustomFilterSelector
                    label="Date"
                    value={dateFilter}
                    onChange={(val) => {
                      setDateFilter(val as any);
                      setLogPage(1);
                    }}
                    options={DATE_OPTIONS}
                    ariaLabel="Filter logs by date range"
                    align="left"
                  />
                </div>

                {/* 2. Condition Filter */}
                <div className="w-full min-w-0">
                  <CustomFilterSelector
                    label="Condition"
                    value={conditionFilter}
                    onChange={(val) => {
                      setConditionFilter(val as any);
                      setLogPage(1);
                    }}
                    options={CONDITION_OPTIONS}
                    ariaLabel="Filter logs by condition"
                    align="left"
                  />
                </div>

                {/* 3. Operator Filter */}
                <div className="w-full min-w-0">
                  <CustomFilterSelector
                    label="Operator"
                    value={operatorFilter}
                    onChange={(val) => {
                      setOperatorFilter(val);
                      setLogPage(1);
                    }}
                    options={operatorOptions}
                    ariaLabel="Filter logs by operator"
                    align="left"
                  />
                </div>

                {/* 4. Sort By Filter */}
                <div className="w-full min-w-0">
                  <CustomFilterSelector
                    label="Sort"
                    value={sortByFilter}
                    onChange={(val) => {
                      setSortByFilter(val);
                      setLogPage(1);
                    }}
                    options={SORT_OPTIONS}
                    ariaLabel="Sort hour meter logs"
                    align="right"
                  />
                </div>
              </div>
            </div>
          </FilterToolbar>

          {/* Loading Indicator */}
          {isLoadingLogs && (
            <div className="w-full rounded-xl border border-[var(--color-hairline)] overflow-hidden">
              <div className="h-10 bg-[var(--color-hairline-soft-surface)] flex items-center px-4">
                <AnimatedLoader isSpinning size={14} className="text-sky-500 mr-2" />
                <span className="text-xs font-medium text-[var(--color-mute)]">
                  Loading visible page records...
                </span>
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-12 border-t border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] animate-pulse flex items-center px-4 gap-4"
                >
                  <div className="h-4 w-20 bg-[var(--color-hairline)] rounded" />
                  <div className="h-4 w-28 bg-[var(--color-hairline)] rounded" />
                  <div className="h-4 w-28 bg-[var(--color-hairline)] rounded" />
                  <div className="h-4 w-32 bg-[var(--color-hairline)] rounded" />
                  <div className="h-4 w-16 bg-[var(--color-hairline)] rounded" />
                  <div className="h-4 w-24 bg-[var(--color-hairline)] rounded ml-auto" />
                </div>
              ))}
            </div>
          )}

          {/* Filtered Empty State */}
          {!isLoadingLogs && hourMeterLogs && hourMeterLogs.length === 0 && (
            <div className="py-10 text-center border border-dashed border-[var(--color-hairline)] rounded-xl bg-[var(--color-hairline-soft-surface)]/20 p-6">
              <p className="font-bold text-xs sm:text-sm text-[var(--color-ink)]">
                No logs match your filter criteria
              </p>
              <p className="text-xs text-[var(--color-mute)] mt-1 max-w-sm mx-auto">
                Try adjusting your search terms, date range, or clear all filters.
              </p>
              <div className="mt-4">
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  Clear All Filters
                </Button>
              </div>
            </div>
          )}

          {/* Desktop Table + Mobile Cards */}
          {!isLoadingLogs && hourMeterLogs && hourMeterLogs.length > 0 && (
            <>
              {/* Desktop Table: Well-formatted, zero icons, clean hairline styling */}
              <div className="hidden md:block w-full overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 select-none">
                      <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                        LOG DATE
                      </TableHead>
                      <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                        OPERATOR
                      </TableHead>
                      <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                        OPERATING HOURS
                      </TableHead>
                      <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                        HOUR METER READINGS
                      </TableHead>
                      <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                        BREAKDOWN
                      </TableHead>
                      <TableHead className="py-2.5 px-3 text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                        REMARKS
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hourMeterLogs.map((log: any) => {
                      const isBreakdown = Boolean(log.is_breakdown || (Number(log.breakdown_hours) > 0));
                      const breakdownHours = Number(log.breakdown_hours) || 0;

                      return (
                        <TableRow
                          key={log.id}
                          className="border-b border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)]/50 transition-colors"
                        >
                          {/* 1. Log Date */}
                          <TableCell className="py-2.5 px-3 font-mono text-xs font-semibold text-[var(--color-ink)] whitespace-nowrap">
                            {formatDate(log.log_date)}
                          </TableCell>

                          {/* 2. Operator */}
                          <TableCell className="py-2.5 px-3 text-xs font-medium text-[var(--color-ink)] whitespace-nowrap">
                            {log.operator?.full_name || log.operator_name || "Unassigned"}
                          </TableCell>

                          {/* 3. Operating Hours */}
                          <TableCell className="py-2.5 px-3 font-mono text-xs text-[var(--color-ink)] whitespace-nowrap">
                            {log.start_time && log.end_time
                              ? `${log.running_hours || 0} hrs (${formatShiftTimingRange(log.start_time, log.end_time)})`
                              : `${log.running_hours || 0} hrs`}
                          </TableCell>

                          {/* 4. Hour Meter Readings (Start -> End) */}
                          <TableCell className="py-2.5 px-3 font-mono text-xs font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                            {log.start_meter || 0} → {log.end_meter || 0}
                          </TableCell>

                          {/* 5. Separate Breakdown Column */}
                          <TableCell className="py-2.5 px-3 font-mono text-xs whitespace-nowrap">
                            {isBreakdown ? (
                              <span className="font-bold text-rose-600 dark:text-rose-400">
                                {breakdownHours > 0 ? `${breakdownHours} hrs` : "Breakdown"}
                              </span>
                            ) : (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                0
                              </span>
                            )}
                          </TableCell>

                          {/* 6. Separate Remarks Column */}
                          <TableCell className="py-2.5 px-3 text-xs text-[var(--color-mute)] max-w-xs truncate">
                            {log.remarks ? log.remarks : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View: Clean, zero icons, polished cards */}
              <div className="block md:hidden flex flex-col gap-2.5">
                {(mobileHmrLogs.length > 0 ? mobileHmrLogs : (hourMeterLogs || [])).map((log: any) => {
                  const isBreakdown = Boolean(log.is_breakdown || (Number(log.breakdown_hours) > 0));
                  const breakdownHours = Number(log.breakdown_hours) || 0;

                  return (
                    <div
                      key={log.id}
                      className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col gap-2 shadow-2xs"
                    >
                      {/* Top Row: Date & Operator */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--color-ink)]">
                          {formatDate(log.log_date)}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-ink)] truncate max-w-[140px]">
                          {log.operator?.full_name || log.operator_name || "Unassigned"}
                        </span>
                      </div>

                      {/* Hour Meter Readings Block */}
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-[var(--color-mute)] tracking-wider">
                            HOUR METER READINGS
                          </span>
                          <span className="font-mono text-xs font-bold text-[var(--color-ink)]">
                            {log.start_meter || 0} → {log.end_meter || 0}
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                          +{log.running_hours || 0} hrs
                        </span>
                      </div>

                      {/* Operating Hours & Breakdown Details */}
                      <div className="flex items-center justify-between text-xs py-1 border-y border-[var(--color-hairline)]/60 font-mono">
                        <div className="text-[var(--color-body)]">
                          Worked: <span className="font-bold text-[var(--color-ink)]">{log.running_hours || 0} hrs</span>
                          {log.start_time && log.end_time && (
                            <span className="text-[11px] text-[var(--color-mute)] ml-1">
                              ({formatShiftTimingRange(log.start_time, log.end_time)})
                            </span>
                          )}
                        </div>
                        <div>
                          Breakdown:{" "}
                          {isBreakdown ? (
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              {breakdownHours > 0 ? `${breakdownHours} hrs` : "Breakdown"}
                            </span>
                          ) : (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              0
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Remarks */}
                      {log.remarks && (
                        <div className="text-xs text-[var(--color-mute)] pt-0.5">
                          Remarks: <span className="italic text-[var(--color-body)]">&ldquo;{log.remarks}&rdquo;</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Mobile Infinite Scroll Sentinel */}
                <div ref={mobileHmrSentinelRef} className="h-1 w-full pointer-events-none" aria-hidden="true" />

                {/* Skeletons while loading more logs chunk-by-chunk on mobile */}
                {isLoadingMoreMobileHmr && (
                  <div className="space-y-2.5 animate-pulse" aria-label="Loading more logs...">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={`skel-hmr-log-${i}`}
                        className="p-3 sm:p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-col gap-2 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="h-3.5 w-20 rounded bg-[var(--color-hairline)]" />
                          <div className="h-4 w-24 rounded bg-[var(--color-hairline)]" />
                        </div>
                        <div className="h-12 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-hairline)]" />
                      </div>
                    ))}
                  </div>
                )}

                {/* End-of-List Indicator on Mobile */}
                {!mobileHmrHasMore && (mobileHmrLogs.length > 0 || (hourMeterLogs && hourMeterLogs.length > 0)) && !isLoadingLogs && (
                  <div className="py-6 flex items-center justify-center gap-3 text-xs text-[var(--color-mute)] select-none">
                    <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
                    <span className="font-medium text-[var(--color-mute)]">All hour meter logs have been displayed</span>
                    <div className="h-[1px] flex-1 bg-[var(--color-hairline)]" />
                  </div>
                )}
              </div>

              {/* Pagination with custom reusable PageSizeSelect (Desktop / Tablet only) */}
              <div className="pt-2 hidden md:block">
                <Pagination
                  page={logPage}
                  pageSize={logPageSize}
                  total={totalLogs}
                  onPageChange={(p) => setLogPage(p)}
                  pageSizeOptions={[10, 25, 50, 100]}
                  onPageSizeChange={(sz) => {
                    setLogPageSize(sz);
                    setLogPage(1);
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
