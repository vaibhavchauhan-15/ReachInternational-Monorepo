"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import type { HRPayrollOperator } from "@/lib/types/database";

export interface SalarySlipModalProps {
  open: boolean;
  onClose: () => void;
  operator: HRPayrollOperator | null;
  payrollMonth: string;
}

export function SalarySlipModal({
  open,
  onClose,
  operator,
  payrollMonth,
}: SalarySlipModalProps) {
  if (!operator) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Official Salary Statement Slip"
      description={`Monthly compensation statement for ${operator.full_name} (${payrollMonth})`}
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
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold"
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-2 text-xs font-sans">
        {/* Slip Header Box */}
        <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2">
          <div className="flex items-center justify-between border-b border-[var(--color-hairline)] pb-2">
            <div>
              <h4 className="font-extrabold text-sm text-[var(--color-ink)] uppercase tracking-wider">
                REACH INTERNATIONAL
              </h4>
              <p className="text-[11px] text-[var(--color-mute)]">
                Industrial Fleet &amp; Personnel Operations
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono font-bold text-xs bg-[var(--color-ink)] text-[var(--color-canvas)] px-2 py-0.5 rounded">
                SL #{operator.sl_no || 1}
              </span>
              <p className="text-[10px] text-[var(--color-mute)] mt-0.5">
                Month: {payrollMonth}
              </p>
            </div>
          </div>

          {/* Operator details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="text-[var(--color-mute)] block">Operator Name:</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {operator.full_name}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] block">Phone Number:</span>
              <span className="font-mono text-[var(--color-ink)]">
                {operator.phone || "—"}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] block">Date of Joining:</span>
              <span className="font-mono text-[var(--color-ink)]">
                {operator.doj || "—"}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] block">Bank Account:</span>
              <span className="font-mono text-[var(--color-ink)]">
                {operator.bank_account_number || "XXXXXXXX1234"}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] block">IFSC Code:</span>
              <span className="font-mono text-[var(--color-ink)]">
                {operator.bank_ifsc_code || "BANK0001234"}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] block">Location:</span>
              <span className="text-[var(--color-ink)]">
                {operator.city || operator.state || "—"}
              </span>
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
              <span className="text-[var(--color-mute)] text-[10px] block">
                Working (W/D)
              </span>
              <span className="font-semibold">{operator.working_days || 30} d</span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] text-[10px] block">
                Attended (A/D)
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {operator.attended_days || operator.work_days || 0} d
              </span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] text-[10px] block">
                OT Days
              </span>
              <span className="font-semibold">{operator.ot_days || 0} d</span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] text-[10px] block">
                PL Adjusted
              </span>
              <span className="font-semibold">{operator.pl_adjusted || 0} d</span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] text-[10px] block">
                Total Payable Days
              </span>
              <span className="font-bold text-blue-700 dark:text-blue-300">
                {operator.total_days || 0} d
              </span>
            </div>
          </div>
        </div>

        {/* Earnings & Deductions Breakdown 2-Column Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Earnings */}
          <div className="p-3 rounded-lg border border-sky-500/20 bg-sky-50/10 dark:bg-sky-950/10 space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300 block mb-1 border-b border-sky-500/20 pb-1">
              Gross Earnings (Credits)
            </span>
            <div className="flex justify-between">
              <span className="text-[var(--color-mute)]">Basic Monthly Salary:</span>
              <span className="font-mono">
                ₹{(operator.basic_salary || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-mute)]">Salary as per Attendance:</span>
              <span className="font-mono">
                ₹{(operator.attended_amount || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-mute)]">Overtime Wages:</span>
              <span className="font-mono">
                ₹{(operator.ot_amount || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-mute)]">Paid Leave Encashment:</span>
              <span className="font-mono">
                ₹{(operator.pl_amount || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-mute)]">Night / Travel Allowances:</span>
              <span className="font-mono">
                ₹{(operator.night_travel_amount || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between font-bold pt-1.5 border-t border-sky-500/20 text-sky-700 dark:text-sky-300">
              <span>Total Gross Salary:</span>
              <span className="font-mono">
                ₹{(operator.gross_pay || operator.total_pay || 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {/* Deductions */}
          <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-50/10 dark:bg-rose-950/10 space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300 block mb-1 border-b border-rose-500/20 pb-1">
              Statutory &amp; Internal Deductions
            </span>
            <div className="flex justify-between">
              <span className="text-[var(--color-mute)]">Loan Recovery:</span>
              <span className="font-mono">
                ₹{(operator.loan_deduction || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-mute)]">Salary Advance Deduction:</span>
              <span className="font-mono">
                ₹{(operator.advance_deduction || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-mute)]">Other Miscellaneous:</span>
              <span className="font-mono">
                ₹{(operator.other_deductions || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between font-bold pt-1.5 border-t border-rose-500/20 text-rose-700 dark:text-rose-300">
              <span>Total Deductions:</span>
              <span className="font-mono">
                -₹{((operator.loan_deduction || 0) + (operator.advance_deduction || 0) + (operator.other_deductions || 0)).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Total Net Pay Highlight Bar */}
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-emerald-800 dark:text-emerald-200">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider block">
              Net Payable Amount
            </span>
            <span className="text-xs text-emerald-700 dark:text-emerald-300">
              Disbursed to Bank Account
            </span>
          </div>
          <div className="text-right">
            <span className="text-xl font-extrabold font-mono">
              ₹{(operator.net_pay || operator.total_pay || 0).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Disbursements Summary Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] space-y-1">
            <span className="font-semibold text-[10px] uppercase text-[var(--color-mute)] block">
              Agency Disbursements
            </span>
            <div className="flex justify-between">
              <span>Reach International:</span>
              <span className="font-mono">
                ₹{(operator.paid_reach || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span>S&amp;S Agency:</span>
              <span className="font-mono">
                ₹{(operator.paid_ss || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Quess Corp:</span>
              <span className="font-mono">
                ₹{(operator.paid_quess || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-[var(--color-hairline)] text-amber-600 dark:text-amber-400">
              <span>Remaining Unpaid Balance:</span>
              <span className="font-mono">
                ₹{(operator.balance_pay || 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg border border-[var(--color-hairline)] space-y-1">
            <span className="font-semibold text-[10px] uppercase text-[var(--color-mute)] block">
              Paid Leave Ledger
            </span>
            <div className="flex justify-between">
              <span>Annual PL Quota:</span>
              <span className="font-mono">{operator.total_pl_quota || 12} days</span>
            </div>
            <div className="flex justify-between">
              <span>Previously Used (To Date):</span>
              <span className="font-mono">
                {operator.pl_used_as_on_date || 0} days
              </span>
            </div>
            <div className="flex justify-between">
              <span>Adjusted this Month:</span>
              <span className="font-mono">{operator.pl_adjusted || 0} days</span>
            </div>
            <div className="flex justify-between font-bold pt-1 border-t border-[var(--color-hairline)] text-indigo-600 dark:text-indigo-400">
              <span>Closing PL Balance:</span>
              <span className="font-mono">
                {operator.pl_balance || 0} days remaining
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
