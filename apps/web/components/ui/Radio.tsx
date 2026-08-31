"use client";

import React, { createContext, useContext, forwardRef } from "react";

interface RadioGroupContextType {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextType | null>(null);

export interface RadioGroupProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  label?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function RadioGroup({
  name,
  value,
  onChange,
  disabled = false,
  label,
  error,
  className = "flex flex-col gap-2.5",
  children,
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onChange, disabled }}>
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <span className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none">
            {label}
          </span>
        )}
        <div role="radiogroup" className={className}>
          {children}
        </div>
        {error && (
          <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 mt-0.5 flex items-center gap-1 form-error-enter">
            {error}
          </p>
        )}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  value: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ value, label, description, className = "", id, disabled = false, onChange, ...props }, ref) => {
    const group = useContext(RadioGroupContext);
    const radioId = id || (group?.name ? `${group.name}-${value}` : value);
    const isChecked = group ? group.value === value : props.checked;
    const isDisabled = disabled || group?.disabled;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      if (group?.onChange) {
        group.onChange(value);
      }
    };

    return (
      <label
        htmlFor={radioId}
        className={`inline-flex items-start gap-2.5 select-none ${
          isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer group"
        } ${className}`}
      >
        <div className="relative flex items-center justify-center shrink-0 pt-0.5">
          <input
            ref={ref}
            id={radioId}
            name={group?.name || props.name}
            type="radio"
            value={value}
            checked={isChecked}
            disabled={isDisabled}
            onChange={handleChange}
            className="sr-only"
            {...props}
          />

          <div
            className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all ${
              isChecked
                ? "border-sky-600 dark:border-sky-500 bg-[var(--color-canvas)]"
                : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#CBD5E1] bg-[var(--color-canvas)] group-hover:border-sky-500"
            }`}
          >
            {isChecked && (
              <div className="w-2.5 h-2.5 rounded-full bg-sky-600 dark:bg-sky-500 shadow-2xs" />
            )}
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
    );
  }
);

Radio.displayName = "Radio";
