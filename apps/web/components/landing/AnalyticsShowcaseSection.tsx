"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AnimatedTrendingUp } from "@/components/ui/animated-icons";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Section } from "./_shared/Section";

const trendData = [
  { month: "Jan", onTime: 92 },
  { month: "Feb", onTime: 95 },
  { month: "Mar", onTime: 94 },
  { month: "Apr", onTime: 98 },
  { month: "May", onTime: 99 },
  { month: "Jun", onTime: 99.8 },
];

const categoryData = [
  { name: "CNC Milling", count: 184 },
  { name: "Laser Cutting", count: 120 },
  { name: "Robotics", count: 96 },
  { name: "Hydraulics", count: 64 },
];

export function AnalyticsShowcaseSection() {
  const { resolvedTheme } = useTheme();
  // Ink adapts per theme (SVG stroke/gradient stops can't reliably read CSS vars).
  const ink = resolvedTheme === "dark" ? "#fafafa" : "#171717";

  return (
    <Section
      id="analytics"
      eyebrow="Executive analytics"
      title="Turn maintenance logs into intelligence"
      intro="Spot failure patterns before they cause downtime — with clear, exportable reporting."
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart card */}
        <div className="lg:col-span-2 card-base p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="heading-md text-[var(--color-ink)]">On-time service SLA rate</h3>
              <p className="body-sm text-[var(--color-mute)]">Target: &gt;98% compliance</p>
            </div>
            <div className="flex items-center gap-1.5 text-button-md font-medium text-[var(--color-success)]">
              <AnimatedTrendingUp size={16} />
              +7.8%
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ink} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={ink} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--color-mute)" }} />
                <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: "var(--color-mute)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-canvas-elevated)",
                    borderColor: "var(--color-hairline)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "var(--color-ink)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="onTime"
                  stroke={ink}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorOnTime)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution + predictive card */}
        <div className="space-y-4">
          <div className="card-base p-6">
            <h3 className="heading-md text-[var(--color-ink)] mb-4">Fleet distribution</h3>
            <div className="space-y-3">
              {categoryData.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex justify-between body-sm">
                    <span className="text-[var(--color-body)]">{cat.name}</span>
                    <span className="font-mono text-[var(--color-ink)] font-medium tabular-nums">
                      {cat.count}
                    </span>
                  </div>
                  <div className="w-full bg-[var(--color-hairline)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[var(--color-ink)] h-full rounded-full"
                      style={{ width: `${(cat.count / 200) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-on-primary)] p-6">
            <p className="eyebrow !text-[var(--color-on-primary)] opacity-70 mb-2">Predictive score</p>
            <div className="display-xl mb-1 tabular-nums">99.8%</div>
            <p className="body-sm opacity-80">
              Zero unplanned outages predicted across the fleet for the next 30 days.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
