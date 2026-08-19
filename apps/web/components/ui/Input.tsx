"use client";

import { forwardRef, ReactNode, useState } from "react";
import { AnimatedEye, AnimatedEyeOff } from "./animated-icons";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, type, className = "", id, ...props }, ref) => {
    const inputId = id || props.name;
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordType = type === "password";
    const currentType = isPasswordType ? (showPassword ? "text" : "password") : type;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="label-sm font-medium text-[var(--color-ink)] select-none">
            {label}
          </label>
        )}
        <div className="relative w-full flex items-center">
          {icon && (
            <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center transition-colors ${
              error ? "text-rose-500 dark:text-rose-400" : "text-[var(--color-mute)]"
            }`}>
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={currentType}
            className={`input-base w-full ${icon ? "!pl-10" : ""} ${
              isPasswordType ? "!pr-10" : ""
            } ${
              error
                ? "!border-rose-500 dark:!border-rose-400 !bg-rose-500/5 dark:!bg-rose-500/10 focus:!border-rose-500 focus:!ring-2 focus:!ring-rose-500/20"
                : ""
            } ${className}`}
            {...props}
          />
          {isPasswordType && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors p-1 rounded focus:outline-none"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <AnimatedEyeOff size={16} /> : <AnimatedEye size={16} />}
            </button>
          )}
        </div>
        {error && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 form-error-enter">{error}</p>}
        {hint && !error && <p className="body-sm text-[var(--color-mute)] mt-0.5">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";