"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { AnimatedChevronRight } from "./animated-icons";
import { FadeIn } from "./Motion";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs = [],
  badge,
  actions,
  className = "",
}: PageHeaderProps) {
  return (
    <FadeIn className={`flex flex-col gap-2 mb-6 ${className}`}>
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[var(--color-mute)]">
          <Link href="/dashboard" className="hover:text-[var(--color-ink)] transition-colors">
            Home
          </Link>
          {breadcrumbs.map((item, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              <AnimatedChevronRight size={12} className="text-[var(--color-faint)]" />
              {item.href ? (
                <Link href={item.href} className="hover:text-[var(--color-ink)] transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-[var(--color-ink)] font-medium">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Main Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="heading-lg text-[var(--color-ink)] tracking-tight">{title}</h1>
          {badge}
        </div>

        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>

      {description && <p className="body-md text-[var(--color-body)] max-w-3xl">{description}</p>}
    </FadeIn>
  );
}
