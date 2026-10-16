"use client";

import React from "react";
import { Modal, Button, Input } from "@/components/ui";
import {
  AnimatedCalendar,
  AnimatedCreditCard,
  AnimatedBriefcase,
  AnimatedBuilding,
  AnimatedSave,
} from "@/components/ui/animated-icons";
import type { HRPayrollOperator } from "@/lib/types/database";

export interface EditStatementComputed {
  netPay: number;
  totalDays: number;
  balance: number;
  plBalance: number;
}

export interface EditStatementModalProps {
  open: boolean;
  onClose: () => void;
  operator: HRPayrollOperator | null;
  formData: Partial<HRPayrollOperator>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<HRPayrollOperator>>>;
  computed: EditStatementComputed;
  isSaving: boolean;
  onSave: () => void;
}

export function EditStatementModal({
  open,
  onClose,
  operator,
  formData,
  setFormData,
  computed,
  isSaving,
  onSave,
}: EditStatementModalProps) {
  if (!operator) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Salary Statement — ${operator.full_name}`}
      description="Modify attendance days, monthly basic salary, deductions, and payouts. Real-time calculations are saved atomically."
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-left">
            <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold block">
              Calculated Net Pay
            </span>
            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400 font-mono">
              ₹{computed.netPay.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isSaving}
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={isSaving}
              onClick={onSave}
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
              value={formData.basic_salary ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, basic_salary: Number(e.target.value) })
              }
            />
            <Input
              label="Working Days (W/D)"
              type="number"
              min="1"
              value={formData.working_days ?? 30}
              onChange={(e) =>
                setFormData({ ...formData, working_days: Number(e.target.value) })
              }
            />
            <Input
              label="Attended Days (A/D)"
              type="number"
              min="0"
              step="0.5"
              value={formData.attended_days ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, attended_days: Number(e.target.value) })
              }
            />
            <Input
              label="Overtime Days (OT)"
              type="number"
              min="0"
              step="0.5"
              value={formData.ot_days ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, ot_days: Number(e.target.value) })
              }
            />
            <Input
              label="PL Adjusted"
              type="number"
              min="0"
              step="0.5"
              value={formData.pl_adjusted ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, pl_adjusted: Number(e.target.value) })
              }
            />
            <div className="flex flex-col justify-end pb-1 text-xs">
              <span className="text-[10px] text-[var(--color-mute)] uppercase font-semibold">
                Total Days
              </span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                {computed.totalDays} days
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
              value={formData.loan_deduction ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, loan_deduction: Number(e.target.value) })
              }
            />
            <Input
              label="Advance Deduction (₹)"
              type="number"
              min="0"
              value={formData.advance_deduction ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, advance_deduction: Number(e.target.value) })
              }
            />
            <Input
              label="Advance Balance (₹)"
              type="number"
              min="0"
              value={formData.advance_balance ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, advance_balance: Number(e.target.value) })
              }
            />
            <Input
              label="Other Deductions (₹)"
              type="number"
              min="0"
              value={formData.other_deductions ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, other_deductions: Number(e.target.value) })
              }
            />
            <Input
              label="Night/Travel Days"
              type="number"
              min="0"
              value={formData.night_travel_days ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, night_travel_days: Number(e.target.value) })
              }
            />
            <Input
              label="Night/Travel Amount (₹)"
              type="number"
              min="0"
              value={formData.night_travel_amount ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, night_travel_amount: Number(e.target.value) })
              }
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
              value={formData.paid_reach ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, paid_reach: Number(e.target.value) })
              }
            />
            <Input
              label="Paid by S&S (₹)"
              type="number"
              min="0"
              value={formData.paid_ss ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, paid_ss: Number(e.target.value) })
              }
            />
            <Input
              label="Paid by Quess (₹)"
              type="number"
              min="0"
              value={formData.paid_quess ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, paid_quess: Number(e.target.value) })
              }
            />
          </div>
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 flex justify-between text-xs font-mono">
            <span className="text-amber-800 dark:text-amber-200 font-semibold">
              Remaining Unpaid Balance:
            </span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              ₹{computed.balance.toLocaleString("en-IN")}
            </span>
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
              value={formData.bank_account_number ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, bank_account_number: e.target.value })
              }
            />
            <Input
              label="Bank IFSC Code"
              type="text"
              placeholder="e.g. BANK0001234"
              value={formData.bank_ifsc_code ?? ""}
              onChange={(e) =>
                setFormData({ ...formData, bank_ifsc_code: e.target.value })
              }
            />
            <Input
              label="Total Annual PL Quota"
              type="number"
              min="0"
              value={formData.total_pl_quota ?? 12}
              onChange={(e) =>
                setFormData({ ...formData, total_pl_quota: Number(e.target.value) })
              }
            />
            <Input
              label="PL Used as on Date"
              type="number"
              min="0"
              value={formData.pl_used_as_on_date ?? 0}
              onChange={(e) =>
                setFormData({ ...formData, pl_used_as_on_date: Number(e.target.value) })
              }
            />
          </div>
          <div className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 flex justify-between text-xs font-mono">
            <span className="text-indigo-800 dark:text-indigo-200 font-semibold">
              Closing PL Balance:
            </span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {computed.plBalance} days
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
