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
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Clock,
  Briefcase,
  User,
  Shield,
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
import type { HRPayrollSummary, HRPayrollOperator } from "@/lib/types/database";
import type { UserRole } from "@reachinternational/types";
import {
  updateOperatorRates,
  bulkUpdateOperatorRates,
  updateOperatorSalaryStatementAction,
} from "@/app/actions/payroll";

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

  // Local state for operators
  const [prevInitialData, setPrevInitialData] = useState(initialData);
  const [operators, setOperators] = useState<HRPayrollOperator[]>(
    initialData.operators || []
  );

  if (prevInitialData !== initialData) {
    setPrevInitialData(initialData);
    setOperators(initialData.operators || []);
  }

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

  // Month change
  const handleMonthChange = (newMonth: string) => {
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

  // Monorepo Summary KPI calculations
  const kpis = useMemo(() => {
    let totalGross = 0;
    let totalNet = 0;
    let totalPaid = 0;
    let totalBalance = 0;
    let totalAttendedDays = 0;
    let totalOtDays = 0;
    let totalPlAdjusted = 0;

    operators.forEach((op) => {
      totalGross += op.gross_pay || op.total_pay || 0;
      totalNet += op.net_pay || op.total_pay || 0;
      totalPaid += (op.paid_reach || 0) + (op.paid_ss || 0) + (op.paid_quess || 0);
      totalBalance += op.balance_pay || 0;
      totalAttendedDays += op.attended_days || op.work_days || 0;
      totalOtDays += op.ot_days || 0;
      totalPlAdjusted += op.pl_adjusted || 0;
    });

    return {
      operatorCount: operators.length,
      totalGross: Math.round(totalGross),
      totalNet: Math.round(totalNet),
      totalPaid: Math.round(totalPaid),
      totalBalance: Math.round(totalBalance),
      totalAttendedDays: Math.round(totalAttendedDays * 10) / 10,
      totalOtDays: Math.round(totalOtDays * 10) / 10,
      totalPlAdjusted: Math.round(totalPlAdjusted * 10) / 10,
    };
  }, [operators]);

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

  // Live calculation for Edit Modal
  const editComputed = useMemo(() => {
    const basic = Number(editFormData.basic_salary) || 0;
    const wd = Math.max(1, Number(editFormData.working_days) || 30);
    const ad = Number(editFormData.attended_days) || 0;
    const otDays = Number(editFormData.ot_days) || 0;
    const plAdj = Number(editFormData.pl_adjusted) || 0;
    const ntAmt = Number(editFormData.night_travel_amount) || 0;
    const loan = Number(editFormData.loan_deduction) || 0;
    const addBal = Number(editFormData.additional_balance_salary) || 0;
    const advDed = Number(editFormData.advance_deduction) || 0;
    const otherDed = Number(editFormData.other_deductions) || 0;
    const plUsed = Number(editFormData.pl_used_as_on_date) || 0;
    const reach = Number(editFormData.paid_reach) || 0;
    const ss = Number(editFormData.paid_ss) || 0;
    const quess = Number(editFormData.paid_quess) || 0;
    const totalPl = Number(editFormData.total_pl_quota) || 12;

    const totalDays = ad + plAdj + otDays;
    const attendedAmt = Math.round(((basic / wd) * ad) * 100) / 100;
    const plAmt = Math.round(((basic / wd) * plAdj) * 100) / 100;
    const otAmt = Math.round(((basic / wd) * otDays) * 100) / 100;
    const totalEarned = Math.round((attendedAmt + plAmt + ntAmt) * 100) / 100;
    const grossPay = Math.round((totalEarned + otAmt + addBal) * 100) / 100;
    const netPay = Math.round((grossPay - (loan + advDed + otherDed)) * 100) / 100;
    const balance = Math.round((netPay - (reach + ss + quess)) * 100) / 100;
    const plBalance = Math.max(0, totalPl - (plUsed + plAdj));

    return {
      totalDays,
      attendedAmt,
      plAmt,
      otAmt,
      totalEarned,
      grossPay,
      netPay,
      balance,
      plBalance,
    };
  }, [editFormData]);

  // Save Statement Edit
  const handleSaveStatement = async () => {
    if (!editStatementOp) return;
    setIsSavingStatement(true);
    try {
      const res = await updateOperatorSalaryStatementAction(
        editStatementOp.operator_id,
        currentMonth,
        editFormData
      );

      if (res.success) {
        // Update local operator item
        setOperators((prev) =>
          prev.map((op) => {
            if (op.operator_id === editStatementOp.operator_id) {
              return {
                ...op,
                ...editFormData,
                total_days: editComputed.totalDays,
                attended_amount: editComputed.attendedAmt,
                pl_amount: editComputed.plAmt,
                ot_amount: editComputed.otAmt,
                total_earned: editComputed.totalEarned,
                gross_pay: editComputed.grossPay,
                net_pay: editComputed.netPay,
                balance_pay: editComputed.balance,
                pl_balance: editComputed.plBalance,
                total_pay: editComputed.grossPay,
                regular_pay: editComputed.attendedAmt + editComputed.plAmt,
                ot_pay: editComputed.otAmt,
              };
            }
            return op;
          })
        );
        toast("success", `Statement updated for ${editStatementOp.full_name}`);
        setEditStatementOp(null);
      } else {
        toast("error", res.error || "Failed to update statement");
      }
    } catch {
      toast("error", "Network error updating statement");
    } finally {
      setIsSavingStatement(false);
    }
  };

  // Browser-native CSV Export matching EXACT 32 Excel Reference Columns
  const handleExportCSV = useCallback(() => {
    const listToExport =
      selectedIds.size > 0
        ? operators.filter((o) => selectedIds.has(o.operator_id))
        : operators;

    const headers = [
      "SL NO",
      "NAME",
      "DOJ",
      "BASIC",
      "EARNED",
      "W/D",
      "A/D",
      "OT days",
      "PL ADJUSTED",
      "Total Days",
      "AMOUNT",
      "PL AMT.",
      "N/T",
      "Amt",
      "TOTAL",
      "Loan",
      "Add Bal Salary",
      "ADV./Other Deduction",
      "ADV. BAL.",
      "Dedu",
      "PL Use as on date",
      "OT AMT",
      "Gross/Pay",
      "Net/Pay",
      "PAID REACH",
      "S&S",
      "QUESS",
      "BALANCE",
      "TOTAL PL",
      "PL BALANCE",
      "AC NO",
      "IFSC CODE",
    ];

    const rows = listToExport.map((op, idx) => [
      op.sl_no || idx + 1,
      `"${(op.full_name || "").replace(/"/g, '""')}"`,
      `"${op.doj || ""}"`,
      op.basic_salary || 0,
      op.earned_basic || op.basic_salary || 0,
      op.working_days || 30,
      op.attended_days || op.work_days || 0,
      op.ot_days || 0,
      op.pl_adjusted || 0,
      op.total_days || 0,
      op.attended_amount || 0,
      op.pl_amount || 0,
      op.night_travel_days || 0,
      op.night_travel_amount || 0,
      op.total_earned || 0,
      op.loan_deduction || 0,
      op.additional_balance_salary || 0,
      op.advance_deduction || 0,
      op.advance_balance || 0,
      op.other_deductions || 0,
      op.pl_used_as_on_date || 0,
      op.ot_amount || 0,
      op.gross_pay || op.total_pay || 0,
      op.net_pay || op.total_pay || 0,
      op.paid_reach || 0,
      op.paid_ss || 0,
      op.paid_quess || 0,
      op.balance_pay || 0,
      op.total_pl_quota || 12,
      op.pl_balance || 12,
      `"${op.bank_account_number || ""}"`,
      `"${op.bank_ifsc_code || ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Salary_Statement_${initialData.payrollMonth}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Exported ${listToExport.length} operator records to Excel CSV format.`);
  }, [selectedIds, operators, initialData, toast]);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-24 md:pb-6">
      {/* 1. Page Header */}
      <PageHeader
        title="Operator Salary Statement"
        breadcrumbs={[{ label: "Payroll", href: "/payroll" }]}
        actions={
          <div className="flex items-center gap-2">
            <MonthSelect
              value={currentMonth}
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

      {/* Mobile Actions Toolbar */}
      <div className="flex md:hidden items-center justify-between gap-2">
        <MonthSelect
          value={currentMonth}
          onChange={handleMonthChange}
          disabled={isPending}
          showQuickNav
          compact
          className="flex-1"
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCSV}
          icon={<AnimatedFileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />}
          className="h-11 px-3.5 text-xs font-semibold gap-1.5 shrink-0"
          title="Export CSV"
        >
          <span>Export</span>
        </Button>
      </div>

      {/* 2. Interactive KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Total Gross Payroll */}
        <motion.div
          data-hover-parent
          whileTap={{ scale: 0.98 }}
          className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-[var(--color-ink)]/30"
        >
          <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">
              Total Gross Payroll
            </span>
            <AnimatedCreditCard size={16} className="w-4 h-4 shrink-0 text-sky-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] font-mono">
            ₹{kpis.totalGross.toLocaleString("en-IN")}
          </div>
        </motion.div>

        {/* Total Net Payable */}
        <motion.div
          data-hover-parent
          whileTap={{ scale: 0.98 }}
          className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-emerald-500/40"
        >
          <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
              Net Payable
            </span>
            <AnimatedBriefcase size={16} className="w-4 h-4 shrink-0 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            ₹{kpis.totalNet.toLocaleString("en-IN")}
          </div>
        </motion.div>

        {/* Disbursed vs Unpaid Balance */}
        <motion.div
          data-hover-parent
          whileTap={{ scale: 0.98 }}
          className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-amber-500/40"
        >
          <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 truncate">
              Disbursed vs Unpaid
            </span>
            <AnimatedClock size={16} className="w-4 h-4 shrink-0 text-amber-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] font-mono flex items-baseline gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400">₹{kpis.totalPaid.toLocaleString("en-IN")}</span>
            <span className="text-xs font-normal text-[var(--color-mute)]">/ bal ₹{kpis.totalBalance.toLocaleString("en-IN")}</span>
          </div>
        </motion.div>

        {/* Total Working & Attended Days */}
        <motion.div
          data-hover-parent
          whileTap={{ scale: 0.98 }}
          className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-indigo-500/40"
        >
          <div className="flex items-center justify-between text-[var(--color-mute)] gap-2 pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 truncate">
              Days & Leave Summary
            </span>
            <AnimatedCalendar size={16} className="w-4 h-4 shrink-0 text-indigo-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono flex items-baseline gap-1.5">
            <span>{kpis.totalAttendedDays} d</span>
            <span className="text-xs font-normal text-[var(--color-mute)]">/ OT {kpis.totalOtDays} d</span>
          </div>
        </motion.div>
      </div>

      {/* 3. Reusable View Mode Switcher Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[var(--color-hairline)]">
        <Tabs
          tabs={viewTabs}
          activeTab={viewMode}
          onChange={handleViewModeChange}
          variant="pill"
          className="max-w-full"
        />

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
      <div className="hidden md:block rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[750px]">
          <table className="w-full text-left text-xs border-collapse font-sans whitespace-nowrap">
            {/* Multi-tier Group Header Bar */}
            <thead className="sticky top-0 z-30 bg-[var(--color-canvas)] border-b border-[var(--color-hairline)]">
              <tr className="border-b border-[var(--color-hairline)]/70 text-[10px] uppercase font-bold tracking-wider text-[var(--color-mute)]">
                <th colSpan={3} className="py-1 px-3 bg-[var(--color-canvas)] border-r border-[var(--color-hairline)] sticky left-0 z-40">
                  Identity Details
                </th>

                {(viewMode === "statement" || viewMode === "attendance") && (
                  <th colSpan={7} className="py-1 px-3 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-r border-[var(--color-hairline)] text-center">
                    Attendance & Days
                  </th>
                )}

                {(viewMode === "statement" || viewMode === "earnings") && (
                  <th colSpan={7} className="py-1 px-3 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-r border-[var(--color-hairline)] text-center">
                    Earnings Breakdown
                  </th>
                )}

                {(viewMode === "statement" || viewMode === "deductions") && (
                  <th colSpan={6} className="py-1 px-3 bg-rose-500/10 text-rose-700 dark:text-rose-300 border-r border-[var(--color-hairline)] text-center">
                    Deductions & Recoveries
                  </th>
                )}

                {(viewMode === "statement" || viewMode === "payouts") && (
                  <th colSpan={4} className="py-1 px-3 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-r border-[var(--color-hairline)] text-center">
                    Agency Disbursements & Balance
                  </th>
                )}

                {(viewMode === "statement" || viewMode === "leaves") && (
                  <th colSpan={2} className="py-1 px-3 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-r border-[var(--color-hairline)] text-center">
                    Leave Ledger
                  </th>
                )}

                {(viewMode === "statement" || viewMode === "deductions") && (
                  <th colSpan={2} className="py-1 px-3 bg-slate-500/10 text-slate-700 dark:text-slate-300 border-r border-[var(--color-hairline)] text-center">
                    Bank Info
                  </th>
                )}

                <th className="py-1 px-3 bg-[var(--color-canvas)] text-center">Actions</th>
              </tr>

              {/* Exact Excel Column Header Row */}
              <tr className="border-b border-[var(--color-hairline)] text-[11px] font-semibold text-[var(--color-body)] uppercase">
                {/* Checkbox */}
                <th className="py-2.5 px-2 w-9 text-center sticky left-0 z-40 bg-[var(--color-canvas)]">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="h-4.5 w-4.5 rounded border border-[var(--color-hairline)] hover:border-[var(--color-ink)] flex items-center justify-center transition-colors cursor-pointer"
                    title={selectedIds.size === filteredOperators.length ? "Deselect all" : "Select all"}
                  >
                    {selectedIds.size === filteredOperators.length && filteredOperators.length > 0 && (
                      <AnimatedCheck size={11} className="text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>
                </th>

                {/* SL NO */}
                <th className="py-2.5 px-2.5 text-center w-12 sticky left-9 z-40 bg-[var(--color-canvas)] border-r border-[var(--color-hairline)]">
                  SL NO
                </th>

                {/* NAME */}
                <th className="py-2.5 px-3.5 min-w-[180px] sticky left-[84px] z-40 bg-[var(--color-canvas)] border-r border-[var(--color-hairline)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                  NAME
                </th>

                {/* ATTENDANCE COLUMNS */}
                {(viewMode === "statement" || viewMode === "attendance") && (
                  <>
                    <th className="py-2.5 px-3 text-center">DOJ</th>
                    <th className="py-2.5 px-3 text-right">BASIC</th>
                    <th className="py-2.5 px-3 text-right">EARNED</th>
                    <th className="py-2.5 px-2.5 text-center font-mono">W/D</th>
                    <th className="py-2.5 px-2.5 text-center font-mono text-blue-600 dark:text-blue-400">A/D</th>
                    <th className="py-2.5 px-2.5 text-center font-mono">OT days</th>
                    <th className="py-2.5 px-2.5 text-center font-mono">PL ADJ</th>
                    <th className="py-2.5 px-2.5 text-center font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50/30 dark:bg-blue-950/20">
                      Total Days
                    </th>
                  </>
                )}

                {/* EARNINGS COLUMNS */}
                {(viewMode === "statement" || viewMode === "earnings") && (
                  <>
                    <th className="py-2.5 px-3 text-right font-mono">AMOUNT</th>
                    <th className="py-2.5 px-3 text-right font-mono">PL AMT.</th>
                    <th className="py-2.5 px-2.5 text-center font-mono">N/T</th>
                    <th className="py-2.5 px-3 text-right font-mono">Amt</th>
                    <th className="py-2.5 px-3 text-right font-mono font-semibold">TOTAL</th>
                    <th className="py-2.5 px-3 text-right font-mono text-amber-600 dark:text-amber-400">OT AMT</th>
                    <th className="py-2.5 px-3.5 text-right font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-50/30 dark:bg-sky-950/20">
                      Gross/Pay
                    </th>
                  </>
                )}

                {/* DEDUCTIONS COLUMNS */}
                {(viewMode === "statement" || viewMode === "deductions") && (
                  <>
                    <th className="py-2.5 px-3 text-right font-mono">Loan</th>
                    <th className="py-2.5 px-3 text-right font-mono">Add Bal Salary</th>
                    <th className="py-2.5 px-3 text-right font-mono">ADV./Deduction</th>
                    <th className="py-2.5 px-3 text-right font-mono">ADV. BAL.</th>
                    <th className="py-2.5 px-3 text-right font-mono">Dedu</th>
                    <th className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/20">
                      Net/Pay
                    </th>
                  </>
                )}

                {/* AGENCY DISBURSEMENTS COLUMNS */}
                {(viewMode === "statement" || viewMode === "payouts") && (
                  <>
                    <th className="py-2.5 px-3 text-right font-mono">PAID REACH</th>
                    <th className="py-2.5 px-3 text-right font-mono">S&amp;S</th>
                    <th className="py-2.5 px-3 text-right font-mono">QUESS</th>
                    <th className="py-2.5 px-3.5 text-right font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-950/20">
                      BALANCE
                    </th>
                  </>
                )}

                {/* LEAVE LEDGER COLUMNS */}
                {(viewMode === "statement" || viewMode === "leaves") && (
                  <>
                    <th className="py-2.5 px-3 text-center font-mono">TOTAL PL</th>
                    <th className="py-2.5 px-3 text-center font-mono font-bold text-indigo-700 dark:text-indigo-300">
                      PL BALANCE
                    </th>
                  </>
                )}

                {/* BANK DETAILS */}
                {(viewMode === "statement" || viewMode === "deductions") && (
                  <>
                    <th className="py-2.5 px-3 font-mono">AC NO</th>
                    <th className="py-2.5 px-3 font-mono">IFSC CODE</th>
                  </>
                )}

                {/* ACTIONS */}
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]">
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan={34} className="py-12 text-center">
                    <EmptyState
                      icon={<AnimatedCreditCard size={32} />}
                      title="No operator payroll records found"
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
                  </td>
                </tr>
              ) : (
                filteredOperators.map((op, index) => {
                  const isSelected = selectedIds.has(op.operator_id);

                  return (
                    <tr
                      key={op.operator_id}
                      className={`hover:bg-[var(--color-canvas)]/50 transition-colors group ${
                        isSelected ? "bg-sky-50/30 dark:bg-sky-950/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2 px-2 text-center sticky left-0 z-20 bg-[var(--color-canvas-elevated)] group-hover:bg-[var(--color-canvas)]/60">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(op.operator_id)}
                          className={`h-4.5 w-4.5 rounded border transition-all flex items-center justify-center cursor-pointer ${
                            isSelected
                              ? "bg-[var(--color-ink)] border-[var(--color-ink)] text-[var(--color-canvas)]"
                              : "border-[var(--color-hairline)] hover:border-[var(--color-ink)]/50"
                          }`}
                        >
                          {isSelected && <AnimatedCheck size={11} />}
                        </button>
                      </td>

                      {/* SL NO */}
                      <td className="py-2 px-2.5 text-center font-mono text-[var(--color-mute)] sticky left-9 z-20 bg-[var(--color-canvas-elevated)] group-hover:bg-[var(--color-canvas)]/60 border-r border-[var(--color-hairline)]">
                        {op.sl_no || index + 1}
                      </td>

                      {/* NAME */}
                      <td className="py-2 px-3.5 sticky left-[84px] z-20 bg-[var(--color-canvas-elevated)] group-hover:bg-[var(--color-canvas)]/60 border-r border-[var(--color-hairline)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/users?search=${encodeURIComponent(op.full_name)}`}
                            title={`View ${op.full_name}'s profile`}
                            className="font-semibold text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors inline-flex items-center gap-1 truncate"
                          >
                            <span className="truncate">{highlightText(op.full_name, searchQuery)}</span>
                          </Link>
                        </div>
                        <div className="text-[10px] text-[var(--color-mute)] font-mono truncate">
                          {op.phone ? highlightText(op.phone, searchQuery) : "No phone"}
                          {op.city ? ` • ${op.city}` : ""}
                        </div>
                      </td>

                      {/* ATTENDANCE & DAYS */}
                      {(viewMode === "statement" || viewMode === "attendance") && (
                        <>
                          <td className="py-2 px-3 text-center text-[var(--color-mute)] font-mono">
                            {op.doj || "—"}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            ₹{(op.basic_salary || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            ₹{(op.earned_basic || op.basic_salary || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-[var(--color-mute)]">
                            {op.working_days || 30}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono font-semibold text-blue-600 dark:text-blue-400">
                            {op.attended_days || op.work_days || 0}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-[var(--color-body)]">
                            {op.ot_days || 0}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-[var(--color-body)]">
                            {op.pl_adjusted || 0}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50/20 dark:bg-blue-950/10">
                            {op.total_days || 0}
                          </td>
                        </>
                      )}

                      {/* EARNINGS */}
                      {(viewMode === "statement" || viewMode === "earnings") && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-ink)]">
                            ₹{(op.attended_amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-ink)]">
                            ₹{(op.pl_amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono text-[var(--color-mute)]">
                            {op.night_travel_days || 0}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-mute)]">
                            ₹{(op.night_travel_amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-[var(--color-ink)]">
                            ₹{(op.total_earned || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-600 dark:text-amber-400 font-medium">
                            ₹{(op.ot_amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3.5 text-right font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-50/20 dark:bg-sky-950/10">
                            ₹{(op.gross_pay || op.total_pay || 0).toLocaleString("en-IN")}
                          </td>
                        </>
                      )}

                      {/* DEDUCTIONS */}
                      {(viewMode === "statement" || viewMode === "deductions") && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-mute)]">
                            ₹{(op.loan_deduction || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-mute)]">
                            ₹{(op.additional_balance_salary || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-mute)]">
                            ₹{(op.advance_deduction || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-mute)]">
                            ₹{(op.advance_balance || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-mute)]">
                            ₹{(op.other_deductions || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                            ₹{(op.net_pay || op.total_pay || 0).toLocaleString("en-IN")}
                          </td>
                        </>
                      )}

                      {/* AGENCY PAYOUTS & BALANCE */}
                      {(viewMode === "statement" || viewMode === "payouts") && (
                        <>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-body)]">
                            ₹{(op.paid_reach || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-body)]">
                            ₹{(op.paid_ss || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[var(--color-body)]">
                            ₹{(op.paid_quess || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/10">
                            ₹{(op.balance_pay || 0).toLocaleString("en-IN")}
                          </td>
                        </>
                      )}

                      {/* LEAVE LEDGER */}
                      {(viewMode === "statement" || viewMode === "leaves") && (
                        <>
                          <td className="py-2 px-3 text-center font-mono text-[var(--color-body)]">
                            {op.total_pl_quota || 12}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {op.pl_balance || 0}
                          </td>
                        </>
                      )}

                      {/* BANK INFO */}
                      {(viewMode === "statement" || viewMode === "deductions") && (
                        <>
                          <td className="py-2 px-3 font-mono text-[11px] text-[var(--color-mute)]">
                            {op.bank_account_number || "XXXXXXXX1234"}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-[var(--color-mute)]">
                            {op.bank_ifsc_code || "BANK0001234"}
                          </td>
                        </>
                      )}

                      {/* ACTIONS */}
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewSlipOp(op)}
                            className="p-1.5 text-[var(--color-mute)] hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded-md transition-colors cursor-pointer"
                            title="View Salary Slip"
                          >
                            <AnimatedFileText size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditStatement(op)}
                            className="p-1.5 text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] rounded-md transition-colors cursor-pointer"
                            title="Edit Salary Statement"
                          >
                            <AnimatedEdit2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Mobile Touch Cards View (≤640px) */}
      <div className="block md:hidden space-y-3">
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
          filteredOperators.map((op, idx) => {
            const isSelected = selectedIds.has(op.operator_id);

            return (
              <div
                key={op.operator_id}
                className={`rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-xs space-y-3 transition-colors ${
                  isSelected ? "ring-1 ring-sky-500 bg-sky-50/15" : ""
                }`}
              >
                {/* Header Row: Checkbox, Name, SL NO, Net Pay */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(op.operator_id)}
                      className={`mt-0.5 h-5 w-5 rounded border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                        isSelected
                          ? "bg-[var(--color-ink)] border-[var(--color-ink)] text-[var(--color-canvas)]"
                          : "border-[var(--color-hairline)] hover:border-[var(--color-ink)]/50"
                      }`}
                    >
                      {isSelected && <AnimatedCheck size={12} />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold text-[var(--color-mute)] bg-[var(--color-canvas)] px-1.5 py-0.5 rounded border border-[var(--color-hairline)]">
                          #{op.sl_no || idx + 1}
                        </span>
                        <Link
                          href={`/users?search=${encodeURIComponent(op.full_name)}`}
                          title={`View ${op.full_name}'s record`}
                          className="font-semibold text-sm text-[var(--color-ink)] hover:text-sky-600 transition-colors truncate"
                        >
                          <span className="truncate">{highlightText(op.full_name, searchQuery)}</span>
                        </Link>
                      </div>
                      <p className="text-xs text-[var(--color-mute)] font-mono truncate mt-0.5">
                        {op.phone ? highlightText(op.phone, searchQuery) : "No phone"} • {op.city || op.state || "No location"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-semibold text-[var(--color-mute)] block">
                      Net Pay
                    </span>
                    <span className="font-bold text-base text-emerald-600 dark:text-emerald-400 font-mono">
                      ₹{(op.net_pay || op.total_pay || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Quick KPI Stat Strip */}
                <div className="grid grid-cols-3 gap-2 text-xs bg-[var(--color-canvas)] p-2.5 rounded-lg border border-[var(--color-hairline)]">
                  <div>
                    <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Attended Days</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 font-mono">
                      {op.attended_days || op.work_days || 0} / {op.working_days || 30} d
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Gross Pay</span>
                    <span className="font-semibold text-[var(--color-ink)] font-mono">
                      ₹{(op.gross_pay || op.total_pay || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Unpaid Bal</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                      ₹{(op.balance_pay || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Additional Detailed Breakdown Drawer on Mobile */}
                <div className="space-y-1.5 text-xs text-[var(--color-body)] pt-1 border-t border-[var(--color-hairline)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-mute)]">Basic Monthly Salary:</span>
                    <span className="font-mono font-medium">₹{(op.basic_salary || 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-mute)]">Overtime &amp; Leaves:</span>
                    <span className="font-mono">OT: {op.ot_days || 0}d (₹{(op.ot_amount || 0).toLocaleString("en-IN")}) • PL: {op.pl_adjusted || 0}d</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-mute)]">Deductions (Loan/Adv):</span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      -₹{((op.loan_deduction || 0) + (op.advance_deduction || 0) + (op.other_deductions || 0)).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-mute)]">PL Balance &amp; Bank:</span>
                    <span className="font-mono text-[11px] truncate">
                      {op.pl_balance || 0} PL left • {op.bank_ifsc_code || "BANK0001234"}
                    </span>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--color-hairline)]">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setViewSlipOp(op)}
                    icon={<AnimatedFileText size={14} className="text-sky-500" />}
                    className="h-11 px-3 text-xs font-semibold gap-1.5 flex-1"
                  >
                    <span>View Salary Slip</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenEditStatement(op)}
                    icon={<AnimatedEdit2 size={13} />}
                    className="h-11 px-3 text-xs font-semibold gap-1.5 flex-1"
                  >
                    <span>Edit Statement</span>
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 7. Salary Slip Modal (Printable & Exportable Slip Parity) */}
      <Modal
        open={!!viewSlipOp}
        onClose={() => setViewSlipOp(null)}
        title="Official Salary Statement Slip"
        description={`Monthly compensation statement for ${viewSlipOp?.full_name} (${initialData.payrollMonth})`}
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") window.print();
              }}
              icon={<Printer size={14} />}
              className="h-9 px-3 text-xs font-semibold gap-1.5"
            >
              <span>Print Slip</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setViewSlipOp(null)}
              className="h-9 px-4 text-xs font-semibold"
            >
              Close
            </Button>
          </div>
        }
      >
        {viewSlipOp && (
          <div className="space-y-4 py-2 text-xs font-sans">
            {/* Slip Header Box */}
            <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
              <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-2">
                <div>
                  <h4 className="font-extrabold text-sm text-[var(--color-ink)] uppercase tracking-wider">
                    REACH INTERNATIONAL
                  </h4>
                  <p className="text-[11px] text-[var(--color-mute)]">Industrial Fleet &amp; Personnel Operations</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs bg-[var(--color-ink)] text-[var(--color-canvas)] px-2 py-0.5 rounded">
                    SL #{viewSlipOp.sl_no || 1}
                  </span>
                  <p className="text-[10px] text-[var(--color-mute)] mt-0.5">Month: {initialData.payrollMonth}</p>
                </div>
              </div>

              {/* Operator details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-[var(--color-mute)] block">Operator Name:</span>
                  <span className="font-semibold text-[var(--color-ink)]">{viewSlipOp.full_name}</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block">Phone Number:</span>
                  <span className="font-mono text-[var(--color-ink)]">{viewSlipOp.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block">Date of Joining:</span>
                  <span className="font-mono text-[var(--color-ink)]">{viewSlipOp.doj || "—"}</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block">Bank Account:</span>
                  <span className="font-mono text-[var(--color-ink)]">{viewSlipOp.bank_account_number || "XXXXXXXX1234"}</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block">IFSC Code:</span>
                  <span className="font-mono text-[var(--color-ink)]">{viewSlipOp.bank_ifsc_code || "BANK0001234"}</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] block">Location:</span>
                  <span className="text-[var(--color-ink)]">{viewSlipOp.city || viewSlipOp.state || "—"}</span>
                </div>
              </div>
            </div>

            {/* Attendance Days Ledger */}
            <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-50/20 dark:bg-blue-950/10">
              <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300 block mb-1.5">
                Attendance &amp; Payable Days
              </span>
              <div className="grid grid-cols-5 gap-2 text-center font-mono text-[11px]">
                <div>
                  <span className="text-[var(--color-mute)] text-[10px] block">Working (W/D)</span>
                  <span className="font-semibold">{viewSlipOp.working_days || 30} d</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] text-[10px] block">Attended (A/D)</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{viewSlipOp.attended_days || viewSlipOp.work_days || 0} d</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] text-[10px] block">OT Days</span>
                  <span className="font-semibold">{viewSlipOp.ot_days || 0} d</span>
                </div>
                <div>
                  <span className="text-[var(--color-mute)] text-[10px] block">PL Adjusted</span>
                  <span className="font-semibold">{viewSlipOp.pl_adjusted || 0} d</span>
                </div>
                <div className="bg-blue-500/10 rounded py-0.5">
                  <span className="text-blue-700 dark:text-blue-300 text-[10px] block font-bold">Total Days</span>
                  <span className="font-extrabold text-blue-700 dark:text-blue-300">{viewSlipOp.total_days || 0} d</span>
                </div>
              </div>
            </div>

            {/* Financials 2-Column Box: Earnings vs Deductions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Earnings Column */}
              <div className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300 block pb-1 border-b border-[var(--color-hairline)]">
                  Earnings
                </span>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">Basic Salary (Monthly):</span>
                  <span className="font-mono">₹{(viewSlipOp.basic_salary || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">Attended Amount:</span>
                  <span className="font-mono">₹{(viewSlipOp.attended_amount || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">Paid Leave Amount:</span>
                  <span className="font-mono">₹{(viewSlipOp.pl_amount || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">Overtime Amount (OT):</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">₹{(viewSlipOp.ot_amount || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">Night / Travel Allowance:</span>
                  <span className="font-mono">₹{(viewSlipOp.night_travel_amount || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-1.5 border-t border-[var(--color-hairline)] font-bold text-sky-700 dark:text-sky-300">
                  <span>Gross Pay:</span>
                  <span className="font-mono">₹{(viewSlipOp.gross_pay || viewSlipOp.total_pay || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Deductions Column */}
              <div className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300 block pb-1 border-b border-[var(--color-hairline)]">
                  Deductions &amp; Recoveries
                </span>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">Loan Deduction:</span>
                  <span className="font-mono">₹{(viewSlipOp.loan_deduction || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">Advance Salary Deduction:</span>
                  <span className="font-mono">₹{(viewSlipOp.advance_deduction || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">Advance Balance Remaining:</span>
                  <span className="font-mono">₹{(viewSlipOp.advance_balance || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--color-mute)]">Other Miscellaneous Deductions:</span>
                  <span className="font-mono">₹{(viewSlipOp.other_deductions || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-1.5 border-t border-[var(--color-hairline)] font-bold text-rose-700 dark:text-rose-300">
                  <span>Total Deductions:</span>
                  <span className="font-mono">
                    ₹{((viewSlipOp.loan_deduction || 0) + (viewSlipOp.advance_deduction || 0) + (viewSlipOp.other_deductions || 0)).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Net Pay Banner */}
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-200 block">
                  Net Salary Payable
                </span>
                <p className="text-[11px] text-[var(--color-mute)]">Transferred to bank account on scheduled disbursement date</p>
              </div>
              <div className="text-right">
                <span className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{(viewSlipOp.net_pay || viewSlipOp.total_pay || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Agency Disbursement Split & Leave Ledger */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] space-y-1">
                <span className="font-semibold text-[10px] uppercase text-[var(--color-mute)] block">Agency Payout Split</span>
                <div className="flex justify-between">
                  <span>Reach International:</span>
                  <span className="font-mono">₹{(viewSlipOp.paid_reach || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>S&amp;S Staffing:</span>
                  <span className="font-mono">₹{(viewSlipOp.paid_ss || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Quess Corp:</span>
                  <span className="font-mono">₹{(viewSlipOp.paid_quess || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-[var(--color-hairline)] text-amber-600 dark:text-amber-400">
                  <span>Remaining Unpaid Balance:</span>
                  <span className="font-mono">₹{(viewSlipOp.balance_pay || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] space-y-1">
                <span className="font-semibold text-[10px] uppercase text-[var(--color-mute)] block">Paid Leave Ledger</span>
                <div className="flex justify-between">
                  <span>Annual PL Quota:</span>
                  <span className="font-mono">{viewSlipOp.total_pl_quota || 12} days</span>
                </div>
                <div className="flex justify-between">
                  <span>Previously Used (To Date):</span>
                  <span className="font-mono">{viewSlipOp.pl_used_as_on_date || 0} days</span>
                </div>
                <div className="flex justify-between">
                  <span>Adjusted this Month:</span>
                  <span className="font-mono">{viewSlipOp.pl_adjusted || 0} days</span>
                </div>
                <div className="flex justify-between font-bold pt-1 border-t border-[var(--color-hairline)] text-indigo-600 dark:text-indigo-400">
                  <span>Closing PL Balance:</span>
                  <span className="font-mono">{viewSlipOp.pl_balance || 0} days remaining</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 8. Edit Salary Statement Modal with Live Calculations */}
      <Modal
        open={!!editStatementOp}
        onClose={() => setEditStatementOp(null)}
        title={`Edit Salary Statement — ${editStatementOp?.full_name}`}
        description="Modify attendance days, monthly basic salary, deductions, and payouts. Real-time calculations are saved atomically."
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-left">
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">Calculated Net Pay</span>
              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{editComputed.netPay.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={isSavingStatement}
                onClick={() => setEditStatementOp(null)}
                className="h-9 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={isSavingStatement}
                onClick={handleSaveStatement}
                icon={<AnimatedSave size={13} />}
                className="h-9 px-4 text-xs font-semibold gap-1.5"
              >
                Save Statement
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          {/* Section 1: Basic & Attendance */}
          <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
            <h5 className="font-bold text-xs text-[var(--color-ink)] uppercase tracking-wider flex items-center gap-1.5">
              <AnimatedCalendar size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Basic Salary &amp; Attendance Days</span>
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <Input
                label="Basic Salary (₹)"
                type="number"
                min="0"
                value={editFormData.basic_salary ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, basic_salary: Number(e.target.value) })}
              />
              <Input
                label="Working Days (W/D)"
                type="number"
                min="1"
                value={editFormData.working_days ?? 30}
                onChange={(e) => setEditFormData({ ...editFormData, working_days: Number(e.target.value) })}
              />
              <Input
                label="Attended Days (A/D)"
                type="number"
                min="0"
                step="0.5"
                value={editFormData.attended_days ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, attended_days: Number(e.target.value) })}
              />
              <Input
                label="Overtime Days (OT)"
                type="number"
                min="0"
                step="0.5"
                value={editFormData.ot_days ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, ot_days: Number(e.target.value) })}
              />
              <Input
                label="PL Adjusted"
                type="number"
                min="0"
                step="0.5"
                value={editFormData.pl_adjusted ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, pl_adjusted: Number(e.target.value) })}
              />
              <div className="flex flex-col justify-end pb-1 text-xs">
                <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold">Total Days</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                  {editComputed.totalDays} days
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Allowances & Deductions */}
          <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
            <h5 className="font-bold text-xs text-[var(--color-ink)] uppercase tracking-wider flex items-center gap-1.5">
              <AnimatedCreditCard size={14} className="text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Deductions &amp; Allowances</span>
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <Input
                label="Loan Deduction (₹)"
                type="number"
                min="0"
                value={editFormData.loan_deduction ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, loan_deduction: Number(e.target.value) })}
              />
              <Input
                label="Advance Deduction (₹)"
                type="number"
                min="0"
                value={editFormData.advance_deduction ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, advance_deduction: Number(e.target.value) })}
              />
              <Input
                label="Advance Balance (₹)"
                type="number"
                min="0"
                value={editFormData.advance_balance ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, advance_balance: Number(e.target.value) })}
              />
              <Input
                label="Other Deductions (₹)"
                type="number"
                min="0"
                value={editFormData.other_deductions ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, other_deductions: Number(e.target.value) })}
              />
              <Input
                label="Night/Travel Days"
                type="number"
                min="0"
                value={editFormData.night_travel_days ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, night_travel_days: Number(e.target.value) })}
              />
              <Input
                label="Night/Travel Amount (₹)"
                type="number"
                min="0"
                value={editFormData.night_travel_amount ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, night_travel_amount: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Section 3: Agency Disbursements & Unpaid Balance */}
          <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
            <h5 className="font-bold text-xs text-[var(--color-ink)] uppercase tracking-wider flex items-center gap-1.5">
              <AnimatedBriefcase size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Agency Disbursements</span>
            </h5>
            <div className="grid grid-cols-3 gap-2.5">
              <Input
                label="Paid by Reach (₹)"
                type="number"
                min="0"
                value={editFormData.paid_reach ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, paid_reach: Number(e.target.value) })}
              />
              <Input
                label="Paid by S&S (₹)"
                type="number"
                min="0"
                value={editFormData.paid_ss ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, paid_ss: Number(e.target.value) })}
              />
              <Input
                label="Paid by Quess (₹)"
                type="number"
                min="0"
                value={editFormData.paid_quess ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, paid_quess: Number(e.target.value) })}
              />
            </div>
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 flex justify-between text-xs font-mono">
              <span className="text-amber-800 dark:text-amber-200 font-semibold">Remaining Unpaid Balance:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">₹{editComputed.balance.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Section 4: Bank Details & Leave Ledger */}
          <div className="p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-3">
            <h5 className="font-bold text-xs text-[var(--color-ink)] uppercase tracking-wider flex items-center gap-1.5">
              <AnimatedBuilding size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Bank Account &amp; Leave Ledger</span>
            </h5>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                label="Bank Account Number"
                type="text"
                placeholder="e.g. XXXXXXXX1234"
                value={editFormData.bank_account_number ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, bank_account_number: e.target.value })}
              />
              <Input
                label="Bank IFSC Code"
                type="text"
                placeholder="e.g. BANK0001234"
                value={editFormData.bank_ifsc_code ?? ""}
                onChange={(e) => setEditFormData({ ...editFormData, bank_ifsc_code: e.target.value })}
              />
              <Input
                label="Total Annual PL Quota"
                type="number"
                min="0"
                value={editFormData.total_pl_quota ?? 12}
                onChange={(e) => setEditFormData({ ...editFormData, total_pl_quota: Number(e.target.value) })}
              />
              <Input
                label="PL Used as on Date"
                type="number"
                min="0"
                value={editFormData.pl_used_as_on_date ?? 0}
                onChange={(e) => setEditFormData({ ...editFormData, pl_used_as_on_date: Number(e.target.value) })}
              />
            </div>
            <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 flex justify-between text-xs font-mono">
              <span className="text-indigo-800 dark:text-indigo-200 font-semibold">Closing PL Balance:</span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{editComputed.plBalance} days</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Alias for backward compatibility
export const HRPayrollClient = PayrollClient;
