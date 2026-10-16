"use client";

import React, { useState, useMemo, useTransition, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Printer,
  SlidersHorizontal,
  Building,
  CreditCard,
  Calendar,
} from "lucide-react";
import {
  AnimatedUsers,
  AnimatedClock,
  AnimatedCreditCard,
  AnimatedEdit2,
  AnimatedSave,
  AnimatedX,
  AnimatedCheck,
  AnimatedBriefcase,
  AnimatedHelpCircle,
  AnimatedSlidersHorizontal,
  AnimatedArrowUpDown,
  AnimatedFileSpreadsheet,
  AnimatedDownload,
  AnimatedFileText,
  AnimatedEye,
  AnimatedBuilding,
  AnimatedCalendar,
} from "@/components/ui/animated-icons";
import {
  PageHeader,
  Button,
  Input,
  Modal,
  FilterToolbar,
  FilterDropdown,
  FilterChips,
  type FilterChipItem,
  type FilterDropdownOption,
  SortControl,
  Tabs,
  type TabItem,
  EmptyState,
  MonthSelect,
  useToast,
  highlightText,
  Badge,
} from "@/components/ui";
import { AnimatedCounter } from "@/components/ui/Motion";
import {
  PayrollKPIStrip,
  PayrollDesktopTable,
  PayrollMobileCard,
  SalarySlipModal,
  EditStatementModal,
} from "@/components/payroll";
import type { HRPayrollSummary, HRPayrollOperator } from "@/lib/types/database";
import { useRegisterPageActions } from "@/components/layout/PageActionContext";
import type { UserRole } from "@reachinternational/types";
import {
  updateOperatorRates,
  bulkUpdateOperatorRates,
  updateOperatorSalaryStatementAction,
} from "@/app/actions/payroll";
import {
  calculateOperatorSalary,
  calculatePayrollKpis,
  PAYROLL_CSV_HEADERS,
  formatPayrollCsvRow,
} from "@reachinternational/utils";

interface PayrollClientProps {
  initialData: HRPayrollSummary;
  currentMonth: string;
  userRole: UserRole;
}

type ViewMode = "statement" | "attendance" | "earnings" | "deductions" | "payouts" | "leaves";

export function PayrollClient({
  initialData,
  currentMonth,
}: PayrollClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Local state for operators (defensively handles array or object shape)
  const initialOps = useMemo(() => {
    return Array.isArray(initialData)
      ? (initialData as unknown as HRPayrollOperator[])
      : (initialData?.operators || []);
  }, [initialData]);

  const [operators, setOperators] = useState<HRPayrollOperator[]>(initialOps);

  useEffect(() => {
    const nextOps = Array.isArray(initialData)
      ? (initialData as unknown as HRPayrollOperator[])
      : (initialData?.operators || []);
    setOperators(nextOps);
  }, [initialData]);

  // Optimistic Month state for instant UI update
  const [optimisticMonth, setOptimisticMonth] = useState(currentMonth);

  useEffect(() => {
    setOptimisticMonth(currentMonth);
  }, [currentMonth]);

  // Active View Mode (defaults to full statement, hydrated from URL)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = searchParams?.get("view");
    if (v === "attendance" || v === "earnings" || v === "deductions" || v === "payouts" || v === "leaves") {
      return v;
    }
    return "statement";
  });

  // Search state with debouncing to URL
  const [searchQuery, setSearchQuery] = useState(() => searchParams?.get("search") || "");
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Filters hydrated from URL searchParams
  const [payoutFilter, setPayoutFilter] = useState<string>(() => searchParams?.get("payout") || "all");
  const [stateFilter, setStateFilter] = useState<string>(() => searchParams?.get("state") || "all");
  const [sortBy, setSortBy] = useState<string>(() => searchParams?.get("sort") || "sl_no");

  const updateUrlParam = useCallback((key: string, value: string, defaultValue: string = "all") => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (value && value !== defaultValue) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }, []);

  const handleSearchChange = useCallback((newVal: string) => {
    setSearchQuery(newVal);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      updateUrlParam("search", newVal.trim(), "");
    }, 300);
  }, [updateUrlParam]);

  const handleViewModeChange = useCallback((newMode: string) => {
    const validMode = newMode as ViewMode;
    setViewMode(validMode);
    updateUrlParam("view", validMode, "statement");
  }, [updateUrlParam]);

  const handlePayoutFilterChange = useCallback((newVal: string) => {
    setPayoutFilter(newVal);
    updateUrlParam("payout", newVal, "all");
  }, [updateUrlParam]);

  const handleStateFilterChange = useCallback((newVal: string) => {
    setStateFilter(newVal);
    updateUrlParam("state", newVal, "all");
  }, [updateUrlParam]);

  const handleSortChange = useCallback((newVal: string) => {
    setSortBy(newVal);
    updateUrlParam("sort", newVal, "sl_no");
  }, [updateUrlParam]);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setPayoutFilter("all");
    setStateFilter("all");
    setSortBy("sl_no");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("search");
      url.searchParams.delete("payout");
      url.searchParams.delete("state");
      url.searchParams.delete("sort");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const sp = new URLSearchParams(window.location.search);
      setSearchQuery(sp.get("search") || "");
      setPayoutFilter(sp.get("payout") || "all");
      setStateFilter(sp.get("state") || "all");
      setSortBy(sp.get("sort") || "sl_no");
      const v = sp.get("view");
      if (v === "attendance" || v === "earnings" || v === "deductions" || v === "payouts" || v === "leaves") {
        setViewMode(v);
      } else {
        setViewMode("statement");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals state
  const [viewSlipOp, setViewSlipOp] = useState<HRPayrollOperator | null>(null);
  const [editStatementOp, setEditStatementOp] = useState<HRPayrollOperator | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<HRPayrollOperator>>({});
  const [isSavingStatement, setIsSavingStatement] = useState(false);

  // Month change with optimistic UI
  const handleMonthChange = (newMonth: string) => {
    setOptimisticMonth(newMonth);
    startTransition(() => {
      const sp = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      sp.set("month", newMonth);
      router.replace(`/payroll?${sp.toString()}`, { scroll: false });
    });
  };

  // Unique states for filter
  const uniqueStates = useMemo(() => {
    const s = new Set<string>();
    operators.forEach((op) => {
      if (op.state) s.add(op.state);
    });
    return Array.from(s).sort();
  }, [operators]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (payoutFilter !== "all") count++;
    if (stateFilter !== "all") count++;
    if (sortBy !== "sl_no") count++;
    if (searchQuery.trim() !== "") count++;
    return count;
  }, [payoutFilter, stateFilter, sortBy, searchQuery]);

  // Reusable Dropdown & Sort Options
  const payoutOptions: FilterDropdownOption[] = useMemo(
    () => [
      { value: "all", label: "All Payout Statuses" },
      { value: "pending", label: "Pending Balance (> ₹0)", dotColor: "bg-amber-500" },
      { value: "disbursed", label: "Fully Disbursed (₹0 Bal)", dotColor: "bg-emerald-500" },
      { value: "with_ot", label: "With Overtime", dotColor: "bg-indigo-500" },
      { value: "with_deductions", label: "With Deductions", dotColor: "bg-rose-500" },
    ],
    []
  );

  const stateOptions: FilterDropdownOption[] = useMemo(() => {
    return [
      { value: "all", label: "All States" },
      ...uniqueStates.map((st) => ({ value: st, label: st })),
    ];
  }, [uniqueStates]);

  const sortOptions: FilterDropdownOption[] = useMemo(
    () => [
      { value: "sl_no", label: "SL No (1 → 100)" },
      { value: "name_asc", label: "Name (A → Z)" },
      { value: "name_desc", label: "Name (Z → A)" },
      { value: "highest_net", label: "Highest Net Pay" },
      { value: "highest_attended", label: "Most Attended Days" },
      { value: "highest_ot", label: "Highest Overtime" },
      { value: "highest_balance", label: "Highest Unpaid Balance" },
    ],
    []
  );

  // Active filter chips
  const filterChips: FilterChipItem[] = useMemo(() => {
    const chips: FilterChipItem[] = [];
    if (payoutFilter && payoutFilter !== "all") {
      const labelMap: Record<string, string> = {
        pending: "Pending Balance",
        disbursed: "Fully Disbursed",
        with_ot: "With Overtime",
        with_deductions: "With Deductions",
      };
      chips.push({
        id: "payout",
        label: "Payout",
        valueLabel: labelMap[payoutFilter] || payoutFilter,
        onRemove: () => handlePayoutFilterChange("all"),
      });
    }
    if (stateFilter && stateFilter !== "all") {
      chips.push({
        id: "state",
        label: "State",
        valueLabel: stateFilter,
        onRemove: () => handleStateFilterChange("all"),
      });
    }
    if (sortBy && sortBy !== "sl_no") {
      const labelMap: Record<string, string> = {
        name_asc: "Name (A → Z)",
        name_desc: "Name (Z → A)",
        highest_net: "Highest Net",
        highest_attended: "Most Attended",
        highest_ot: "Highest Overtime",
        highest_balance: "Highest Balance",
      };
      chips.push({
        id: "sortBy",
        label: "Sort",
        valueLabel: labelMap[sortBy] || sortBy,
        onRemove: () => handleSortChange("sl_no"),
      });
    }
    if (searchQuery.trim()) {
      chips.push({
        id: "search",
        label: "Search",
        valueLabel: searchQuery.trim(),
        onRemove: () => handleSearchChange(""),
      });
    }
    return chips;
  }, [
    payoutFilter,
    stateFilter,
    sortBy,
    searchQuery,
    handlePayoutFilterChange,
    handleStateFilterChange,
    handleSortChange,
    handleSearchChange,
  ]);

  // Reusable View Tabs definition
  const viewTabs: TabItem[] = useMemo(
    () => [
      {
        id: "statement",
        label: "Full Statement",
        icon: <AnimatedFileSpreadsheet size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />,
      },
      {
        id: "attendance",
        label: "Attendance & Days",
        icon: <AnimatedCalendar size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />,
      },
      {
        id: "earnings",
        label: "Earnings Breakdown",
        icon: <AnimatedCreditCard size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" />,
      },
      {
        id: "deductions",
        label: "Deductions & Banking",
        icon: <AnimatedBuilding size={14} className="shrink-0 text-rose-600 dark:text-rose-400" />,
      },
      {
        id: "payouts",
        label: "Agency Payouts",
        icon: <AnimatedBriefcase size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />,
      },
      {
        id: "leaves",
        label: "Leave Ledger",
        icon: <AnimatedClock size={14} className="shrink-0 text-teal-600 dark:text-teal-400" />,
      },
    ],
    []
  );

  // Filtered & sorted operators
  const filteredOperators = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = operators.filter((op) => {
      // Search match
      const matchesSearch =
        !q ||
        op.full_name.toLowerCase().includes(q) ||
        (op.phone && op.phone.includes(q)) ||
        (op.city && op.city.toLowerCase().includes(q)) ||
        (op.state && op.state.toLowerCase().includes(q)) ||
        (op.bank_ifsc_code && op.bank_ifsc_code.toLowerCase().includes(q)) ||
        (op.bank_account_number && op.bank_account_number.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Payout status filter
      if (payoutFilter === "pending" && (op.balance_pay || 0) <= 0) return false;
      if (payoutFilter === "disbursed" && (op.balance_pay || 0) > 0) return false;
      if (payoutFilter === "with_ot" && (op.ot_days || 0) <= 0 && (op.ot_hours || 0) <= 0) return false;
      if (payoutFilter === "with_deductions" && ((op.loan_deduction || 0) + (op.advance_deduction || 0) + (op.other_deductions || 0)) <= 0) return false;

      // State filter
      if (stateFilter !== "all" && op.state !== stateFilter) return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "sl_no") return (a.sl_no || 0) - (b.sl_no || 0);
      if (sortBy === "name_asc") return a.full_name.localeCompare(b.full_name);
      if (sortBy === "name_desc") return b.full_name.localeCompare(a.full_name);
      if (sortBy === "highest_net") return (b.net_pay || b.total_pay || 0) - (a.net_pay || a.total_pay || 0);
      if (sortBy === "highest_attended") return (b.attended_days || b.work_days || 0) - (a.attended_days || a.work_days || 0);
      if (sortBy === "highest_ot") return (b.ot_days || 0) - (a.ot_days || 0);
      if (sortBy === "highest_balance") return (b.balance_pay || 0) - (a.balance_pay || 0);
      return 0;
    });

    return result;
  }, [operators, searchQuery, payoutFilter, stateFilter, sortBy]);

  // Monorepo Summary KPI calculations via canonical domain utility
  const kpis = useMemo(() => calculatePayrollKpis(operators), [operators]);

  // Multi-select handlers
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredOperators.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOperators.map((o) => o.operator_id)));
    }
  };

  // Open Edit Statement Modal
  const handleOpenEditStatement = (op: HRPayrollOperator) => {
    setEditStatementOp(op);
    setEditFormData({
      basic_salary: op.basic_salary || op.daily_rate * 30 || 28000,
      working_days: op.working_days || 30,
      attended_days: op.attended_days || op.work_days || 0,
      ot_days: op.ot_days || 0,
      pl_adjusted: op.pl_adjusted || 0,
      night_travel_days: op.night_travel_days || 0,
      night_travel_amount: op.night_travel_amount || 0,
      loan_deduction: op.loan_deduction || 0,
      additional_balance_salary: op.additional_balance_salary || 0,
      advance_deduction: op.advance_deduction || 0,
      advance_balance: op.advance_balance || 0,
      other_deductions: op.other_deductions || 0,
      pl_used_as_on_date: op.pl_used_as_on_date || 0,
      paid_reach: op.paid_reach || 0,
      paid_ss: op.paid_ss || 0,
      paid_quess: op.paid_quess || 0,
      total_pl_quota: op.total_pl_quota || 12,
      bank_account_number: op.bank_account_number || "XXXXXXXX1234",
      bank_ifsc_code: op.bank_ifsc_code || "BANK0001234",
      status: op.status || "draft",
      notes: op.notes || "",
    });
  };

  // Live calculation for Edit Modal via canonical domain formula
  const editComputed = useMemo(() => {
    return calculateOperatorSalary(editFormData);
  }, [editFormData]);

  // Save Statement Edit with Optimistic UI & Snapshot Rollback
  const handleSaveStatement = async () => {
    if (!editStatementOp) return;
    const previousOperators = [...operators];
    const opToUpdate = editStatementOp;
    const computed = editComputed;
    const formData = { ...editFormData };

    // 1. Optimistic Update immediately:
    const updatedOp: HRPayrollOperator = {
      ...opToUpdate,
      ...formData,
      total_days: computed.totalDays,
      attended_amount: computed.attendedAmt,
      pl_amount: computed.plAmt,
      ot_amount: computed.otAmt,
      total_earned: computed.totalEarned,
      gross_pay: computed.grossPay,
      net_pay: computed.netPay,
      balance_pay: computed.balance,
      pl_balance: computed.plBalance,
      total_pay: computed.grossPay,
      regular_pay: computed.attendedAmt + computed.plAmt,
      ot_pay: computed.otAmt,
    };

    setOperators((prev) =>
      prev.map((op) => (op.operator_id === opToUpdate.operator_id ? updatedOp : op))
    );

    // Instant modal dismiss and positive feedback for optimistic UI
    setEditStatementOp(null);
    toast("success", `Statement updated for ${opToUpdate.full_name}`);

    // 2. Perform background server action
    try {
      setIsSavingStatement(true);
      const res = await updateOperatorSalaryStatementAction(
        opToUpdate.operator_id,
        currentMonth,
        formData
      );

      if (!res.success) {
        // Rollback on server error
        setOperators(previousOperators);
        toast("error", res.error || "Failed to update statement. Changes rolled back.");
      }
    } catch {
      // Rollback on network error
      setOperators(previousOperators);
      toast("error", "Network error updating statement. Changes rolled back.");
    } finally {
      setIsSavingStatement(false);
    }
  };

  // Browser-native CSV Export matching EXACT 32 Excel Reference Columns via canonical domain utility
  const handleExportCSV = useCallback(() => {
    const listToExport =
      selectedIds.size > 0
        ? operators.filter((o) => selectedIds.has(o.operator_id))
        : operators;

    const rows = listToExport.map((op, idx) => formatPayrollCsvRow(op, idx));
    const csvContent = [PAYROLL_CSV_HEADERS.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Salary_Statement_${optimisticMonth || currentMonth}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Exported ${listToExport.length} operator records to Excel CSV format.`);
  }, [selectedIds, operators, optimisticMonth, currentMonth, toast]);

  // Mobile Top Header 3-dot integration for quick export
  useEffect(() => {
    const onQuickExport = () => {
      handleExportCSV();
    };
    window.addEventListener("reach:quick-export-csv", onQuickExport);
    window.addEventListener("reach:quick-export", onQuickExport);
    return () => {
      window.removeEventListener("reach:quick-export-csv", onQuickExport);
      window.removeEventListener("reach:quick-export", onQuickExport);
    };
  }, [handleExportCSV]);

  useRegisterPageActions(
    useMemo(
      () => ({
        onExportCSV: handleExportCSV,
        onExportExcel: handleExportCSV,
        onRefresh: () => router.refresh(),
      }),
      [handleExportCSV, router]
    )
  );

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-24 md:pb-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Operator Salary Statement"
        breadcrumbs={[{ label: "Payroll", href: "/payroll" }]}
        actions={
          <div className="flex items-center gap-2">
            <MonthSelect
              value={optimisticMonth}
              onChange={handleMonthChange}
              disabled={isPending}
              showQuickNav
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              icon={<AnimatedFileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />}
              className="h-9 px-3 text-xs font-semibold gap-1.5"
              title="Export Salary Statement Excel CSV"
            >
              <span>Export CSV</span>
            </Button>
          </div>
        }
      />

      {/* Mobile Dedicated Page Header (< md) */}
      <div className="flex md:hidden flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-ink)] tracking-tight">
              Payroll Statement
            </h1>
            <p className="text-xs text-[var(--color-mute)] font-mono">
              {filteredOperators.length} operator{filteredOperators.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCSV}
              icon={<AnimatedFileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />}
              className="h-10 px-3 text-xs font-semibold gap-1.5"
              title="Export Salary Statement Excel CSV"
            >
              <span>Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Mobile Month Select Strip with optimistic navigation */}
        <div className="relative">
          <MonthSelect
            value={optimisticMonth}
            onChange={handleMonthChange}
            disabled={isPending}
            showQuickNav
            className="w-full"
          />
        </div>
      </div>

      {/* 2. Interactive KPI Summary Cards */}
      <PayrollKPIStrip kpis={kpis} isPending={isPending} />

      {/* 3. Reusable View Mode Switcher Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[var(--color-hairline)]">
        <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
          <Tabs
            tabs={viewTabs}
            activeTab={viewMode}
            onChange={handleViewModeChange}
            variant="pill"
            className="w-max min-w-full sm:w-auto"
          />
        </div>

        <div className="text-xs text-[var(--color-mute)] font-mono whitespace-nowrap pl-1 sm:pl-2 shrink-0">
          {filteredOperators.length} of {operators.length} records
        </div>
      </div>

      {/* 4. Filter & Search Toolbar */}
      <div className="space-y-2">
        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          placeholder="Search operator, phone, city, state, IFSC..."
          activeFilterCount={activeFilterCount}
          onResetFilters={resetFilters}
          actions={
            <div className="text-xs text-[var(--color-mute)] px-2 whitespace-nowrap hidden sm:block font-mono">
              {filteredOperators.length} operator{filteredOperators.length !== 1 ? "s" : ""}
            </div>
          }
        >
          {/* Expandable Filter Controls Drawer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
            <FilterDropdown
              label="Payout Status"
              value={payoutFilter}
              onChange={handlePayoutFilterChange}
              options={payoutOptions}
            />

            <FilterDropdown
              label="State"
              value={stateFilter}
              onChange={handleStateFilterChange}
              options={stateOptions}
            />

            <SortControl
              options={sortOptions}
              sortField={sortBy}
              onSortFieldChange={handleSortChange}
            />
          </div>
        </FilterToolbar>

        {/* Active Filter Chips */}
        {filterChips.length > 0 && (
          <FilterChips chips={filterChips} onClearAll={resetFilters} />
        )}
      </div>

      {/* 5. Desktop High-Density Data Grid with Sticky Freeze Columns */}
      <PayrollDesktopTable
        operators={filteredOperators}
        viewMode={viewMode}
        selectedIds={selectedIds}
        onSelectAll={handleSelectAll}
        onToggleSelect={handleToggleSelect}
        onViewSlip={setViewSlipOp}
        onEditStatement={handleOpenEditStatement}
        searchQuery={searchQuery}
        activeFilterCount={activeFilterCount}
        onResetFilters={resetFilters}
      />

      {/* 6. Mobile Touch Cards View (≤640px) */}
      <div className="block md:hidden space-y-3">
        {/* Mobile Selection & Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-sans shadow-xs animate-in fade-in">
            <span className="font-semibold text-sky-800 dark:text-sky-200">
              {selectedIds.size} operator{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCSV}
                className="h-8 px-2.5 text-xs font-semibold"
              >
                Export Selected
              </Button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-sky-600 hover:text-sky-800 dark:text-sky-400 p-1 text-xs font-medium cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {filteredOperators.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-6">
            <EmptyState
              icon={<AnimatedCreditCard size={28} />}
              title="No operators found"
              description={
                activeFilterCount > 0
                  ? "No records match your active search and filter criteria."
                  : "No operators recorded for this period."
              }
              action={
                activeFilterCount > 0 ? (
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Clear Filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          filteredOperators.map((op, idx) => (
            <PayrollMobileCard
              key={op.operator_id}
              op={op}
              idx={idx}
              isSelected={selectedIds.has(op.operator_id)}
              onToggleSelect={handleToggleSelect}
              onViewSlip={setViewSlipOp}
              onEditStatement={handleOpenEditStatement}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>

      {/* 7. Salary Slip Modal (Printable & Exportable Slip Parity) */}
      <SalarySlipModal
        open={!!viewSlipOp}
        onClose={() => setViewSlipOp(null)}
        operator={viewSlipOp}
        payrollMonth={initialData.payrollMonth}
      />

      {/* 8. Edit Salary Statement Modal with Live Calculations */}
      <EditStatementModal
        open={!!editStatementOp}
        onClose={() => setEditStatementOp(null)}
        operator={editStatementOp}
        formData={editFormData}
        setFormData={setEditFormData}
        computed={editComputed}
        isSaving={isSavingStatement}
        onSave={handleSaveStatement}
      />
    </div>
  );
}

// Alias for backward compatibility
export const HRPayrollClient = PayrollClient;
