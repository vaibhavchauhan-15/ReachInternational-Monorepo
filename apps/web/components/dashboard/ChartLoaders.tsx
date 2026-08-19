"use client";

import dynamic from "next/dynamic";
import { SkeletonChartCard } from "@/components/ui";

/**
 * Client-side dynamic loaders for Recharts-based dashboard charts.
 *
 * Recharts (~110 KB uncompressed) is code-split into a separate chunk that
 * is fetched on-demand only after the dashboard route hydrates. The skeleton
 * fallback renders instantly, eliminating Recharts from the initial JS payload.
 */
export const MonthlyServicesChart = dynamic(
  () => import("./Charts").then((mod) => mod.MonthlyServicesChart),
  { loading: () => <SkeletonChartCard />, ssr: false }
);

export const OverdueTrendChart = dynamic(
  () => import("./Charts").then((mod) => mod.OverdueTrendChart),
  { loading: () => <SkeletonChartCard />, ssr: false }
);