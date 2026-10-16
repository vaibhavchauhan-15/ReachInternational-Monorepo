"use client";

import React from "react";
import { MetricCard, type MetricIconType } from "./MetricCard";

export type KPIVariant =
  | "default"
  | "warning"
  | "error"
  | "success"
  | "info"
  | "purple"
  | "indigo";

export interface KPICardProps {
  label: string;
  value: number | string;
  icon?: MetricIconType;
  variant?: KPIVariant;
  href?: string;
  onClick?: () => void;
  subtitle?: string;
  trend?: {
    value: string | number;
    isUp: boolean;
    label?: string;
  };
  tooltipText?: string;
  sparklineData?: number[];
  index?: number;
  className?: string;
}

/**
 * ReachInternational Web — Canonical KPICard Component
 * Provides 100% cross-platform parity with apps/mobile KPICard.
 */
export function KPICard({
  label,
  value,
  icon = "Activity",
  variant = "default",
  href,
  onClick,
  subtitle,
  trend,
  tooltipText,
  sparklineData,
  index,
  className,
}: KPICardProps) {
  // Normalize string/numeric value for MetricCard
  const numericValue = typeof value === "number" ? value : Number(value) || 0;
  const normalizedVariant =
    variant === "purple" || variant === "indigo" ? "info" : variant;

  const cardElement = (
    <MetricCard
      label={label}
      value={numericValue}
      icon={icon}
      variant={normalizedVariant}
      href={href}
      subtitle={subtitle}
      trend={trend}
      tooltipText={tooltipText}
      sparklineData={sparklineData}
      index={index}
    />
  );

  if (onClick && !href) {
    return (
      <div onClick={onClick} className={`cursor-pointer ${className || ""}`}>
        {cardElement}
      </div>
    );
  }

  return className ? <div className={className}>{cardElement}</div> : cardElement;
}
