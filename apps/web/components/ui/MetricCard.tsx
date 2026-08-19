"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  AnimatedWrench,
  AnimatedCheckCircle,
  AnimatedAlertTriangle,
  AnimatedCalendarClock,
  AnimatedCalendar,
  AnimatedBell,
  AnimatedXCircle,
  AnimatedClock,
  AnimatedClipboardList,
  AnimatedRotateCw,
  AnimatedActivity,
  AnimatedSparkles,
  AnimatedUserCheck,
  AnimatedShieldCheck,
  AnimatedArrowRight,
  AnimatedIcon,
} from "./animated-icons";
import {
  AnimatedTrendingUp,
  AnimatedTrendingDown,
} from "./animated-icons";
import { AnimatedCounter, springTransition } from "./Motion";
import { InfoTooltip } from "./tooltip";
import { Card } from "./Card";
import { Sparkline } from "./Sparkline";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number | string }>> = {
  Wrench: AnimatedWrench,
  CheckCircle: AnimatedCheckCircle,
  AlertTriangle: AnimatedAlertTriangle,
  CalendarClock: AnimatedCalendarClock,
  CalendarDays: AnimatedCalendar,
  Bell: AnimatedBell,
  BellRing: AnimatedBell,
  XCircle: AnimatedXCircle,
  Clock: AnimatedClock,
  ClipboardList: AnimatedClipboardList,
  History: AnimatedRotateCw,
  Activity: AnimatedActivity,
  Zap: AnimatedSparkles,
  UserCheck: AnimatedUserCheck,
  ShieldCheck: AnimatedShieldCheck,
};

export type MetricIconType =
  | keyof typeof ICON_MAP
  | React.ComponentType<{ className?: string; size?: number | string }>;

interface MetricCardProps {
  label: string;
  value: number;
  icon: MetricIconType;
  variant?: "default" | "warning" | "error" | "success" | "info";
  href?: string;
  trend?: {
    value: string | number;
    isUp: boolean;
    label?: string;
  };
  tooltipText?: string;
  subtitle?: string;
  sparklineData?: number[];
  index?: number;
}

const variantStyles = {
  default: {
    text: "text-[var(--color-ink)]",
    iconBg: "bg-[var(--color-hairline-soft)] text-[var(--color-mute)]",
    sparkline: "text-[var(--color-link)]",
    accent: "from-[var(--color-link)]/10",
  },
  warning: {
    text: "text-[var(--color-warning-deep)] dark:text-[var(--color-warning)]",
    iconBg: "bg-[var(--color-warning-soft)] text-[var(--color-warning-deep)] dark:text-[var(--color-warning)]",
    sparkline: "text-[var(--color-warning-deep)] dark:text-[var(--color-warning)]",
    accent: "from-[var(--color-warning)]/15",
  },
  error: {
    text: "text-[var(--color-error-deep)] dark:text-[var(--color-error)]",
    iconBg: "bg-[var(--color-error)]/10 text-[var(--color-error-deep)] dark:text-[var(--color-error)]",
    sparkline: "text-[var(--color-error-deep)] dark:text-[var(--color-error)]",
    accent: "from-[var(--color-error)]/15",
  },
  success: {
    text: "text-[var(--color-success-deep)] dark:text-[var(--color-success)]",
    iconBg: "bg-[var(--color-success)]/10 text-[var(--color-success-deep)] dark:text-[var(--color-success)]",
    sparkline: "text-[var(--color-success-deep)] dark:text-[var(--color-success)]",
    accent: "from-[var(--color-success)]/15",
  },
  info: {
    text: "text-[var(--color-link-deep)] dark:text-[var(--color-link)]",
    iconBg: "bg-[var(--color-link-soft)] text-[var(--color-link-deep)] dark:text-[var(--color-link)]",
    sparkline: "text-[var(--color-link-deep)] dark:text-[var(--color-link)]",
    accent: "from-[var(--color-link)]/15",
  },
};

export function MetricCard({
  label,
  value,
  icon,
  variant = "default",
  href,
  trend,
  tooltipText,
  subtitle,
  sparklineData,
  index = 0,
}: MetricCardProps) {
  const reduceMotion = useReducedMotion();
  const IconComponent = typeof icon === "string" ? ICON_MAP[icon] ?? AnimatedWrench : icon;
  const styles = variantStyles[variant];

  const cardContent = (
    <motion.div
      className="h-full w-full flex flex-col"
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: reduceMotion ? 0 : index * 0.05 }}
      whileTap={href ? { scale: 0.97 } : undefined}
    >
      <Card
        padding="md"
        className={`relative flex flex-col justify-between gap-2.5 group overflow-hidden h-full w-full ${
          href ? "cursor-pointer card-hover-system" : ""
        }`}
      >
        {/* Soft gradient accent */}
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.accent} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
          aria-hidden="true"
        />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            <span className="body-sm text-xs font-medium text-[var(--color-mute)] truncate max-w-[100px] xs:max-w-none">
              {label}
            </span>
            {tooltipText && <InfoTooltip content={tooltipText} />}
          </div>
          <div
            className={`flex h-7.5 w-7.5 sm:h-8 sm:w-8 items-center justify-center rounded-[var(--radius-sm)] transition-transform duration-200 group-hover:scale-105 flex-shrink-0 ${styles.iconBg}`}
          >
            <IconComponent className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          </div>
        </div>

        <div className="relative mt-1 flex items-baseline gap-2">
          <AnimatedCounter value={value} className={`text-2xl sm:text-3xl font-bold tracking-tight tabular-nums ${styles.text}`} />
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold ${
                trend.isUp
                  ? "text-[var(--color-success-deep)] dark:text-[var(--color-success)]"
                  : "text-[var(--color-error-deep)] dark:text-[var(--color-error)]"
              }`}
            >
              {trend.isUp ? (
                <AnimatedTrendingUp size={12} aria-hidden="true" />
              ) : (
                <AnimatedTrendingDown size={12} aria-hidden="true" />
              )}
              {trend.value}
            </span>
          )}
        </div>

        {sparklineData && sparklineData.length > 0 && (
          <div className="relative mt-1">
            <Sparkline
              data={sparklineData}
              height={24}
              strokeClassName={styles.sparkline}
              fillClassName={styles.sparkline}
            />
          </div>
        )}

        {subtitle && (
          <p className="relative text-[10px] sm:text-[11px] text-[var(--color-mute)] leading-tight">
            {subtitle}
          </p>
        )}

        {href && (
          <div className="relative flex items-center gap-1 text-[var(--color-mute)] group-hover:text-[var(--color-ink)] transition-colors">
            <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View
            </span>
            <AnimatedArrowRight size={14} trigger="parent-hover" />
          </div>
        )}
      </Card>
    </motion.div>
  );

  if (href) {
    return <Link href={href} className="block h-full w-full">{cardContent}</Link>;
  }

  return cardContent;
}