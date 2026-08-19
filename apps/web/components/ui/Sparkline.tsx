"use client";

import { useId, useMemo } from "react";

interface SparklineProps {
  data: number[];
  className?: string;
  strokeClassName?: string;
  fillClassName?: string;
  strokeWidth?: number;
  height?: number;
}

/**
 * Lightweight GPU-friendly SVG sparkline for KPI cards.
 * Uses only opacity/transform-friendly rendering (no layout thrash).
 */
export function Sparkline({
  data,
  className = "",
  strokeClassName = "text-[var(--color-link)]",
  fillClassName = "text-[var(--color-link)]",
  strokeWidth = 1.5,
  height = 28,
}: SparklineProps) {
  const gradientId = useId().replace(/:/g, "");

  const { points, areaPoints } = useMemo(() => {
    if (data.length === 0) {
      return { points: "", areaPoints: "" };
    }

    const width = 100;
    const padding = 2;
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1;

    const pts = data
      .map((value, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - padding - ((value - minVal) / range) * (height - padding * 2);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

    const areaPts = `0,${height} ${pts} ${width},${height}`;

    return { points: pts, areaPoints: areaPts };
  }, [data, height]);

  if (data.length === 0) {
    return (
      <div
        className={`w-full rounded-[var(--radius-sm)] bg-[var(--color-hairline-soft)] ${className}`}
        style={{ height }}
        aria-hidden="true"
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={`w-full overflow-visible ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#${gradientId})`}
        className={fillClassName}
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className={strokeClassName}
      />
    </svg>
  );
}