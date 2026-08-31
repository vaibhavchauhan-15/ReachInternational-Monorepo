"use client";

import React, { forwardRef, useState } from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  showCharCount?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      hint,
      maxLength,
      showCharCount = false,
      className = "",
      id,
      name,
      required = false,
      disabled = false,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const textareaId = id || name;
    const [charCount, setCharCount] = useState<number>(() => {
      if (typeof value === "string") return value.length;
      if (typeof defaultValue === "string") return defaultValue.length;
      return 0;
    });

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCharCount(e.target.value.length);
      onChange?.(e);
    };

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={textareaId}
              className="text-[12px] sm:text-[13px] font-medium text-[var(--color-ink)] select-none"
            >
              {label}
              {required && <span className="text-rose-500 ml-0.5">*</span>}
            </label>

            {showCharCount && maxLength && (
              <span className="text-[10px] font-mono text-[var(--color-mute)]">
                {charCount}/{maxLength}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          name={name}
          maxLength={maxLength}
          disabled={disabled}
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
          className={`w-full min-h-[90px] p-3 text-xs sm:text-[13px] font-medium rounded-lg border bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 resize-y transition-all focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 ${
            error
              ? "border-rose-500 dark:border-rose-400 bg-rose-500/5 dark:bg-rose-500/10 focus:border-rose-500"
              : "border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] hover:border-[#3A3E42] dark:hover:border-[#3A3E42] [html:not(.dark)_&]:hover:border-[#CBD5E1]"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
          {...props}
        />

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

Textarea.displayName = "Textarea";
