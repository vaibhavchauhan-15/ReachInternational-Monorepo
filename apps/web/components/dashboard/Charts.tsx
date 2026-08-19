"use client";

import { useState, useEffect, memo, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import type { MonthlyServiceData, OverdueTrendData } from "@/lib/types/database";
import { useTheme } from "@/components/theme/ThemeProvider";
import { EmptyState } from "@/components/ui";
import { AnimatedBarChart3, AnimatedTrendingUp } from "@/components/ui/animated-icons";

const chartMargin = { top: 10, right: 10, bottom: 5, left: -20 };

export const MonthlyServicesChart = memo(function MonthlyServicesChart({
  data,
}: {
  data: MonthlyServiceData[];
}) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const tooltipStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "#161D27" : "#ffffff",
      borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#ebebeb",
      borderRadius: "12px",
      fontSize: "12px",
      color: isDark ? "#F8FAFC" : "#171717",
      fontFamily: "var(--font-sans), sans-serif",
      boxShadow: isDark
        ? "0px 8px 24px rgba(0, 0, 0, 0.6)"
        : "0px 4px 16px rgba(0, 0, 0, 0.08)",
    }),
    [isDark]
  );

  const axisTickStyle = useMemo(
    () => ({
      fontSize: 12,
      fill: isDark ? "#94A3B8" : "#8f8f8f",
      fontFamily: "var(--font-sans), sans-serif",
    }),
    [isDark]
  );

  const gridStroke = isDark ? "rgba(255, 255, 255, 0.08)" : "#ebebeb";
  const barColor = isDark ? "#38BDF8" : "#171717";
  const cursorStyle = useMemo(
    () => ({ fill: isDark ? "rgba(255, 255, 255, 0.04)" : "#fafafa" }),
    [isDark]
  );

  if (!mounted) {
    return (
      <div className="h-64 w-full bg-muted/60 animate-pulse rounded-[var(--radius-sm)]" />
    );
  }

  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <EmptyState
          icon={<AnimatedBarChart3 size={24} />}
          title="No services yet"
          description="Completed services will appear here as a monthly trend."
          className="py-8"
        />
      </div>
    );
  }

  return (
    <div className="h-64 w-full modal-overlay-fade">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={chartMargin}>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={axisTickStyle}
            axisLine={{ stroke: gridStroke }}
            tickLine={false}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={cursorStyle}
            formatter={(value) => [value, "Services"]}
          />
          <Bar
            dataKey="count"
            fill={barColor}
            radius={[6, 6, 0, 0]}
            maxBarSize={32}
            animationDuration={600}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

export const OverdueTrendChart = memo(function OverdueTrendChart({
  data,
}: {
  data: OverdueTrendData[];
}) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const tooltipStyle = useMemo(
    () => ({
      backgroundColor: isDark ? "#161D27" : "#ffffff",
      borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "#ebebeb",
      borderRadius: "12px",
      fontSize: "12px",
      color: isDark ? "#F8FAFC" : "#171717",
      fontFamily: "var(--font-sans), sans-serif",
      boxShadow: isDark
        ? "0px 8px 24px rgba(0, 0, 0, 0.6)"
        : "0px 4px 16px rgba(0, 0, 0, 0.08)",
    }),
    [isDark]
  );

  const axisTickStyle = useMemo(
    () => ({
      fontSize: 12,
      fill: isDark ? "#94A3B8" : "#8f8f8f",
      fontFamily: "var(--font-sans), sans-serif",
    }),
    [isDark]
  );

  const gridStroke = isDark ? "rgba(255, 255, 255, 0.08)" : "#ebebeb";
  const strokeColor = isDark ? "#F87171" : "#ee0000";

  if (!mounted) {
    return (
      <div className="h-64 w-full bg-muted/60 skeleton-shimmer-active rounded-[var(--radius-sm)]" />
    );
  }

  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <EmptyState
          icon={<AnimatedTrendingUp size={24} />}
          title="No overdue backlog"
          description="Your overdue trend will appear here once machines fall behind schedule."
          className="py-8"
        />
      </div>
    );
  }

  return (
    <div className="h-64 w-full modal-overlay-fade">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={chartMargin}>
          <defs>
            <linearGradient id="overdueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={isDark ? 0.3 : 0.15} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={axisTickStyle}
            axisLine={{ stroke: gridStroke }}
            tickLine={false}
            interval={4}
          />
          <YAxis
            tick={axisTickStyle}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Overdue"]} />
          <Area
            type="monotone"
            dataKey="count"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#overdueGradient)"
            animationDuration={600}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});