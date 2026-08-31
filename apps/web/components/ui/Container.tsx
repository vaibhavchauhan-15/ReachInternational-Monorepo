"use client";

import React from "react";

export interface PageContainerProps {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}

const containerSizeMap = {
  sm: "max-w-3xl",
  md: "max-w-5xl",
  lg: "max-w-7xl",
  xl: "max-w-[1440px]",
  full: "max-w-full",
};

export function PageContainer({
  children,
  size = "xl",
  className = "",
}: PageContainerProps) {
  return (
    <div
      className={`w-full mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 ${containerSizeMap[size]} ${className}`}
    >
      {children}
    </div>
  );
}

export interface SectionProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Section({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: SectionProps) {
  return (
    <section className={`w-full space-y-3.5 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline)] pb-2.5">
          <div className="flex flex-col space-y-0.5">
            {title && (
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-[var(--color-mute)]">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export interface StackProps {
  direction?: "row" | "col";
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  wrap?: boolean;
  className?: string;
  children: React.ReactNode;
}

const gapMap = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4 sm:gap-6",
  xl: "gap-6 sm:gap-8",
};

export function Stack({
  direction = "col",
  gap = "md",
  align = "stretch",
  justify = "start",
  wrap = false,
  className = "",
  children,
}: StackProps) {
  const dirClass = direction === "row" ? "flex-row" : "flex-col";
  const alignClass = `items-${align}`;
  const justifyClass = justify === "between" ? "justify-between" : `justify-${justify}`;
  const wrapClass = wrap ? "flex-wrap" : "flex-nowrap";

  return (
    <div
      className={`flex ${dirClass} ${gapMap[gap]} ${alignClass} ${justifyClass} ${wrapClass} ${className}`}
    >
      {children}
    </div>
  );
}

export interface GridProps {
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  smCols?: 1 | 2 | 3 | 4 | 6 | 12;
  mdCols?: 1 | 2 | 3 | 4 | 6 | 12;
  lgCols?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  children: React.ReactNode;
}

export function Grid({
  cols = 1,
  smCols,
  mdCols,
  lgCols,
  gap = "md",
  className = "",
  children,
}: GridProps) {
  const colsClass = `grid-cols-${cols}`;
  const smColsClass = smCols ? `sm:grid-cols-${smCols}` : "";
  const mdColsClass = mdCols ? `md:grid-cols-${mdCols}` : "";
  const lgColsClass = lgCols ? `lg:grid-cols-${lgCols}` : "";

  return (
    <div className={`grid ${colsClass} ${smColsClass} ${mdColsClass} ${lgColsClass} ${gapMap[gap]} ${className}`}>
      {children}
    </div>
  );
}
