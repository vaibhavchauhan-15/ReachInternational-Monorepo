"use client";

import React, { forwardRef } from "react";
import { motion } from "framer-motion";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md";
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      label,
      description,
      size = "md",
      checked = false,
      disabled = false,
      onChange,
      className = "",
      id,
      name,
      ...props
    },
    ref
  ) => {
    const switchId = id || name || (typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const isSmall = size === "sm";

    return (
      <label
        htmlFor={switchId}
        className={`inline-flex items-start gap-3 select-none ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${className}`}
      >
        <div className="relative inline-flex items-center shrink-0 pt-0.5">
          <input
            ref={ref}
            id={switchId}
            name={name}
            type="checkbox"
            role="switch"
            aria-checked={checked}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only"
            {...props}
          />

          <div
            className={`transition-colors duration-200 rounded-full p-0.5 ${
              isSmall ? "w-8 h-4.5" : "w-10 h-6"
            } ${
              checked
                ? "bg-sky-600 dark:bg-sky-500 shadow-xs"
                : "bg-[var(--color-hairline-soft-surface)] dark:bg-neutral-800 border border-[var(--color-hairline)]"
            }`}
          >
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`rounded-full bg-white shadow-sm ${
                isSmall ? "w-3.5 h-3.5" : "w-5 h-5"
              } ${checked ? "ml-auto" : "mr-auto"}`}
            />
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

Switch.displayName = "Switch";
