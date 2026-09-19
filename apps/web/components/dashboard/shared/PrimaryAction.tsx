import React from "react";
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
  const variantStyles = {
    primary: {
      card: "bg-gradient-to-r from-[var(--color-ink)] via-[var(--color-ink)] to-[#262626] text-[var(--color-canvas)] hover:opacity-95 border-transparent shadow-sm",
      iconBox: "bg-white/10 text-[var(--color-canvas)]",
      badge: "bg-white/20 text-[var(--color-canvas)]",
    },
    secondary: {
      card: "bg-gradient-to-br from-[var(--color-surface)] via-[var(--color-surface)] to-[var(--color-canvas)] text-[var(--color-ink)] hover:border-[var(--color-ink)]/30 border-[var(--color-hairline)]",
      iconBox: "bg-[var(--color-canvas)] text-[var(--color-mute)] border border-[var(--color-hairline)]",
      badge: "bg-[var(--color-hairline-soft)] text-[var(--color-ink)]",
    },
    warning: {
      card: "bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:opacity-95 border-transparent shadow-sm",
      iconBox: "bg-white/20 text-white",
      badge: "bg-white/25 text-white",
    },
  }[variant];

  return (
    <Link
      href={href}
      className={`group relative flex items-center justify-between p-3.5 sm:p-4 md:p-5 rounded-[var(--radius-md)] border transition-all duration-200 active:scale-[0.99] ${variantStyles.card} ${className}`}
    >
      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0 flex items-center justify-center ${variantStyles.iconBox}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <h3 className="text-xs sm:text-sm md:text-base font-bold leading-tight line-clamp-1">
              {title}
            </h3>
            {badgeText && (
              <span className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 ${variantStyles.badge}`}>
                {badgeText}
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs opacity-80 line-clamp-1 sm:line-clamp-2 mt-0.5 leading-normal">
            {description}
          </p>
        </div>
      </div>

      <div className="pl-2 sm:pl-3 shrink-0">
        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
