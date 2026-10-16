"use client";

import React from "react";
import Link from "next/link";
import { EmptyState, Button, highlightText } from "@/components/ui";
import {
  AnimatedCheck,
  AnimatedCreditCard,
  AnimatedFileText,
  AnimatedEdit2,
} from "@/components/ui/animated-icons";
import type { HRPayrollOperator } from "@/lib/types/database";

export type PayrollViewMode =
  | "statement"
  | "attendance"
  | "earnings"
  | "deductions"
  | "payouts"
  | "leaves";

export interface PayrollDesktopTableProps {
  operators: HRPayrollOperator[];
  viewMode: PayrollViewMode;
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onToggleSelect: (id: string) => void;
  onViewSlip: (op: HRPayrollOperator) => void;
  onEditStatement: (op: HRPayrollOperator) => void;
  searchQuery?: string;
  activeFilterCount?: number;
  onResetFilters?: () => void;
}

export function PayrollDesktopTable({
  operators,
  viewMode,
  selectedIds,
  onSelectAll,
  onToggleSelect,
  onViewSlip,
  onEditStatement,
  searchQuery = "",
  activeFilterCount = 0,
  onResetFilters,
}: PayrollDesktopTableProps) {
  return (
    <div className="hidden md:block rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden shadow-xs">
      <div className="overflow-x-auto max-h-[750px]">
        <table className="w-full text-left text-xs border-collapse font-sans whitespace-nowrap">
          {/* Multi-tier Group Header Bar */}
          <thead className="sticky top-0 z-30 bg-[var(--color-canvas)] border-b border-[var(--color-hairline)]">
            <tr className="border-b border-[var(--color-hairline)]/70 text-[10px] uppercase font-bold tracking-wider text-[var(--color-mute)]">
              <th
                colSpan={3}
                className="py-1 px-3 bg-white dark:bg-[#121212] border-r-2 border-neutral-300 dark:border-neutral-700 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.4)] sticky left-0 z-40 text-left"
              >
                Identity Details
              </th>

              {(viewMode === "statement" || viewMode === "attendance") && (
                <th
                  colSpan={8}
                  className="py-1 px-3 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-r border-[var(--color-hairline)] text-center"
                >
                  Attendance &amp; Days
                </th>
              )}

              {(viewMode === "statement" || viewMode === "earnings") && (
                <th
                  colSpan={7}
                  className="py-1 px-3 bg-sky-500/10 text-sky-700 dark:text-sky-300 border-r border-[var(--color-hairline)] text-center"
                >
                  Earnings Breakdown
                </th>
              )}

              {(viewMode === "statement" || viewMode === "deductions") && (
                <th
                  colSpan={6}
                  className="py-1 px-3 bg-rose-500/10 text-rose-700 dark:text-rose-300 border-r border-[var(--color-hairline)] text-center"
                >
                  Deductions &amp; Recoveries
                </th>
              )}

              {(viewMode === "statement" || viewMode === "payouts") && (
                <th
                  colSpan={4}
                  className="py-1 px-3 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-r border-[var(--color-hairline)] text-center"
                >
                  Agency Disbursements &amp; Balance
                </th>
              )}

              {(viewMode === "statement" || viewMode === "leaves") && (
                <th
                  colSpan={2}
                  className="py-1 px-3 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-r border-[var(--color-hairline)] text-center"
                >
                  Leave Ledger
                </th>
              )}

              {(viewMode === "statement" || viewMode === "deductions") && (
                <th
                  colSpan={2}
                  className="py-1 px-3 bg-slate-500/10 text-slate-700 dark:text-slate-300 border-r border-[var(--color-hairline)] text-center"
                >
                  Bank Info
                </th>
              )}

              <th className="py-1 px-3 bg-[var(--color-canvas)] text-center">
                Actions
              </th>
            </tr>

            {/* Exact Excel Column Header Row */}
            <tr className="border-b border-[var(--color-hairline)] text-[11px] font-semibold text-[var(--color-body)] uppercase">
              {/* Checkbox */}
              <th className="py-2.5 px-2 w-[36px] min-w-[36px] max-w-[36px] text-center sticky left-0 z-40 bg-white dark:bg-[#121212] border-r border-[var(--color-hairline)]/60">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="h-4.5 w-4.5 rounded border border-[var(--color-hairline)] hover:border-[var(--color-ink)] flex items-center justify-center transition-colors cursor-pointer"
                  title={
                    selectedIds.size === operators.length
                      ? "Deselect all"
                      : "Select all"
                  }
                >
                  {selectedIds.size === operators.length && operators.length > 0 && (
                    <AnimatedCheck
                      size={11}
                      className="text-emerald-600 dark:text-emerald-400"
                    />
                  )}
                </button>
              </th>

              {/* SL NO */}
              <th className="py-2.5 px-2.5 text-center w-[48px] min-w-[48px] max-w-[48px] sticky left-[36px] z-40 bg-white dark:bg-[#121212] border-r border-[var(--color-hairline)]/60 font-mono">
                SL NO
              </th>

              {/* NAME - Partition Line */}
              <th className="py-2.5 px-3.5 min-w-[200px] sticky left-[84px] z-40 bg-white dark:bg-[#121212] border-r-2 border-neutral-300 dark:border-neutral-700 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.4)]">
                NAME
              </th>

              {/* ATTENDANCE COLUMNS */}
              {(viewMode === "statement" || viewMode === "attendance") && (
                <>
                  <th className="py-2.5 px-3 min-w-[100px] text-center border-r border-[var(--color-hairline)]/60 font-mono">
                    DOJ
                  </th>
                  <th className="py-2.5 px-3 min-w-[95px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    BASIC
                  </th>
                  <th className="py-2.5 px-3 min-w-[95px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    EARNED
                  </th>
                  <th className="py-2.5 px-2.5 min-w-[65px] text-center border-r border-[var(--color-hairline)]/60 font-mono">
                    W/D
                  </th>
                  <th className="py-2.5 px-2.5 min-w-[65px] text-center border-r border-[var(--color-hairline)]/60 font-mono text-blue-600 dark:text-blue-400">
                    A/D
                  </th>
                  <th className="py-2.5 px-2.5 min-w-[75px] text-center border-r border-[var(--color-hairline)]/60 font-mono">
                    OT days
                  </th>
                  <th className="py-2.5 px-2.5 min-w-[75px] text-center border-r border-[var(--color-hairline)]/60 font-mono">
                    PL ADJ
                  </th>
                  <th className="py-2.5 px-2.5 min-w-[90px] text-center border-r border-[var(--color-hairline)]/60 font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30">
                    Total Days
                  </th>
                </>
              )}

              {/* EARNINGS COLUMNS */}
              {(viewMode === "statement" || viewMode === "earnings") && (
                <>
                  <th className="py-2.5 px-3 min-w-[95px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    AMOUNT
                  </th>
                  <th className="py-2.5 px-3 min-w-[90px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    PL AMT.
                  </th>
                  <th className="py-2.5 px-2.5 min-w-[65px] text-center border-r border-[var(--color-hairline)]/60 font-mono">
                    N/T
                  </th>
                  <th className="py-2.5 px-3 min-w-[85px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    Amt
                  </th>
                  <th className="py-2.5 px-3 min-w-[95px] text-right border-r border-[var(--color-hairline)]/60 font-mono font-semibold">
                    TOTAL
                  </th>
                  <th className="py-2.5 px-3 min-w-[95px] text-right border-r border-[var(--color-hairline)]/60 font-mono text-amber-600 dark:text-amber-400">
                    OT AMT
                  </th>
                  <th className="py-2.5 px-3.5 min-w-[110px] text-right border-r border-[var(--color-hairline)]/60 font-mono font-bold text-sky-700 dark:text-sky-300 bg-sky-50/50 dark:bg-sky-950/30">
                    Gross/Pay
                  </th>
                </>
              )}

              {/* DEDUCTIONS COLUMNS */}
              {(viewMode === "statement" || viewMode === "deductions") && (
                <>
                  <th className="py-2.5 px-3 min-w-[90px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    Loan
                  </th>
                  <th className="py-2.5 px-3 min-w-[110px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    Add Bal Salary
                  </th>
                  <th className="py-2.5 px-3 min-w-[120px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    ADV./Deduction
                  </th>
                  <th className="py-2.5 px-3 min-w-[100px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    ADV. BAL.
                  </th>
                  <th className="py-2.5 px-3 min-w-[90px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    Dedu
                  </th>
                  <th className="py-2.5 px-3.5 min-w-[110px] text-right border-r border-[var(--color-hairline)]/60 font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/30">
                    Net/Pay
                  </th>
                </>
              )}

              {/* AGENCY DISBURSEMENTS COLUMNS */}
              {(viewMode === "statement" || viewMode === "payouts") && (
                <>
                  <th className="py-2.5 px-3 min-w-[100px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    PAID REACH
                  </th>
                  <th className="py-2.5 px-3 min-w-[90px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    S&amp;S
                  </th>
                  <th className="py-2.5 px-3 min-w-[90px] text-right border-r border-[var(--color-hairline)]/60 font-mono">
                    QUESS
                  </th>
                  <th className="py-2.5 px-3.5 min-w-[110px] text-right border-r border-[var(--color-hairline)]/60 font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30">
                    BALANCE
                  </th>
                </>
              )}

              {/* LEAVE LEDGER COLUMNS */}
              {(viewMode === "statement" || viewMode === "leaves") && (
                <>
                  <th className="py-2.5 px-3 min-w-[85px] text-center border-r border-[var(--color-hairline)]/60 font-mono">
                    TOTAL PL
                  </th>
                  <th className="py-2.5 px-3 min-w-[95px] text-center border-r border-[var(--color-hairline)]/60 font-mono font-bold text-indigo-700 dark:text-indigo-300">
                    PL BALANCE
                  </th>
                </>
              )}

              {/* BANK DETAILS */}
              {(viewMode === "statement" || viewMode === "deductions") && (
                <>
                  <th className="py-2.5 px-3 min-w-[150px] text-left border-r border-[var(--color-hairline)]/60 font-mono">
                    AC NO
                  </th>
                  <th className="py-2.5 px-3 min-w-[130px] text-left border-r border-[var(--color-hairline)]/60 font-mono">
                    IFSC CODE
                  </th>
                </>
              )}

              {/* ACTIONS */}
              <th className="py-2.5 px-3 min-w-[85px] text-center">Action</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[var(--color-hairline)] bg-white dark:bg-[#121212]">
            {operators.length === 0 ? (
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
                      activeFilterCount > 0 && onResetFilters ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={onResetFilters}
                        >
                          Clear Filters
                        </Button>
                      ) : undefined
                    }
                  />
                </td>
              </tr>
            ) : (
              operators.map((op, index) => {
                const isSelected = selectedIds.has(op.operator_id);
                const stickyBg = isSelected
                  ? "bg-[#f0f9ff] dark:bg-[#0c2233] group-hover:bg-[#e0f2fe] dark:group-hover:bg-[#133047]"
                  : "bg-white dark:bg-[#121212] group-hover:bg-[#f5f5f5] dark:group-hover:bg-[#1c1c1c]";
                const rowBg = isSelected
                  ? "bg-[#f0f9ff] dark:bg-[#0c2233] hover:bg-[#e0f2fe] dark:hover:bg-[#133047]"
                  : "bg-white dark:bg-[#121212] hover:bg-[#f5f5f5] dark:hover:bg-[#1c1c1c]";

                return (
                  <tr
                    key={op.operator_id}
                    className={`transition-colors group ${rowBg}`}
                  >
                    {/* Checkbox - 100% Solid Opaque Background */}
                    <td
                      className={`py-2 px-2 w-[36px] min-w-[36px] max-w-[36px] text-center sticky left-0 z-20 ${stickyBg} border-r border-[var(--color-hairline)]/60`}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleSelect(op.operator_id)}
                        className={`h-4.5 w-4.5 rounded border transition-all flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? "bg-[var(--color-ink)] border-[var(--color-ink)] text-[var(--color-canvas)]"
                            : "border-[var(--color-hairline)] hover:border-[var(--color-ink)]/50"
                        }`}
                      >
                        {isSelected && <AnimatedCheck size={11} />}
                      </button>
                    </td>

                    {/* SL NO - 100% Solid Opaque Background */}
                    <td
                      className={`py-2 px-2.5 w-[48px] min-w-[48px] max-w-[48px] text-center font-mono text-[var(--color-mute)] sticky left-[36px] z-20 ${stickyBg} border-r border-[var(--color-hairline)]/60 tabular-nums`}
                    >
                      {op.sl_no || index + 1}
                    </td>

                    {/* NAME - 100% Solid Opaque Background + Visible Partition Line */}
                    <td
                      className={`py-2 px-3.5 min-w-[200px] sticky left-[84px] z-20 ${stickyBg} border-r-2 border-neutral-300 dark:border-neutral-700 shadow-[4px_0_12px_-2px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)]`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/users?search=${encodeURIComponent(
                            op.full_name
                          )}`}
                          title={`View ${op.full_name}'s profile`}
                          className="font-semibold text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors inline-flex items-center gap-1 truncate"
                        >
                          <span className="truncate">
                            {highlightText(op.full_name, searchQuery)}
                          </span>
                        </Link>
                      </div>
                      <div className="text-[10px] text-[var(--color-mute)] font-mono truncate">
                        {op.phone
                          ? highlightText(op.phone, searchQuery)
                          : "No phone"}
                        {op.city ? ` • ${op.city}` : ""}
                      </div>
                    </td>

                    {/* ATTENDANCE & DAYS */}
                    {(viewMode === "statement" ||
                      viewMode === "attendance") && (
                      <>
                        <td className="py-2 px-3 text-center text-[var(--color-mute)] font-mono border-r border-[var(--color-hairline)]/60">
                          {op.doj || "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums border-r border-[var(--color-hairline)]/60">
                          ₹{(op.basic_salary || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums border-r border-[var(--color-hairline)]/60">
                          ₹
                          {(
                            op.earned_basic ||
                            op.basic_salary ||
                            0
                          ).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          {op.working_days || 30}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums font-semibold text-blue-600 dark:text-blue-400 border-r border-[var(--color-hairline)]/60">
                          {op.attended_days || op.work_days || 0}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums text-[var(--color-body)] border-r border-[var(--color-hairline)]/60">
                          {op.ot_days || 0}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums text-[var(--color-body)] border-r border-[var(--color-hairline)]/60">
                          {op.pl_adjusted || 0}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums font-bold text-blue-700 dark:text-blue-300 bg-blue-50/20 dark:bg-blue-950/10 border-r border-[var(--color-hairline)]/60">
                          {op.total_days || 0}
                        </td>
                      </>
                    )}

                    {/* EARNINGS */}
                    {(viewMode === "statement" ||
                      viewMode === "earnings") && (
                      <>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-ink)] border-r border-[var(--color-hairline)]/60">
                          ₹{(op.attended_amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-ink)] border-r border-[var(--color-hairline)]/60">
                          ₹{(op.pl_amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          {op.night_travel_days || 0}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          ₹
                          {(op.night_travel_amount || 0).toLocaleString(
                            "en-IN"
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-[var(--color-ink)] border-r border-[var(--color-hairline)]/60">
                          ₹{(op.total_earned || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400 font-medium border-r border-[var(--color-hairline)]/60">
                          ₹{(op.ot_amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono tabular-nums font-bold text-sky-700 dark:text-sky-300 bg-sky-50/20 dark:bg-sky-950/10 border-r border-[var(--color-hairline)]/60">
                          ₹
                          {(op.gross_pay || op.total_pay || 0).toLocaleString(
                            "en-IN"
                          )}
                        </td>
                      </>
                    )}

                    {/* DEDUCTIONS */}
                    {(viewMode === "statement" ||
                      viewMode === "deductions") && (
                      <>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          ₹{(op.loan_deduction || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          ₹
                          {(
                            op.additional_balance_salary || 0
                          ).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          ₹
                          {(op.advance_deduction || 0).toLocaleString(
                            "en-IN"
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          ₹{(op.advance_balance || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          ₹{(op.other_deductions || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10 border-r border-[var(--color-hairline)]/60">
                          ₹
                          {(op.net_pay || op.total_pay || 0).toLocaleString(
                            "en-IN"
                          )}
                        </td>
                      </>
                    )}

                    {/* AGENCY PAYOUTS & BALANCE */}
                    {(viewMode === "statement" ||
                      viewMode === "payouts") && (
                      <>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-body)] border-r border-[var(--color-hairline)]/60">
                          ₹{(op.paid_reach || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-body)] border-r border-[var(--color-hairline)]/60">
                          ₹{(op.paid_ss || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-[var(--color-body)] border-r border-[var(--color-hairline)]/60">
                          ₹{(op.paid_quess || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2 px-3.5 text-right font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/10 border-r border-[var(--color-hairline)]/60">
                          ₹{(op.balance_pay || 0).toLocaleString("en-IN")}
                        </td>
                      </>
                    )}

                    {/* LEAVE LEDGER */}
                    {(viewMode === "statement" ||
                      viewMode === "leaves") && (
                      <>
                        <td className="py-2 px-3 text-center font-mono tabular-nums text-[var(--color-body)] border-r border-[var(--color-hairline)]/60">
                          {op.total_pl_quota || 12}
                        </td>
                        <td className="py-2 px-3 text-center font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400 border-r border-[var(--color-hairline)]/60">
                          {op.pl_balance || 0}
                        </td>
                      </>
                    )}

                    {/* BANK INFO */}
                    {(viewMode === "statement" ||
                      viewMode === "deductions") && (
                      <>
                        <td className="py-2 px-3 font-mono text-[11px] text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          {op.bank_account_number || "XXXXXXXX1234"}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-[var(--color-mute)] border-r border-[var(--color-hairline)]/60">
                          {op.bank_ifsc_code || "BANK0001234"}
                        </td>
                      </>
                    )}

                    {/* ACTIONS */}
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onViewSlip(op)}
                          className="p-1.5 text-[var(--color-mute)] hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/30 rounded-md transition-colors cursor-pointer"
                          title="View Salary Slip"
                        >
                          <AnimatedFileText size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditStatement(op)}
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
  );
}
