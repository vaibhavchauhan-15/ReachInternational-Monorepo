"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AnimatedTrendingUp,
  AnimatedAlertTriangle,
} from "@/components/ui/animated-icons";
import { Card, CardHeader, InfoTooltip } from "@/components/ui";
import { MonthlyServicesChart, OverdueTrendChart } from "@/components/dashboard/ChartLoaders";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { MonthlyServiceData, OverdueTrendData } from "@/lib/types/database";

interface MobileChartsWrapperProps {
  monthlyServices: MonthlyServiceData[];
  overdueTrend: OverdueTrendData[];
}

export function MobileChartsWrapper({
  monthlyServices,
  overdueTrend,
}: MobileChartsWrapperProps) {
  const [activeChart, setActiveChart] = useState<"monthly" | "overdue">("monthly");
  const reduceMotion = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  return (
    <div>
      {/* Mobile Tabbed Chart View (< lg screens) — only mounted on mobile so hidden Recharts never render 0×0 */}
      {!isDesktop && (
      <div className="space-y-3">
        {/* Segmented Tab Switcher */}
        <div className="p-1 rounded-2xl bg-muted/60 border border-border flex items-center justify-between gap-1 shadow-2xs">
          <button
            onClick={() => setActiveChart("monthly")}
            className="relative flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors focus:outline-none select-none"
          >
            {activeChart === "monthly" && (
              <motion.div
                layoutId="mobile-chart-active-tab"
                className="absolute inset-0 bg-card border border-border rounded-xl shadow-xs"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <AnimatedTrendingUp
                size={14}
                className={
                  activeChart === "monthly"
                    ? "text-[var(--color-success-deep)] dark:text-[var(--color-success)]"
                    : "text-muted-foreground"
                }
              />
              <span
                className={
                  activeChart === "monthly"
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground font-medium"
                }
              >
                Completed Services
              </span>
            </span>
          </button>

          <button
            onClick={() => setActiveChart("overdue")}
            className="relative flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors focus:outline-none select-none"
          >
            {activeChart === "overdue" && (
              <motion.div
                layoutId="mobile-chart-active-tab"
                className="absolute inset-0 bg-card border border-border rounded-xl shadow-xs"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <AnimatedAlertTriangle
                size={14}
                className={
                  activeChart === "overdue"
                    ? "text-[var(--color-error-deep)] dark:text-[var(--color-error)]"
                    : "text-muted-foreground"
                }
              />
              <span
                className={
                  activeChart === "overdue"
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground font-medium"
                }
              >
                Overdue Backlog
              </span>
            </span>
          </button>
        </div>

        {/* Animated Active Chart Card */}
        <Card padding="lg" className="shadow-xs border border-border bg-card">
          <AnimatePresence mode="wait">
            {activeChart === "monthly" ? (
              <motion.div
                key="monthly-chart"
                initial={{ opacity: 0, x: reduceMotion ? 0 : -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduceMotion ? 0 : 6 }}
                transition={{ duration: 0.15 }}
              >
                <CardHeader
                  title="Monthly Services Completed"
                  eyebrow="Last 12 months trend"
                  action={
                    <div className="flex items-center gap-1">
                      <AnimatedTrendingUp size={16} className="text-[var(--color-success-deep)] dark:text-[var(--color-success)]" />
                      <InfoTooltip content="Historical trend of completed service records" />
                    </div>
                  }
                />
                <div className="mt-4">
                  <MonthlyServicesChart data={monthlyServices} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="overdue-chart"
                initial={{ opacity: 0, x: reduceMotion ? 0 : 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduceMotion ? 0 : -6 }}
                transition={{ duration: 0.15 }}
              >
                <CardHeader
                  title="Overdue Trend"
                  eyebrow="Last 30 days backlog"
                  action={
                    <div className="flex items-center gap-1">
                      <AnimatedAlertTriangle size={16} className="text-[var(--color-error-deep)] dark:text-[var(--color-error)]" />
                      <InfoTooltip content="Track overdue machine backlog reduction" />
                    </div>
                  }
                />
                <div className="mt-4">
                  <OverdueTrendChart data={overdueTrend} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
      )}

      {/* Desktop Side-by-Side View (>= lg screens) — only mounted on desktop */}
      {isDesktop && (
      <div className="grid grid-cols-2 gap-4">
        <Card padding="lg" className="shadow-xs hover:border-muted-foreground/40 transition-colors bg-card border border-border">
          <CardHeader
            title="Monthly Services Completed"
            eyebrow="Last 12 months"
            action={
              <div className="flex items-center gap-1">
                <AnimatedTrendingUp size={16} className="text-[var(--color-success-deep)] dark:text-[var(--color-success)]" />
                <InfoTooltip content="Historical trend of completed service records" />
              </div>
            }
          />
          <div className="mt-6">
            <MonthlyServicesChart data={monthlyServices} />
          </div>
        </Card>

        <Card padding="lg" className="shadow-xs hover:border-muted-foreground/40 transition-colors bg-card border border-border">
          <CardHeader
            title="Overdue Trend"
            eyebrow="Last 30 days"
            action={
              <div className="flex items-center gap-1">
                <AnimatedAlertTriangle size={16} className="text-[var(--color-error-deep)] dark:text-[var(--color-error)]" />
                <InfoTooltip content="Track overdue machine backlog reduction" />
              </div>
            }
          />
          <div className="mt-6">
            <OverdueTrendChart data={overdueTrend} />
          </div>
        </Card>
      </div>
      )}
    </div>
  );
}
