"use client";

import React from "react";
import Link from "next/link";
import { AnimatedChevronRight, AnimatedHome } from "./animated-icons";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  homeHref?: string;
  className?: string;
}

export function Breadcrumb({
  items,
  showHome = true,
  homeHref = "/dashboard",
  className = "",
}: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-xs text-[var(--color-mute)] ${className}`}>
      {showHome && (
        <Link
          href={homeHref}
          className="hover:text-[var(--color-ink)] transition-colors flex items-center gap-1"
          aria-label="Home"
        >
          <AnimatedHome size={13} className="shrink-0" />
          <span className="hidden sm:inline">Home</span>
        </Link>
      )}

      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        return (
          <React.Fragment key={idx}>
            {(showHome || idx > 0) && (
              <AnimatedChevronRight size={12} className="text-[var(--color-faint)] shrink-0" />
            )}

            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-[var(--color-ink)] transition-colors flex items-center gap-1 truncate"
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </Link>
            ) : (
              <span className="text-[var(--color-ink)] font-semibold flex items-center gap-1 truncate">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
