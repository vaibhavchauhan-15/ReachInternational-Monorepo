"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Calendar,
  Search,
  Download,
  CheckSquare,
  Square,
  Edit2,
  Save,
  X,
  Clock,
  Briefcase,
  Users,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import type { HRPayrollSummary, HRPayrollOperator } from "@/lib/types/database";
import type { UserRole } from "@reachinternational/types";
import { updateOperatorRates, bulkUpdateOperatorRates } from "@/app/actions/hr";

interface HRPayrollClientProps {
  initialData: HRPayrollSummary;
  currentMonth: string;
  userRole: UserRole;
}

export function HRPayrollClient({
  initialData,
  currentMonth,
  userRole,
}: HRPayrollClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local state for operators and editable rates
  const [operators, setOperators] = useState<HRPayrollOperator[]>(
    initialData.operators || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editing state for single operator inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDailyRate, setEditDailyRate] = useState<number>(0);
  const [editOtRate, setEditOtRate] = useState<number>(0);

  // Bulk rate edit modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDailyRate, setBulkDailyRate] = useState<string>("");
  const [bulkOtRate, setBulkOtRate] = useState<string>("");

  // Feedback notifications
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Keep state synced when server data updates
  React.useEffect(() => {
    setOperators(initialData.operators || []);
  }, [initialData]);

  // Flash message auto-dismiss
  React.useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  // Month change navigation
  const handleMonthChange = (newMonth: string) => {
    startTransition(() => {
      router.push(`/hr?month=${newMonth}`);
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
        setStatusMessage({
          type: "success",
          text: "Operator rates updated successfully.",
        });
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to update rates.",
        });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Network error saving rates." });
    }
  };

  // Bulk rate apply
  const handleApplyBulkRates = async () => {
    const daily = bulkDailyRate.trim() ? Number(bulkDailyRate) : null;
    const ot = bulkOtRate.trim() ? Number(bulkOtRate) : null;

    if (daily === null && ot === null) {
      setStatusMessage({
        type: "error",
        text: "Please enter at least one rate to update.",
      });
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
        setStatusMessage({
          type: "success",
          text: `Updated rates for ${res.count} operators.`,
        });
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed bulk updating rates.",
        });
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Network error during bulk update.",
      });
    }
  };

  // Browser-native CSV export (no extra libraries needed)
  const handleExportCSV = () => {
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
  };

  // Month selector options (Current year months)
  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const baseYear = 2026;
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${baseYear}-${String(m).padStart(2, "0")}`;
      const d = new Date(baseYear, m - 1, 1);
      const label = d.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      options.push({ value: monthStr, label });
    }
    return options;
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast message */}
      {statusMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border text-sm shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="ml-2 hover:opacity-70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink)] shadow-sm">
              <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                Operator Payroll
              </h1>
              <p className="text-xs sm:text-sm text-[var(--color-muted)]">
                Monthly operator compensation with client-delayed overtime lag
                calculation
              </p>
            </div>
          </div>
        </div>

        {/* Right controls: Month selector & CSV export */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center gap-1.5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-lg px-2.5 py-1.5 shadow-sm">
            <Calendar className="w-4 h-4 text-[var(--color-muted)]" />
            <select
              value={currentMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={isPending}
              className="bg-transparent text-xs sm:text-sm font-medium focus:outline-none cursor-pointer pr-2"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-[var(--color-muted)]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Split-Month Rule Notice Box */}
      <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-start gap-2.5">
            <HelpCircle className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold text-[var(--color-ink)]">
                Payroll Calculation Policy:
              </span>{" "}
              <span className="text-[var(--color-muted)]">
                Regular pay is calculated from the previous month. Overtime is
                paid on a 1-month delay due to client site timesheet
                confirmation.
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-medium border border-blue-200/60 dark:border-blue-800/40">
              <Briefcase className="w-3 h-3" />
              Regular: {initialData.regularPeriod || "N/A"}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 font-medium border border-amber-200/60 dark:border-amber-800/40">
              <Clock className="w-3 h-3" />
              Overtime: {initialData.otPeriod || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Active Operators
            </span>
            <Users className="w-4 h-4 text-[var(--color-muted)]" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight">
            {kpis.activeWorkers}{" "}
            <span className="text-xs font-normal text-[var(--color-muted)]">
              / {kpis.totalOperators} total
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted)] truncate">
            Submitted logs for period
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Total Work Days
            </span>
            <Briefcase className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {kpis.totalWorkDays}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted)] truncate">
            From {initialData.regularPeriod.split(" to ")[0] || "prev month"}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Approved OT Hours
            </span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {kpis.totalOtHours}h
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted)] truncate">
            From {initialData.otPeriod.split(" to ")[0] || "lagged month"}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-muted)]">
              Estimated Total Payroll
            </span>
            <Banknote className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            ₹{kpis.totalOverallPay.toLocaleString("en-IN")}
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-muted)] truncate">
            Regular: ₹{kpis.totalRegularPay.toLocaleString("en-IN")} + OT: ₹
            {kpis.totalOtPay.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Search, Filter & Bulk Action Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl p-3 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by operator name, phone, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg pl-9 pr-3 py-1.5 text-xs sm:text-sm placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)] transition-shadow"
          />
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-ink)] text-[var(--color-canvas)] text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Bulk Set Rates ({selectedIds.size})</span>
            </button>
          )}

          <div className="text-xs text-[var(--color-muted)] px-2 whitespace-nowrap">
            Showing {filteredOperators.length} of {operators.length} operators
          </div>
        </div>
      </div>

      {/* Desktop High-Density Table (Hidden on Mobile) */}
      <div className="hidden md:block rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 text-[var(--color-muted)] uppercase tracking-wider font-semibold">
                <th className="py-3 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="hover:text-[var(--color-ink)] transition-colors"
                  >
                    {selectedIds.size === filteredOperators.length &&
                    filteredOperators.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">Operator</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-right">Work Days</th>
                <th className="py-3 px-3 text-right">Daily Rate</th>
                <th className="py-3 px-3 text-right">Regular Pay</th>
                <th className="py-3 px-3 text-right">OT Hours</th>
                <th className="py-3 px-3 text-right">OT Rate/hr</th>
                <th className="py-3 px-3 text-right">OT Pay</th>
                <th className="py-3 px-3 text-right">Total Pay</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {filteredOperators.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[var(--color-muted)]">
                    No operators found matching your search.
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
                        isSelected ? "bg-blue-50/30 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(op.operator_id)}
                          className="hover:text-[var(--color-ink)] transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-[var(--color-muted)]" />
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-3">
                        <Link
                          href={`/users?search=${encodeURIComponent(op.full_name)}`}
                          title={`View ${op.full_name}'s record in Users Directory`}
                          className="font-medium text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors inline-flex items-center gap-1 group"
                        >
                          <span className="group-hover:underline">{op.full_name}</span>
                          <ExternalLink className="w-3 h-3 text-[var(--color-muted)] group-hover:text-sky-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <div className="text-[11px] text-[var(--color-muted)]">
                          {op.phone || "No phone"}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-[var(--color-muted)]">
                        {op.city || op.state ? (
                          <span>
                            {op.city ? `${op.city}, ` : ""}
                            {op.state || ""}
                          </span>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium">
                        <span
                          className={
                            op.work_days > 0
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-[var(--color-muted)]"
                          }
                        >
                          {op.work_days} d
                        </span>
                        <span className="block text-[10px] text-[var(--color-muted)]">
                          {op.normal_hours}h
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editDailyRate}
                            onChange={(e) =>
                              setEditDailyRate(Math.max(0, Number(e.target.value)))
                            }
                            className="w-20 px-1.5 py-1 text-right bg-[var(--color-canvas)] border border-blue-400 rounded focus:outline-none"
                          />
                        ) : (
                          <span className="font-mono">
                            ₹{op.daily_rate.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium">
                        ₹{op.regular_pay.toLocaleString("en-IN")}
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium">
                        <span
                          className={
                            op.ot_hours > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-[var(--color-muted)]"
                          }
                        >
                          {op.ot_hours}h
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editOtRate}
                            onChange={(e) =>
                              setEditOtRate(Math.max(0, Number(e.target.value)))
                            }
                            className="w-20 px-1.5 py-1 text-right bg-[var(--color-canvas)] border border-amber-400 rounded focus:outline-none"
                          />
                        ) : (
                          <span className="font-mono">
                            ₹{op.ot_hourly_rate.toLocaleString("en-IN")}
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right font-medium">
                        ₹{op.ot_pay.toLocaleString("en-IN")}
                      </td>

                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        ₹{op.total_pay.toLocaleString("en-IN")}
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleSaveInline(op.operator_id)}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                              title="Save Rates"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded bg-[var(--color-hairline)] text-[var(--color-ink)] hover:opacity-80 transition-opacity"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(op)}
                            className="p-1 text-[var(--color-muted)] hover:text-[var(--color-ink)] rounded hover:bg-[var(--color-canvas)] transition-colors"
                            title="Edit Daily/OT Rates"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
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

      {/* Mobile Touch Cards (Visible on mobile/tablet screens <= 640px) */}
      <div className="block md:hidden space-y-3">
        {filteredOperators.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-8 text-center text-xs text-[var(--color-muted)]">
            No operators found matching your search.
          </div>
        ) : (
          filteredOperators.map((op) => {
            const isSelected = selectedIds.has(op.operator_id);
            const isEditing = editingId === op.operator_id;

            return (
              <div
                key={op.operator_id}
                className={`rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-sm space-y-3 transition-colors ${
                  isSelected ? "ring-1 ring-blue-500 bg-blue-50/20" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(op.operator_id)}
                      className="mt-0.5"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Square className="w-5 h-5 text-[var(--color-muted)]" />
                      )}
                    </button>
                    <div>
                      <Link
                        href={`/users?search=${encodeURIComponent(op.full_name)}`}
                        title={`View ${op.full_name}'s record in Users Directory`}
                        className="font-semibold text-sm text-[var(--color-ink)] hover:text-sky-600 transition-colors inline-flex items-center gap-1 group"
                      >
                        <span className="group-hover:underline">{op.full_name}</span>
                        <ExternalLink className="w-3 h-3 text-[var(--color-muted)] group-hover:text-sky-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                      </Link>
                      <p className="text-xs text-[var(--color-muted)]">
                        {op.phone || "No phone"} • {op.city || op.state || "No location"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-[var(--color-muted)] block">
                      Total Pay
                    </span>
                    <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">
                      ₹{op.total_pay.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Rates & Calculations breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[var(--color-canvas)] p-2.5 rounded-lg border border-[var(--color-hairline)]">
                  <div>
                    <span className="text-[var(--color-muted)] block">
                      Regular: {op.work_days} days × ₹{op.daily_rate}
                    </span>
                    <span className="font-semibold text-[var(--color-ink)]">
                      = ₹{op.regular_pay.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--color-muted)] block">
                      OT: {op.ot_hours}h × ₹{op.ot_hourly_rate}
                    </span>
                    <span className="font-semibold text-[var(--color-ink)]">
                      = ₹{op.ot_pay.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Inline Rate edit inputs on mobile */}
                {isEditing ? (
                  <div className="pt-2 border-t border-[var(--color-hairline)] space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                          Daily Rate (₹)
                        </label>
                        <input
                          type="number"
                          value={editDailyRate}
                          onChange={(e) =>
                            setEditDailyRate(Math.max(0, Number(e.target.value)))
                          }
                          className="w-full bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded px-2 py-1.5 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--color-muted)] mb-1">
                          OT Rate/hr (₹)
                        </label>
                        <input
                          type="number"
                          value={editOtRate}
                          onChange={(e) =>
                            setEditOtRate(Math.max(0, Number(e.target.value)))
                          }
                          className="w-full bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded px-2 py-1.5 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleSaveInline(op.operator_id)}
                        className="flex-1 py-1.5 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors text-center"
                      >
                        Save Rates
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded bg-[var(--color-hairline)] text-[var(--color-ink)] font-medium hover:opacity-80 transition-opacity"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleStartEdit(op)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)] font-medium"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Rates</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bulk Rate Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-3">
              <h2 className="font-semibold text-base text-[var(--color-ink)]">
                Bulk Set Rates ({selectedIds.size} operators)
              </h2>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--color-muted)]">
              Specify daily rate and/or overtime hourly rate. Fields left blank
              will retain their individual existing rates.
            </p>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-medium text-[var(--color-ink)] mb-1">
                  Daily Rate (₹ per day)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 800"
                  value={bulkDailyRate}
                  onChange={(e) => setBulkDailyRate(e.target.value)}
                  className="w-full bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                />
              </div>

              <div>
                <label className="block font-medium text-[var(--color-ink)] mb-1">
                  Overtime Rate (₹ per hour)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 150"
                  value={bulkOtRate}
                  onChange={(e) => setBulkOtRate(e.target.value)}
                  className="w-full bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-hairline)]">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-lg border border-[var(--color-hairline)] text-xs sm:text-sm font-medium hover:bg-[var(--color-canvas)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBulkRates}
                className="px-4 py-2 rounded-lg bg-[var(--color-ink)] text-[var(--color-canvas)] text-xs sm:text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
              >
                Apply to {selectedIds.size} Operators
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
