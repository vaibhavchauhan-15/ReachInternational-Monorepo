"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";

export interface PrimaryActionProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "warning";
  badgeText?: string;
  className?: string;
}

export function PrimaryAction({
  title,
  description,
  href,
  icon: Icon,
  variant = "primary",
  badgeText,
  className = "",
}: PrimaryActionProps) {
  const iconRef = useRef<{ startAnimation: () => void; stopAnimation: () => void } | null>(null);

  const handleMouseEnter = () => {
    iconRef.current?.startAnimation?.();
  };

  const handleMouseLeave = () => {
    iconRef.current?.stopAnimation?.();
  };

  const variantStyles = {
    primary: {
      card: "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-sky-500/30 dark:border-sky-500/40 hover:border-sky-500/60 shadow-2xs",
      iconBox: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 shadow-2xs",
      badge: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/25",
    },
    secondary: {
      card: "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30 shadow-2xs",
      iconBox: "bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-hairline)] shadow-2xs",
      badge: "bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]",
    },
    warning: {
      card: "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-amber-500/30 dark:border-amber-500/40 hover:border-amber-500/60 shadow-2xs",
      iconBox: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shadow-2xs",
      badge: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25",
    },
  }[variant] || {
    card: "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]/30 shadow-2xs",
    iconBox: "bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-hairline)] shadow-2xs",
    badge: "bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] border border-[var(--color-hairline)]",
  };

  return (
    <Link
      href={href}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative flex items-center justify-between p-3.5 sm:p-4 md:p-5 rounded-[var(--radius-md)] border transition-all duration-200 hover:shadow-whisper hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-link)] motion-reduce:hover:translate-y-0 min-h-[56px] sm:min-h-[64px] ${variantStyles.card} ${className}`}
    >
      <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105 motion-reduce:group-hover:scale-100 ${variantStyles.iconBox}`}>
          {React.isValidElement(Icon) ? (
            React.cloneElement(Icon as React.ReactElement<any>, {
              ref: iconRef,
              size: 20,
              className: "w-5 h-5 shrink-0",
            })
          ) : typeof Icon === "function" || (typeof Icon === "object" && Icon !== null) ? (
            (() => {
              const IconComp = Icon as React.ComponentType<any>;
              return <IconComp ref={iconRef} size={20} className="w-5 h-5 shrink-0" />;
            })()
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <h3 className="text-xs sm:text-sm font-semibold text-[var(--color-ink)] leading-tight">
              {title}
            </h3>
            {badgeText && (
              <span className={`text-[9.5px] sm:text-[10px] uppercase font-semibold font-mono tracking-wider px-2 py-0.5 rounded-full shrink-0 ${variantStyles.badge}`}>
                {badgeText}
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-[var(--color-mute)] line-clamp-1 sm:line-clamp-2 mt-0.5 leading-normal">
            {description}
          </p>
        </div>
      </div>

      <div className="pl-2 sm:pl-3 shrink-0">
        <ArrowRight size={18} className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-mute)] group-hover:text-[var(--color-ink)] transition-all duration-200 group-hover:translate-x-1 motion-reduce:group-hover:translate-x-0" />
      </div>
    </Link>
  );
}
