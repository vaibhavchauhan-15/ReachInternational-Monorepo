"use client";

import React from "react";
import Link from "next/link";
import { Button, Badge, highlightText } from "@/components/ui";
import {
  AnimatedCheck,
  AnimatedFileText,
  AnimatedEdit2,
} from "@/components/ui/animated-icons";
import type { HRPayrollOperator } from "@/lib/types/database";

export interface PayrollMobileCardProps {
  op: HRPayrollOperator;
  idx: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onViewSlip: (op: HRPayrollOperator) => void;
  onEditStatement: (op: HRPayrollOperator) => void;
  searchQuery?: string;
}

export function PayrollMobileCard({
  op,
  idx,
  isSelected,
  onToggleSelect,
  onViewSlip,
  onEditStatement,
  searchQuery = "",
}: PayrollMobileCardProps) {
  return (
    <div
      className={`rounded-xl border bg-white dark:bg-[#121212] p-3.5 sm:p-4 shadow-xs space-y-3 transition-colors ${
        isSelected
          ? "border-sky-500 bg-sky-50/20 dark:bg-sky-950/20 ring-1 ring-sky-500"
          : "border-[var(--color-hairline)]"
      }`}
    >
      {/* Header Row: Checkbox, Name, SL NO, Net Pay */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0 flex-1">
          {/* Minimum 44px Touch Target for Checkbox */}
          <div className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2.5 -mt-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onToggleSelect(op.operator_id)}
              className={`h-6 w-6 rounded border transition-all flex items-center justify-center cursor-pointer ${
                isSelected
                  ? "bg-[var(--color-ink)] border-[var(--color-ink)] text-[var(--color-canvas)]"
                  : "border-[var(--color-hairline)] hover:border-[var(--color-ink)]/50"
              }`}
              title={isSelected ? "Deselect" : "Select"}
            >
              {isSelected && <AnimatedCheck size={13} />}
            </button>
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold text-[var(--color-mute)] bg-[var(--color-canvas)] px-1.5 py-0.5 rounded border border-[var(--color-hairline)]">
                #{op.sl_no || idx + 1}
              </span>
              <Link
                href={`/users?search=${encodeURIComponent(op.full_name)}`}
                className="font-bold text-sm text-[var(--color-ink)] hover:underline truncate"
              >
                {highlightText(op.full_name, searchQuery)}
              </Link>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-mute)] font-mono">
              <span>{op.phone || "No phone"}</span>
              {op.state && <span>• {op.state}</span>}
            </div>
          </div>
        </div>

        {/* Right side Net Pay Highlight */}
        <div className="text-right shrink-0">
          <div className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            ₹{(op.net_pay || op.total_pay || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold">
            Net Pay
          </span>
        </div>
      </div>

      {/* Payout Status Badge */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--color-hairline)] text-xs">
        <span className="text-[var(--color-mute)]">Disbursement Status:</span>
        {op.status === "paid" ? (
          <Badge variant="success">
            Paid in Full
          </Badge>
        ) : (op.balance_pay || 0) > 0 ? (
          <Badge variant="warning">
            Partial (bal ₹{(op.balance_pay || 0).toLocaleString("en-IN")})
          </Badge>
        ) : (
          <Badge variant="neutral">
            Pending (₹{(op.net_pay || op.total_pay || 0).toLocaleString("en-IN")})
          </Badge>
        )}
      </div>

      {/* Additional Detailed Breakdown Drawer on Mobile */}
      <div className="space-y-1.5 text-xs text-[var(--color-body)] pt-1 border-t border-[var(--color-hairline)]">
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-mute)]">Basic Monthly Salary:</span>
          <span className="font-mono tabular-nums font-medium">
            ₹{(op.basic_salary || 0).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-mute)]">Overtime &amp; Leaves:</span>
          <span className="font-mono tabular-nums">
            OT: {op.ot_days || 0}d (₹{(op.ot_amount || 0).toLocaleString("en-IN")}) • PL:{" "}
            {op.pl_adjusted || 0}d
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-mute)]">Deductions (Loan/Adv):</span>
          <span className="font-mono tabular-nums text-rose-600 dark:text-rose-400">
            -₹
            {(
              (op.loan_deduction || 0) +
              (op.advance_deduction || 0) +
              (op.other_deductions || 0)
            ).toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[var(--color-mute)]">PL Balance &amp; Bank:</span>
          <span className="font-mono text-[11px] truncate">
            {op.pl_balance || 0} PL left • {op.bank_ifsc_code || "BANK0001234"}
          </span>
        </div>
      </div>

      {/* Action Buttons Row (min 44px touch targets) */}
      <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--color-hairline)]">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onViewSlip(op)}
          icon={<AnimatedFileText size={14} className="text-sky-500" />}
          className="h-11 px-3 text-xs font-semibold gap-1.5 flex-1"
        >
          <span>View Salary Slip</span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onEditStatement(op)}
          icon={<AnimatedEdit2 size={13} />}
          className="h-11 px-3 text-xs font-semibold gap-1.5 flex-1"
        >
          <span>Edit Statement</span>
        </Button>
      </div>
    </div>
  );
}
