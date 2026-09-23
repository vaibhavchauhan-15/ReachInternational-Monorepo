"use client";

import React, { useState, useMemo, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Download,
  ExternalLink,
  Briefcase,
  HelpCircle,
} from "lucide-react";
import {
  AnimatedUsers,
  AnimatedClock,
  AnimatedCreditCard,
  AnimatedEdit2,
  AnimatedSave,
  AnimatedX,
  AnimatedCheck,
} from "@/components/ui/animated-icons";
import {
  PageHeader,
  Button,
  Input,
  Modal,
  FilterToolbar,
  EmptyState,
  MonthSelect,
  useToast,
} from "@/components/ui";
import { AnimatedCounter } from "@/components/ui/Motion";
import type { HRPayrollSummary, HRPayrollOperator } from "@/lib/types/database";
import type { UserRole } from "@reachinternational/types";
import { updateOperatorRates, bulkUpdateOperatorRates } from "@/app/actions/payroll";

interface PayrollClientProps {
  initialData: HRPayrollSummary;
  currentMonth: string;
  userRole: UserRole;
}

export function PayrollClient({
  initialData,
  currentMonth,
}: PayrollClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Local state for operators and editable rates
  const [prevInitialData, setPrevInitialData] = useState(initialData);
  const [operators, setOperators] = useState<HRPayrollOperator[]>(
    initialData.operators || []
  );

  if (prevInitialData !== initialData) {
    setPrevInitialData(initialData);
    setOperators(initialData.operators || []);
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editing state for single operator inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDailyRate, setEditDailyRate] = useState<number>(0);
  const [editOtRate, setEditOtRate] = useState<number>(0);
  const [isSavingInline, setIsSavingInline] = useState(false);

  // Bulk rate edit modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDailyRate, setBulkDailyRate] = useState<string>("");
  const [bulkOtRate, setBulkOtRate] = useState<string>("");
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  // Month change navigation
  const handleMonthChange = (newMonth: string) => {
    startTransition(() => {
      router.push(`/payroll?month=${newMonth}`);
    });
  };

  // Filtered operators based on search
  const filteredOperators = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return operators;
    return operators.filter(
      (op) =>
        op.full_name.toLowerCase().includes(q) ||
        (op.phone && op.phone.includes(q)) ||
        (op.city && op.city.toLowerCase().includes(q)) ||
        (op.state && op.state.toLowerCase().includes(q))
    );
  }, [operators, searchQuery]);

  // Overall KPIs
  const kpis = useMemo(() => {
    let totalWorkDays = 0;
    let totalOtHours = 0;
    let totalRegularPay = 0;
    let totalOtPay = 0;
    let totalOverallPay = 0;
    let activeWorkers = 0;

    operators.forEach((op) => {
      totalWorkDays += op.work_days;
      totalOtHours += op.ot_hours;
      totalRegularPay += op.regular_pay;
      totalOtPay += op.ot_pay;
      totalOverallPay += op.total_pay;
      if (op.work_days > 0 || op.ot_hours > 0) {
        activeWorkers++;
      }
    });

    return {
      totalOperators: operators.length,
      activeWorkers,
      totalWorkDays,
      totalOtHours: Math.round(totalOtHours * 10) / 10,
      totalRegularPay,
      totalOtPay,
      totalOverallPay,
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

  // Inline edit start
  const handleStartEdit = (op: HRPayrollOperator) => {
    setEditingId(op.operator_id);
    setEditDailyRate(op.daily_rate);
    setEditOtRate(op.ot_hourly_rate);
  };

  // Inline edit save
  const handleSaveInline = async (operatorId: string) => {
    setIsSavingInline(true);
    try {
      const res = await updateOperatorRates(
        operatorId,
        editDailyRate,
        editOtRate
      );
      if (res.success) {
        setOperators((prev) =>
          prev.map((op) => {
            if (op.operator_id === operatorId) {
              const regPay = op.work_days * editDailyRate;
              const otPay = op.ot_hours * editOtRate;
              return {
                ...op,
                daily_rate: editDailyRate,
                ot_hourly_rate: editOtRate,
                regular_pay: regPay,
                ot_pay: otPay,
                total_pay: regPay + otPay,
              };
            }
            return op;
          })
        );
        setEditingId(null);
        toast("success", "Operator rates updated successfully.");
      } else {
        toast("error", res.error || "Failed to update rates.");
      }
    } catch {
      toast("error", "Network error saving rates.");
    } finally {
      setIsSavingInline(false);
    }
  };

  // Bulk rate apply
  const handleApplyBulkRates = async () => {
    const daily = bulkDailyRate.trim() ? Number(bulkDailyRate) : null;
    const ot = bulkOtRate.trim() ? Number(bulkOtRate) : null;

    if (daily === null && ot === null) {
      toast("warning", "Please enter at least one rate to update.");
      return;
    }

    const updates = Array.from(selectedIds).map((id) => {
      const current = operators.find((o) => o.operator_id === id);
      return {
        operatorId: id,
        dailyRate: daily !== null ? daily : current?.daily_rate || 0,
        otHourlyRate: ot !== null ? ot : current?.ot_hourly_rate || 0,
      };
    });

    setIsSavingBulk(true);
    try {
      const res = await bulkUpdateOperatorRates(updates);
      if (res.success) {
        setOperators((prev) =>
          prev.map((op) => {
            if (selectedIds.has(op.operator_id)) {
              const newDaily = daily !== null ? daily : op.daily_rate;
              const newOt = ot !== null ? ot : op.ot_hourly_rate;
              const regPay = op.work_days * newDaily;
              const otPay = op.ot_hours * newOt;
              return {
                ...op,
                daily_rate: newDaily,
                ot_hourly_rate: newOt,
                regular_pay: regPay,
                ot_pay: otPay,
                total_pay: regPay + otPay,
              };
            }
            return op;
          })
        );
        setShowBulkModal(false);
        setBulkDailyRate("");
        setBulkOtRate("");
        setSelectedIds(new Set());
        toast("success", `Updated rates for ${res.count} operators.`);
      } else {
        toast("error", res.error || "Failed bulk updating rates.");
      }
    } catch {
      toast("error", "Network error during bulk update.");
    } finally {
      setIsSavingBulk(false);
    }
  };

  // Browser-native CSV export (no extra libraries needed)
  const handleExportCSV = useCallback(() => {
    const listToExport =
      selectedIds.size > 0
        ? operators.filter((o) => selectedIds.has(o.operator_id))
        : operators;

    const headers = [
      "Operator Name",
      "Phone",
      "City",
      "State",
      `Work Days (${initialData.regularPeriod})`,
      "Normal Working Hours",
      "Daily Rate (INR)",
      "Regular Pay (INR)",
      `OT Hours (${initialData.otPeriod})`,
      "OT Hourly Rate (INR)",
      "OT Pay (INR)",
      "Total Payroll (INR)",
    ];

    const rows = listToExport.map((op) => [
      `"${op.full_name.replace(/"/g, '""')}"`,
      `"${op.phone || ""}"`,
      `"${op.city || ""}"`,
      `"${op.state || ""}"`,
      op.work_days,
      op.normal_hours,
      op.daily_rate,
      op.regular_pay,
      op.ot_hours,
      op.ot_hourly_rate,
      op.ot_pay,
      op.total_pay,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Payroll_Report_${initialData.payrollMonth}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("success", `Exported ${listToExport.length} payroll records to CSV`);
  }, [selectedIds, operators, initialData, toast]);

  return (
    <div className="flex flex-col gap-5 sm:gap-6 pb-24 md:pb-6">
      {/* 1. Canonical Desktop Page Header */}
      <PageHeader
        title="Operator Payroll"
        description="Monthly operator compensation with client-delayed overtime lag calculation"
        breadcrumbs={[{ label: "Payroll" }]}
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
              icon={<Download size={14} className="text-[var(--color-mute)]" />}
              className="h-9 px-3 text-xs font-semibold gap-1.5"
              title="Export Payroll CSV"
            >
              <span>Export CSV</span>
            </Button>
          </div>
        }
      />

      {/* Mobile-Only Action Row (Header is already at top via MobilePageHeader) */}
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
          icon={<Download size={14} className="text-[var(--color-mute)]" />}
          className="h-11 px-3 text-xs font-semibold gap-1.5 shrink-0"
          title="Export CSV"
        >
          <span>Export</span>
        </Button>
      </div>

      {/* 2. Split-Month Rule Notice Card */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-[var(--color-ink)]">
                Payroll Calculation Policy:
              </span>{" "}
              <span className="text-[var(--color-body)]">
                Regular pay is calculated from the previous month. Overtime is paid on a 1-month delay due to client site timesheet confirmation.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium border border-blue-500/20">
              <Briefcase className="w-3 h-3" />
              Regular: {initialData.regularPeriod || "N/A"}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium border border-amber-500/20">
              <AnimatedClock size={12} />
              Overtime: {initialData.otPeriod || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Interactive KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {/* Active Operators Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-[var(--color-ink)]/30"
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider">
              Active Operators
            </span>
            <AnimatedUsers size={16} className="text-[var(--color-ink)]" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-[var(--color-ink)] flex items-baseline gap-1.5">
            <AnimatedCounter value={kpis.activeWorkers} />
            <span className="text-xs font-normal text-[var(--color-mute)]">
              / {kpis.totalOperators} total
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-mute)] truncate">
            Submitted logs for period
          </p>
        </motion.div>

        {/* Total Work Days Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-blue-500/40"
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Total Work Days
            </span>
            <Briefcase className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400">
            <AnimatedCounter value={kpis.totalWorkDays} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-mute)] truncate">
            From {initialData.regularPeriod.split(" to ")[0] || "prev month"}
          </p>
        </motion.div>

        {/* Approved OT Hours Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-amber-500/40"
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Approved OT Hours
            </span>
            <AnimatedClock size={16} className="text-amber-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {kpis.totalOtHours}h
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-mute)] truncate">
            From {initialData.otPeriod.split(" to ")[0] || "lagged month"}
          </p>
        </motion.div>

        {/* Estimated Total Payroll Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-3.5 sm:p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs transition-all hover:border-emerald-500/40"
        >
          <div className="flex items-center justify-between text-[var(--color-mute)]">
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Estimated Total Payroll
            </span>
            <AnimatedCreditCard size={16} className="text-emerald-500" />
          </div>
          <div className="mt-1 text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            ₹{kpis.totalOverallPay.toLocaleString("en-IN")}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-mute)] truncate">
            Reg: ₹{kpis.totalRegularPay.toLocaleString("en-IN")} + OT: ₹{kpis.totalOtPay.toLocaleString("en-IN")}
          </p>
        </motion.div>
      </div>

      {/* 4. Search, Selection & Action Toolbar */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by operator name, phone, city, state..."
        actions={
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowBulkModal(true)}
                icon={<AnimatedEdit2 size={13} />}
                className="h-11 sm:h-9 px-3 text-xs font-semibold whitespace-nowrap"
              >
                Bulk Rates ({selectedIds.size})
              </Button>
            )}
            <div className="text-xs text-[var(--color-mute)] px-2 whitespace-nowrap hidden sm:block">
              {filteredOperators.length} of {operators.length} operators
            </div>
          </div>
        }
      />

      {/* 5. Desktop High-Density Table (Hidden on Mobile) */}
      <div className="hidden md:block rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 text-[var(--color-mute)] uppercase tracking-wider font-semibold text-[11px]">
                <th className="py-3 px-3.5 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="h-5 w-5 rounded border border-[var(--color-hairline)] hover:border-[var(--color-ink)] flex items-center justify-center transition-colors cursor-pointer"
                    title={selectedIds.size === filteredOperators.length ? "Deselect all" : "Select all"}
                  >
                    {selectedIds.size === filteredOperators.length && filteredOperators.length > 0 ? (
                      <AnimatedCheck size={12} className="text-emerald-600 dark:text-emerald-400" />
                    ) : null}
                  </button>
                </th>
                <th className="py-3 px-3.5">Operator</th>
                <th className="py-3 px-3.5">Location</th>
                <th className="py-3 px-3.5 text-right">Work Days</th>
                <th className="py-3 px-3.5 text-right">Daily Rate</th>
                <th className="py-3 px-3.5 text-right">Regular Pay</th>
                <th className="py-3 px-3.5 text-right">OT Hours</th>
                <th className="py-3 px-3.5 text-right">OT Rate/hr</th>
                <th className="py-3 px-3.5 text-right">OT Pay</th>
                <th className="py-3 px-3.5 text-right">Total Pay</th>
                <th className="py-3 px-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8">
                    <EmptyState
                      icon={<AnimatedCreditCard size={28} />}
                      title="No operators found"
                      description={
                        searchQuery
                          ? `No operator matches "${searchQuery}".`
                          : "No operators recorded for this period."
                      }
                    />
                  </td>
                </tr>
              ) : (
                filteredOperators.map((op) => {
                  const isSelected = selectedIds.has(op.operator_id);
                  const isEditing = editingId === op.operator_id;

                  return (
                    <tr
                      key={op.operator_id}
                      className={`hover:bg-[var(--color-canvas)]/40 transition-colors ${
                        isSelected ? "bg-sky-50/40 dark:bg-sky-950/20" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3.5 text-center">
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

                      <td className="py-2.5 px-3.5">
                        <Link
                          href={`/users?search=${encodeURIComponent(op.full_name)}`}
                          title={`View ${op.full_name}'s record in Users Directory`}
                          className="font-semibold text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors inline-flex items-center gap-1 group"
                        >
                          <span className="group-hover:underline">{op.full_name}</span>
                          <ExternalLink className="w-3 h-3 text-[var(--color-mute)] group-hover:text-sky-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <div className="text-[11px] text-[var(--color-mute)] font-mono">
                          {op.phone || "No phone"}
                        </div>
                      </td>

                      <td className="py-2.5 px-3.5 text-[var(--color-body)]">
                        {op.city || op.state ? (
                          <span>
                            {op.city ? `${op.city}, ` : ""}
                            {op.state || ""}
                          </span>
                        ) : (
                          <span className="italic text-[var(--color-mute)]">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3.5 text-right font-medium">
                        <span
                          className={
                            op.work_days > 0
                              ? "text-blue-600 dark:text-blue-400 font-mono"
                              : "text-[var(--color-mute)] font-mono"
                          }
                        >
                          {op.work_days} d
                        </span>
                        <span className="block text-[10px] text-[var(--color-mute)] font-mono">
                          {op.normal_hours}h
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editDailyRate}
                            onChange={(e) =>
                              setEditDailyRate(Math.max(0, Number(e.target.value)))
                            }
                            className="w-20 px-1.5 py-1 text-right bg-[var(--color-canvas)] border border-sky-500 rounded text-xs font-mono focus:outline-none"
                          />
                        ) : (
                          <span className="font-mono text-[var(--color-ink)]">
                            ₹{op.daily_rate.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3.5 text-right font-mono font-medium text-[var(--color-ink)]">
                        ₹{op.regular_pay.toLocaleString("en-IN")}
                      </td>

                      <td className="py-2.5 px-3.5 text-right font-medium">
                        <span
                          className={
                            op.ot_hours > 0
                              ? "text-amber-600 dark:text-amber-400 font-mono"
                              : "text-[var(--color-mute)] font-mono"
                          }
                        >
                          {op.ot_hours}h
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editOtRate}
                            onChange={(e) =>
                              setEditOtRate(Math.max(0, Number(e.target.value)))
                            }
                            className="w-20 px-1.5 py-1 text-right bg-[var(--color-canvas)] border border-amber-500 rounded text-xs font-mono focus:outline-none"
                          />
                        ) : (
                          <span className="font-mono text-[var(--color-ink)]">
                            ₹{op.ot_hourly_rate.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3.5 text-right font-mono font-medium text-[var(--color-ink)]">
                        ₹{op.ot_pay.toLocaleString("en-IN")}
                      </td>

                      <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{op.total_pay.toLocaleString("en-IN")}
                      </td>

                      <td className="py-2.5 px-3.5 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleSaveInline(op.operator_id)}
                              disabled={isSavingInline}
                              className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                              title="Save Rates"
                            >
                              <AnimatedSave size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              disabled={isSavingInline}
                              className="p-1.5 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <AnimatedX size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(op)}
                            className="p-1.5 text-[var(--color-mute)] hover:text-[var(--color-ink)] rounded-md hover:bg-[var(--color-canvas)] transition-colors cursor-pointer"
                            title="Edit Rates"
                          >
                            <AnimatedEdit2 size={13} />
                          </button>
                        )}
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
              description="No operator matches your search criteria."
            />
          </div>
        ) : (
          filteredOperators.map((op) => {
            const isSelected = selectedIds.has(op.operator_id);
            const isEditing = editingId === op.operator_id;

            return (
              <div
                key={op.operator_id}
                className={`rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-xs space-y-3 transition-colors ${
                  isSelected ? "ring-1 ring-sky-500 bg-sky-50/15" : ""
                }`}
              >
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
                      <Link
                        href={`/users?search=${encodeURIComponent(op.full_name)}`}
                        title={`View ${op.full_name}'s record in Users Directory`}
                        className="font-semibold text-sm text-[var(--color-ink)] hover:text-sky-600 transition-colors inline-flex items-center gap-1 group truncate"
                      >
                        <span className="group-hover:underline truncate">{op.full_name}</span>
                        <ExternalLink className="w-3 h-3 text-[var(--color-mute)] shrink-0" />
                      </Link>
                      <p className="text-xs text-[var(--color-mute)] font-mono truncate">
                        {op.phone || "No phone"} • {op.city || op.state || "No location"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-semibold text-[var(--color-mute)] block">
                      Total Pay
                    </span>
                    <span className="font-bold text-sm sm:text-base text-emerald-600 dark:text-emerald-400 font-mono">
                      ₹{op.total_pay.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Rates & Calculations breakdown well */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[var(--color-canvas)] p-2.5 rounded-lg border border-[var(--color-hairline)]">
                  <div>
                    <span className="text-[var(--color-mute)] block text-[11px]">
                      Regular: {op.work_days}d × ₹{op.daily_rate}
                    </span>
                    <span className="font-semibold text-[var(--color-ink)] font-mono">
                      = ₹{op.regular_pay.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--color-mute)] block text-[11px]">
                      OT: {op.ot_hours}h × ₹{op.ot_hourly_rate}
                    </span>
                    <span className="font-semibold text-[var(--color-ink)] font-mono">
                      = ₹{op.ot_pay.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Inline Rate edit inputs on mobile */}
                {isEditing ? (
                  <div className="pt-2 border-t border-[var(--color-hairline)] space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="Daily Rate (₹)"
                        type="number"
                        min="0"
                        value={editDailyRate}
                        onChange={(e) => setEditDailyRate(Math.max(0, Number(e.target.value)))}
                      />
                      <Input
                        label="OT Rate/hr (₹)"
                        type="number"
                        min="0"
                        value={editOtRate}
                        onChange={(e) => setEditOtRate(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        fullWidth
                        loading={isSavingInline}
                        onClick={() => handleSaveInline(op.operator_id)}
                        className="h-11 text-xs font-semibold"
                      >
                        Save Rates
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isSavingInline}
                        onClick={() => setEditingId(null)}
                        className="h-11 px-4 text-xs font-semibold"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(op)}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] font-medium cursor-pointer"
                    >
                      <AnimatedEdit2 size={13} />
                      <span>Edit Rates</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 7. Canonical Bulk Rate Modal */}
      <Modal
        open={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title={`Bulk Set Rates (${selectedIds.size} Operators)`}
        description="Specify daily rate and/or overtime hourly rate. Fields left blank will retain existing rates."
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="secondary"
              size="sm"
              disabled={isSavingBulk}
              onClick={() => setShowBulkModal(false)}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isSavingBulk}
              onClick={handleApplyBulkRates}
              className="h-9 px-4 text-xs font-semibold"
            >
              Apply to {selectedIds.size} Operators
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <Input
            label="Daily Rate (₹ per day)"
            type="number"
            min="0"
            placeholder="e.g. 800"
            value={bulkDailyRate}
            onChange={(e) => setBulkDailyRate(e.target.value)}
            hint="Applies to standard working shift days"
          />
          <Input
            label="Overtime Rate (₹ per hour)"
            type="number"
            min="0"
            placeholder="e.g. 150"
            value={bulkOtRate}
            onChange={(e) => setBulkOtRate(e.target.value)}
            hint="Applies to approved overtime hours"
          />
        </div>
      </Modal>
    </div>
  );
}

// Alias for backward compatibility
export const HRPayrollClient = PayrollClient;
