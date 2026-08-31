"use client";

import React, { forwardRef } from "react";
import { AnimatedCheck, AnimatedMinus } from "./animated-icons";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string;
  indeterminate?: boolean;
  size?: "sm" | "md";
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      error,
      indeterminate = false,
      size = "md",
      className = "",
      id,
      name,
      checked,
      disabled = false,
      onChange,
      ...props
    },
    ref
  ) => {
    const checkboxId = id || name || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const sizeBoxMap = {
      sm: "w-4 h-4 rounded",
      md: "w-4.5 h-4.5 rounded-md",
    };

    const isCheckedOrIndeterminate = checked || indeterminate;

    return (
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={checkboxId}
          className={`inline-flex items-start gap-2.5 select-none ${
            disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer group"
          } ${className}`}
        >
          <div className="relative flex items-center justify-center shrink-0 pt-0.5">
            <input
              ref={ref}
              id={checkboxId}
              name={name}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={onChange}
              className="sr-only"
              {...props}
            />

            <div
              className={`${sizeBoxMap[size]} border flex items-center justify-center transition-all ${
                error
                  ? "border-rose-500 bg-rose-500/10"
                  : isCheckedOrIndeterminate
                  ? "bg-sky-600 dark:bg-sky-500 border-sky-600 dark:border-sky-500 text-white shadow-xs"
                  : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#CBD5E1] bg-[var(--color-canvas)] group-hover:border-sky-500"
              }`}
            >
              {indeterminate ? (
                <AnimatedMinus size={size === "sm" ? 11 : 13} className="text-white" />
              ) : checked ? (
                <AnimatedCheck size={size === "sm" ? 11 : 13} className="text-white" />
              ) : null}
            </div>
          </div>

          {(label || description) && (
            <div className="flex flex-col">
              {label && (
                <span className="text-xs sm:text-[13px] font-medium text-[var(--color-ink)] leading-snug">
                  {label}
                </span>
              )}
              {description && (
                <span className="text-[11px] text-[var(--color-mute)] leading-relaxed">
                  {description}
                </span>
              )}
            </div>
          )}
        </label>

        {error && (
          <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 mt-0.5 flex items-center gap-1 form-error-enter">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
