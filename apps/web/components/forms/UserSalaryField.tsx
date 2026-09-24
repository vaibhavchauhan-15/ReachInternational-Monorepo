"use client";

import { Input } from "@/components/ui";
import { Lock } from "lucide-react";

export interface UserSalaryFieldProps {
  value: string | number;
  onChange?: (val: string) => void;
  role?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

/**
 * Reusable Monthly Salary Field Component
 * Standardized INR (₹) monthly compensation box across all user forms.
 */
export function UserSalaryField({
  value,
  onChange,
  role,
  error,
  disabled = false,
  readOnly = false,
  required,
  id = "user-monthly-salary",
  className = "",
}: UserSalaryFieldProps) {
  const isOperator = role === "operator";
  const isMandatory = required !== undefined ? required : isOperator;

  const displayValue = value === null || value === undefined ? "" : String(value);

  if (readOnly) {
    return (
      <div className={`flex flex-col gap-1 w-full ${className}`}>
        <label className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none flex items-center justify-between">
          <span>Monthly Salary (₹)</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--color-mute)] bg-[var(--color-hairline)] px-2 py-0.5 rounded">
            <Lock className="w-2.5 h-2.5" /> Read-only
          </span>
        </label>
        <div className="flex items-center h-10 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)]/50 text-xs sm:text-[13px] font-semibold text-[var(--color-ink)] select-all">
          <span className="text-[var(--color-mute)] font-normal mr-1.5">₹</span>
          {displayValue ? Number(displayValue).toLocaleString("en-IN") : "Not specified"}
        </div>
        <p className="text-[11px] text-[var(--color-mute)] leading-tight">
          Base monthly remuneration recorded by administration.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      <Input
        id={id}
        name="monthly_salary"
        type="number"
        min="0"
        step="100"
        label="Monthly Base Salary (₹)"
        value={displayValue}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder="e.g. 25000"
        required={isMandatory}
        disabled={disabled}
        error={error}
        icon={<span className="text-xs font-bold text-[var(--color-mute)]">₹</span>}
      />
      <p className="text-[11px] text-[var(--color-mute)] leading-tight">
        {isOperator
          ? "Mandatory base monthly compensation for machine operator personnel in INR (₹)."
          : "Base monthly compensation for employee personnel in INR (₹)."}
      </p>
    </div>
  );
}
