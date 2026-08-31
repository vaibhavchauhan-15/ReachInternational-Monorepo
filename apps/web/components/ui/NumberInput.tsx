"use client";

import React, { forwardRef, useState, useEffect } from "react";
import { AnimatedPlus, AnimatedMinus } from "./animated-icons";

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: string;
  error?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  value?: number | string;
  defaultValue?: number | string;
  prefix?: string;
  suffix?: string;
  showSteppers?: boolean;
  onChange?: (value: number | undefined) => void;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      label,
      error,
      hint,
      min,
      max,
      step = 1,
      value: valueProp,
      defaultValue,
      prefix,
      suffix,
      showSteppers = true,
      className = "",
      id,
      name,
      disabled = false,
      required = false,
      onChange,
      ...props
    },
    ref
  ) => {
    const inputId = id || name;

    const [internalValue, setInternalValue] = useState<string>(() => {
      if (valueProp !== undefined) return String(valueProp);
      if (defaultValue !== undefined) return String(defaultValue);
      return "";
    });

    useEffect(() => {
      if (valueProp !== undefined) {
        setInternalValue(String(valueProp));
      }
    }, [valueProp]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setInternalValue(raw);

      if (raw === "") {
        onChange?.(undefined);
        return;
      }

      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange?.(parsed);
      }
    };

    const handleStep = (direction: "inc" | "dec") => {
      if (disabled) return;
      const current = parseFloat(internalValue) || 0;
      let next = direction === "inc" ? current + step : current - step;

      // Handle precision issues with decimals
      next = parseFloat(next.toFixed(4));

      if (min !== undefined && next < min) next = min;
      if (max !== undefined && next > max) next = max;

      setInternalValue(String(next));
      onChange?.(next);
    };

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none flex items-center justify-between"
          >
            <span>{label}</span>
            {required && <span className="text-[10px] text-rose-500 font-bold">* Required</span>}
          </label>
        )}

        <div className="relative w-full flex items-center">
          {prefix && (
            <span className="absolute left-3.5 text-xs font-bold text-[var(--color-mute)] pointer-events-none select-none">
              {prefix}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            name={name}
            type="number"
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            value={internalValue}
            onChange={handleInputChange}
            className={`w-full h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px] text-xs sm:text-[13px] font-medium rounded-lg border bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 transition-all focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              prefix ? "pl-8" : "px-3.5"
            } ${
              showSteppers ? "pr-20 sm:pr-22" : suffix ? "pr-12" : "pr-3.5"
            } ${
              error
                ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
            {...props}
          />

          {suffix && !showSteppers && (
            <span className="absolute right-3.5 text-xs font-semibold text-[var(--color-mute)] pointer-events-none select-none">
              {suffix}
            </span>
          )}

          {showSteppers && (
            <div className="absolute right-1.5 flex items-center gap-0.5">
              {suffix && (
                <span className="text-[11px] font-semibold text-[var(--color-mute)] pr-1 pointer-events-none select-none">
                  {suffix}
                </span>
              )}
              <button
                type="button"
                disabled={disabled || (min !== undefined && parseFloat(internalValue) <= min)}
                onClick={() => handleStep("dec")}
                className="h-7 w-7 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-95 text-[var(--color-ink)] flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Decrease value"
              >
                <AnimatedMinus size={13} />
              </button>
              <button
                type="button"
                disabled={disabled || (max !== undefined && parseFloat(internalValue) >= max)}
                onClick={() => handleStep("inc")}
                className="h-7 w-7 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-95 text-[var(--color-ink)] flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Increase value"
              >
                <AnimatedPlus size={13} />
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-[11px] sm:text-xs font-medium text-rose-500 dark:text-rose-400 mt-0.5 flex items-center gap-1 form-error-enter">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-[11px] text-[var(--color-mute)] mt-0.5">{hint}</p>
        )}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";
