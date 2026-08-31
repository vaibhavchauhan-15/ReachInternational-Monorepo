"use client";

import { forwardRef, ReactNode, useState } from "react";
import { AnimatedEye, AnimatedEyeOff } from "./animated-icons";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  labelRight?: React.ReactNode;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, labelRight, error, hint, icon, type, className = "", id, required, ...props }, ref) => {
    const inputId = id || props.name;
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === "password";
    const currentType = isPasswordType ? (showPassword ? "text" : "password") : type;

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={inputId}
              className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none flex items-center gap-1"
            >
              <span>{typeof label === "string" && required ? label.replace(/\s*\*+$/, "") : label}</span>
              {required && <span className="text-rose-500 font-semibold">*</span>}
            </label>
            {labelRight && <div className="text-xs">{labelRight}</div>}
          </div>
        )}
        <div className="relative w-full flex items-center">
          {icon && (
            <div
              className={`absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center transition-colors ${
                error
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970]"
              }`}
            >
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={currentType}
            className={`w-full h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px] text-xs sm:text-[13px] font-medium rounded-lg border bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 [html:not(.dark)_&]:placeholder-[#626970]/70 transition-all focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 ${
              icon ? "pl-9.5 sm:pl-10" : "px-3.5"
            } ${
              isPasswordType ? "pr-10 sm:pr-11" : "pr-3.5"
            } ${
              error
                ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
                : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
            } ${className}`}
            {...props}
          />
          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-[#969CA3] dark:text-[#969CA3] [html:not(.dark)_&]:text-[#626970] hover:text-[var(--color-ink)] transition-colors p-1.5 rounded-md focus:outline-none cursor-pointer"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <AnimatedEyeOff size={15} /> : <AnimatedEye size={15} />}
            </button>
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

Input.displayName = "Input";