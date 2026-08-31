"use client";

import React, { forwardRef, useState, useEffect } from "react";
import { AnimatedSearch, AnimatedX, AnimatedLoader } from "./animated-icons";

export interface SearchBoxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "size"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onSearchSubmit?: (query: string) => void;
  placeholder?: string;
  loading?: boolean;
  shortcut?: string; // e.g. "/" or "⌘K"
  size?: "sm" | "md" | "lg";
}

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  (
    {
      value,
      onChange,
      onClear,
      onSearchSubmit,
      placeholder = "Search...",
      loading = false,
      shortcut,
      size = "md",
      className = "",
      disabled = false,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-8 text-xs pl-8 pr-7",
      md: "h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px] text-xs sm:text-[13px] pl-9.5 pr-8",
      lg: "h-11 sm:h-12 text-sm pl-11 pr-10",
    };

    const iconSize = size === "sm" ? 13 : size === "lg" ? 16 : 14;

    const handleClear = () => {
      onChange("");
      onClear?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && value) {
        e.preventDefault();
        handleClear();
      } else if (e.key === "Enter") {
        onSearchSubmit?.(value);
      }
    };

    return (
      <div className={`relative flex items-center w-full group ${className}`}>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] group-focus-within:text-sky-600 dark:group-focus-within:text-sky-400 transition-colors pointer-events-none flex items-center justify-center">
          {loading ? (
            <AnimatedLoader isSpinning size={iconSize} />
          ) : (
            <AnimatedSearch size={iconSize} />
          )}
        </div>

        <input
          ref={ref}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full rounded-lg border border-[var(--color-hairline)] dark:border-[#292C2F] [html:not(.dark)_&]:border-[#E1E5E9] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[#969CA3]/60 dark:placeholder-[#969CA3]/60 font-medium transition-all focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15 ${
            sizeClasses[size]
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          {...props}
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-all cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <AnimatedX size={13} />
            </button>
          )}

          {shortcut && !value && (
            <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-[var(--color-mute)] bg-[var(--color-hairline-soft-surface)] rounded border border-[var(--color-hairline)] select-none pointer-events-none">
              {shortcut}
            </kbd>
          )}
        </div>
      </div>
    );
  }
);

SearchBox.displayName = "SearchBox";
